"""
Testes do worker de outbox.

Estratégia: testa a função async `_process()` diretamente, sem Celery.
O banco de teste é usado normalmente via conftest.
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
    payload = {"name": "Worker User", "email": "worker@example.com", "password": "senha123"}
    await db_client.post("/api/auth/register", json=payload)
    login = await db_client.post(
        "/api/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _create_booking(db_client: AsyncClient, auth_headers: dict) -> str:
    room = await db_client.post(
        "/api/rooms",
        json={"name": f"Sala Worker {uuid4()}", "capacity": 5, "location": "A"},
        headers=auth_headers,
    )
    room_id = room.json()["id"]
    start = NOW + timedelta(days=10)
    booking = await db_client.post(
        "/api/bookings",
        json={
            "title": "Reunião Worker",
            "room_id": room_id,
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=1)).isoformat(),
            "participant_emails": ["alice@example.com"],
        },
        headers=auth_headers,
    )
    return booking.json()["id"]


class TestOutboxRepository:
    async def test_get_pending_returns_pending_events(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        await _create_booking(db_client, auth_headers)

        repo = SQLAlchemyOutboxRepository(db_session)
        events = await repo.get_pending()
        assert len(events) >= 1
        assert all(e.status.value == "pending" for e in events)

    async def test_mark_processed(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        booking_id = await _create_booking(db_client, auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel).where(
                OutboxEventModel.booking_id == booking_id
            )
        )
        model = result.scalar_one()

        repo = SQLAlchemyOutboxRepository(db_session)
        await repo.mark_processed(model.id)

        result2 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == model.id)
        )
        updated = result2.scalar_one()
        assert updated.status == OutboxStatusEnum.PROCESSED
        assert updated.processed_at is not None

    async def test_mark_failed_increments_attempts(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        booking_id = await _create_booking(db_client, auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel).where(
                OutboxEventModel.booking_id == booking_id
            )
        )
        model = result.scalar_one()

        repo = SQLAlchemyOutboxRepository(db_session)
        await repo.mark_failed(model.id)

        result2 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == model.id)
        )
        updated = result2.scalar_one()
        assert updated.attempts == 1
        assert updated.status == OutboxStatusEnum.PENDING

    async def test_mark_failed_sets_failed_at_max_attempts(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        booking_id = await _create_booking(db_client, auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel).where(
                OutboxEventModel.booking_id == booking_id
            )
        )
        model = result.scalar_one()
        model.max_attempts = 1
        await db_session.flush()

        repo = SQLAlchemyOutboxRepository(db_session)
        await repo.mark_failed(model.id)

        result2 = await db_session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == model.id)
        )
        updated = result2.scalar_one()
        assert updated.status == OutboxStatusEnum.FAILED

    async def test_get_pending_excludes_processed(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        booking_id = await _create_booking(db_client, auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel).where(
                OutboxEventModel.booking_id == booking_id
            )
        )
        model = result.scalar_one()

        repo = SQLAlchemyOutboxRepository(db_session)
        await repo.mark_processed(model.id)

        events = await repo.get_pending()
        assert model.id not in [e.id for e in events]


class TestProcessFunction:
    async def test_process_sends_email_and_marks_processed(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        from app.worker.tasks import _process_with_session

        await _create_booking(db_client, auth_headers)

        with patch(
            "app.infrastructure.email.smtp_sender.send_email",
            new_callable=AsyncMock,
        ):
            result = await _process_with_session(db_session)

        assert result["processed"] >= 1
        assert result["failed"] == 0

    async def test_process_marks_failed_on_smtp_error(
        self, db_client: AsyncClient, db_session: AsyncSession, auth_headers
    ):
        from app.worker.tasks import _process_with_session

        await _create_booking(db_client, auth_headers)

        with patch(
            "app.infrastructure.email.smtp_sender.send_email",
            new_callable=AsyncMock,
            side_effect=Exception("SMTP down"),
        ):
            result = await _process_with_session(db_session)

        assert result["failed"] >= 1
