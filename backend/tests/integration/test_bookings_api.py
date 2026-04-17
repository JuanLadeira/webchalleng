from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

NOW = datetime.now(tz=timezone.utc).replace(microsecond=0)


@pytest.fixture
async def auth_token(db_client: AsyncClient) -> str:
    payload = {
        "name": "Organizador",
        "email": "org_bookings@example.com",
        "password": "senha123",
    }
    await db_client.post("/api/auth/register", json=payload)
    login = await db_client.post(
        "/api/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    )
    return login.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
async def room_id(db_client: AsyncClient, auth_headers) -> str:
    resp = await db_client.post(
        "/api/rooms",
        json={"name": "Sala Booking", "capacity": 10, "location": "1º andar"},
        headers=auth_headers,
    )
    return resp.json()["id"]


@pytest.fixture
def booking_payload(room_id):
    start = NOW + timedelta(days=1)
    end = start + timedelta(hours=1)
    return {
        "title": "Reunião de Planejamento",
        "room_id": room_id,
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
        "participant_emails": ["alice@example.com", "bob@example.com"],
    }


class TestCreateBooking:
    async def test_create_success(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        response = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == booking_payload["title"]
        assert data["status"] == "active"
        assert len(data["participants"]) == 2
        assert "id" in data

    async def test_create_requires_auth(self, db_client: AsyncClient, booking_payload):
        response = await db_client.post("/api/bookings", json=booking_payload)
        assert response.status_code == 401

    async def test_create_invalid_dates(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=1)
        response = await db_client.post(
            "/api/bookings",
            json={
                "title": "Inválida",
                "room_id": room_id,
                "start_at": (start + timedelta(hours=1)).isoformat(),
                "end_at": start.isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_create_generates_outbox_event(
        self, db_client: AsyncClient, auth_headers, booking_payload, db_session
    ):
        from sqlalchemy import select

        from app.infrastructure.database.models import OutboxEventModel

        response = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        assert response.status_code == 201
        booking_id = response.json()["id"]

        result = await db_session.execute(
            select(OutboxEventModel).where(
                OutboxEventModel.booking_id == booking_id
            )
        )
        events = result.scalars().all()
        assert len(events) == 1
        assert events[0].event_type.value == "BOOKING_CREATED"
        assert events[0].status.value == "pending"


class TestListBookings:
    async def test_list_returns_user_bookings(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        await db_client.post("/api/bookings", json=booking_payload, headers=auth_headers)
        response = await db_client.get("/api/bookings", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) >= 1

    async def test_list_requires_auth(self, db_client: AsyncClient):
        response = await db_client.get("/api/bookings")
        assert response.status_code == 401


class TestGetBooking:
    async def test_get_own_booking(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        response = await db_client.get(
            f"/api/bookings/{booking_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["id"] == booking_id

    async def test_get_other_user_booking_returns_403(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        other_payload = {
            "name": "Outro",
            "email": "outro_bookings@example.com",
            "password": "senha123",
        }
        await db_client.post("/api/auth/register", json=other_payload)
        other_login = await db_client.post(
            "/api/auth/login",
            data={"username": other_payload["email"], "password": other_payload["password"]},
        )
        other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}

        response = await db_client.get(
            f"/api/bookings/{booking_id}", headers=other_headers
        )
        assert response.status_code == 403

    async def test_get_nonexistent_returns_404(
        self, db_client: AsyncClient, auth_headers
    ):
        response = await db_client.get(
            "/api/bookings/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestUpdateBooking:
    async def test_update_title(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"title": "Título Atualizado"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Título Atualizado"

    async def test_update_generates_outbox_event(
        self, db_client: AsyncClient, auth_headers, booking_payload, db_session
    ):
        from sqlalchemy import select

        from app.infrastructure.database.models import OutboxEventModel

        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"title": "Atualizado"},
            headers=auth_headers,
        )

        result = await db_session.execute(
            select(OutboxEventModel)
            .where(OutboxEventModel.booking_id == booking_id)
            .order_by(OutboxEventModel.created_at)
        )
        events = result.scalars().all()
        event_types = [e.event_type.value for e in events]
        assert "BOOKING_CREATED" in event_types
        assert "BOOKING_UPDATED" in event_types


class TestCancelBooking:
    async def test_cancel_changes_status(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        response = await db_client.delete(
            f"/api/bookings/{booking_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    async def test_cancel_twice_returns_409(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        await db_client.delete(f"/api/bookings/{booking_id}", headers=auth_headers)
        response = await db_client.delete(
            f"/api/bookings/{booking_id}", headers=auth_headers
        )
        assert response.status_code == 409

    async def test_cancel_generates_outbox_event(
        self, db_client: AsyncClient, auth_headers, booking_payload, db_session
    ):
        from sqlalchemy import select

        from app.infrastructure.database.models import OutboxEventModel

        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        await db_client.delete(f"/api/bookings/{booking_id}", headers=auth_headers)

        result = await db_session.execute(
            select(OutboxEventModel)
            .where(OutboxEventModel.booking_id == booking_id)
            .order_by(OutboxEventModel.created_at)
        )
        events = result.scalars().all()
        event_types = [e.event_type.value for e in events]
        assert "BOOKING_CANCELED" in event_types
