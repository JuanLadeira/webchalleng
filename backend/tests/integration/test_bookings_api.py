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


class TestCreateBookingEdgeCases:
    async def test_create_with_nonexistent_room_returns_404(
        self, db_client: AsyncClient, auth_headers
    ):
        start = NOW + timedelta(days=1)
        end = start + timedelta(hours=1)
        response = await db_client.post(
            "/api/bookings",
            json={
                "title": "Reunião",
                "room_id": "00000000-0000-0000-0000-000000000000",
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_create_daily_recurrence(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=10)
        end = start + timedelta(hours=1)
        response = await db_client.post(
            "/api/bookings",
            json={
                "title": "Daily Stand-up",
                "room_id": room_id,
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
                "recurrence": "daily",
                "recurrence_count": 3,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        bookings = await db_client.get("/api/bookings", headers=auth_headers)
        daily_titles = [b for b in bookings.json() if b["title"] == "Daily Stand-up"]
        assert len(daily_titles) == 3

    async def test_create_weekly_recurrence(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=20)
        end = start + timedelta(hours=1)
        response = await db_client.post(
            "/api/bookings",
            json={
                "title": "Weekly Review",
                "room_id": room_id,
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
                "recurrence": "weekly",
                "recurrence_count": 2,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

        bookings = await db_client.get("/api/bookings", headers=auth_headers)
        weekly_titles = [b for b in bookings.json() if b["title"] == "Weekly Review"]
        assert len(weekly_titles) == 2


class TestUpdateBookingEdgeCases:
    async def _other_headers(self, db_client: AsyncClient) -> dict:
        await db_client.post(
            "/api/auth/register",
            json={"name": "Outro", "email": "outro_upd@example.com", "password": "senha123"},
        )
        login = await db_client.post(
            "/api/auth/login",
            data={"username": "outro_upd@example.com", "password": "senha123"},
        )
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    async def test_update_nonexistent_returns_404(
        self, db_client: AsyncClient, auth_headers
    ):
        response = await db_client.patch(
            "/api/bookings/00000000-0000-0000-0000-000000000000",
            json={"title": "X"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_update_other_user_booking_returns_403(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        other_headers = await self._other_headers(db_client)
        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"title": "Invasão"},
            headers=other_headers,
        )
        assert response.status_code == 403

    async def test_update_cancelled_booking_returns_409(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        await db_client.delete(f"/api/bookings/{booking_id}", headers=auth_headers)
        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"title": "Atualizar cancelada"},
            headers=auth_headers,
        )
        assert response.status_code == 409

    async def test_update_with_room_overlap_returns_409(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=30)
        end = start + timedelta(hours=2)

        b1 = await db_client.post(
            "/api/bookings",
            json={
                "title": "Reserva A",
                "room_id": room_id,
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
            },
            headers=auth_headers,
        )
        assert b1.status_code == 201

        b2_start = end + timedelta(hours=1)
        b2_end = b2_start + timedelta(hours=2)
        b2 = await db_client.post(
            "/api/bookings",
            json={
                "title": "Reserva B",
                "room_id": room_id,
                "start_at": b2_start.isoformat(),
                "end_at": b2_end.isoformat(),
            },
            headers=auth_headers,
        )
        assert b2.status_code == 201
        b2_id = b2.json()["id"]

        # Tenta mover Reserva B para sobreposição com Reserva A
        response = await db_client.patch(
            f"/api/bookings/{b2_id}",
            json={
                "start_at": (start + timedelta(minutes=30)).isoformat(),
                "end_at": (end + timedelta(minutes=30)).isoformat(),
            },
            headers=auth_headers,
        )
        assert response.status_code == 409

    async def test_update_dates_and_notes(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        new_start = (NOW + timedelta(days=2)).isoformat()
        new_end = (NOW + timedelta(days=2, hours=1)).isoformat()

        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"start_at": new_start, "end_at": new_end, "notes": "Nota atualizada"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Nota atualizada"

    async def test_update_color(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"color": "#ff0000"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["color"] == "#ff0000"

    async def test_update_participants(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"participant_emails": ["novo@example.com"]},
            headers=auth_headers,
        )
        # apenas verifica que o path de atualização de participantes é executado sem erro
        assert response.status_code == 200


class TestCancelBookingEdgeCases:
    async def test_cancel_nonexistent_returns_404(
        self, db_client: AsyncClient, auth_headers
    ):
        response = await db_client.delete(
            "/api/bookings/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_cancel_other_user_booking_returns_403(
        self, db_client: AsyncClient, auth_headers, booking_payload
    ):
        created = await db_client.post(
            "/api/bookings", json=booking_payload, headers=auth_headers
        )
        booking_id = created.json()["id"]

        await db_client.post(
            "/api/auth/register",
            json={"name": "Invasor", "email": "invasor_cancel@example.com", "password": "senha123"},
        )
        login = await db_client.post(
            "/api/auth/login",
            data={"username": "invasor_cancel@example.com", "password": "senha123"},
        )
        other_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        response = await db_client.delete(
            f"/api/bookings/{booking_id}", headers=other_headers
        )
        assert response.status_code == 403


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
