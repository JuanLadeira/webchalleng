"""
Testes de idempotência do outbox worker.

Garante que eventos já processados não são reprocessados,
mesmo que o worker seja chamado múltiplas vezes.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import OutboxEventModel, OutboxStatusEnum
from app.infrastructure.repositories.sqlalchemy_outbox_repo import (
    SQLAlchemyOutboxRepository,
)

NOW = datetime.now(tz=timezone.utc).replace(microsecond=0)


@pytest.fixture
async def auth_headers(db_client: AsyncClient) -> dict:
    payload = {
        "name": "Idempotency User",
        "email": "idempotency@example.com",
        "password": "senha123",
    }
    await db_client.post("/api/auth/register", json=payload)
    login = await db_client.post(
        "/api/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _create_booking(db_client: AsyncClient, auth_headers: dict) -> str:
    room = await db_client.post(
        "/api/rooms",
        json={"name": f"Sala Idem {uuid4()}", "capacity": 5, "location": "B"},
        headers=auth_headers,
    )
    room_id = room.json()["id"]
    start = NOW + timedelta(days=20)
    booking = await db_client.post(
        "/api/bookings",
        json={
            "title": "Reunião Idempotência",
            "room_id": room_id,
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=1)).isoformat(),
            "participant_emails": ["test@example.com"],
        },
        headers=auth_headers,
    )
    return booking.json()["id"]


class TestIdempotency:
    async def test_processed_event_not_returned_by_get_pending(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        booking_id = await _create_booking(db_client, auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.booking_id == booking_id)
        )
        model = result.scalar_one()

        repo = SQLAlchemyOutboxRepository(db_session)
        await repo.mark_processed(model.id)

        pending = await repo.get_pending()
        assert model.id not in [e.id for e in pending]

    async def test_process_called_twice_sends_email_once(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        from app.worker.tasks import _process_with_session

        await _create_booking(db_client, auth_headers)

        send_mock = AsyncMock()
        with patch("app.infrastructure.email.smtp_sender.send_email", send_mock):
            r1 = await _process_with_session(db_session)
            r2 = await _process_with_session(db_session)

        assert r1["processed"] >= 1
        assert r2["processed"] == 0
        assert r2["failed"] == 0

    async def test_idempotency_key_is_unique_per_event(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        b1 = await _create_booking(db_client, auth_headers)

        room = await db_client.post(
            "/api/rooms",
            json={"name": f"Sala Idem2 {uuid4()}", "capacity": 5, "location": "C"},
            headers=auth_headers,
        )
        room_id = room.json()["id"]
        start = NOW + timedelta(days=21)
        booking2 = await db_client.post(
            "/api/bookings",
            json={
                "title": "Outra Reunião",
                "room_id": room_id,
                "start_at": start.isoformat(),
                "end_at": (start + timedelta(hours=1)).isoformat(),
            },
            headers=auth_headers,
        )
        b2 = booking2.json()["id"]

        r1 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.booking_id == b1)
        )
        r2 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.booking_id == b2)
        )
        e1 = r1.scalar_one()
        e2 = r2.scalar_one()
        assert e1.idempotency_key != e2.idempotency_key

    async def test_failed_event_still_pending_until_max_attempts(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        booking_id = await _create_booking(db_client, auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.booking_id == booking_id)
        )
        model = result.scalar_one()
        model.max_attempts = 3
        await db_session.flush()

        repo = SQLAlchemyOutboxRepository(db_session)
        await repo.mark_failed(model.id)
        await repo.mark_failed(model.id)

        result2 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == model.id)
        )
        updated = result2.scalar_one()
        assert updated.status == OutboxStatusEnum.PENDING
        assert updated.attempts == 2

        await repo.mark_failed(model.id)
        result3 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == model.id)
        )
        updated = result3.scalar_one()
        assert updated.status == OutboxStatusEnum.FAILED
