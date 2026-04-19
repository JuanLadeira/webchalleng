"""
Testes de criação e conflito de reservas.

Um mesmo usuário não pode ter duas reservas com horários sobrepostos,
independente da sala. Tentativas de sobreposição retornam 409.
"""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

NOW = datetime.now(tz=timezone.utc).replace(microsecond=0)


@pytest.fixture
async def auth_headers(db_client: AsyncClient) -> dict:
    payload = {
        "name": "Overlap User",
        "email": "overlap@example.com",
        "password": "senha123",
    }
    await db_client.post("/api/auth/register", json=payload)
    login = await db_client.post(
        "/api/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def make_booking(start: datetime, end: datetime, title: str = "Reunião") -> dict:
    return {
        "title": title,
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }


class TestBookingCreation:
    async def test_same_time_slot_blocked_same_user(
        self, db_client: AsyncClient, auth_headers
    ):
        """O mesmo usuário não pode criar duas reservas no mesmo horário."""
        start = NOW + timedelta(days=2, hours=9)
        end = start + timedelta(hours=1)

        r1 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end, "Reunião A"),
            headers=auth_headers,
        )
        assert r1.status_code == 201

        r2 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end, "Reunião B"),
            headers=auth_headers,
        )
        assert r2.status_code == 409

    async def test_partial_overlap_blocked_same_user(
        self, db_client: AsyncClient, auth_headers
    ):
        """Sobreposição parcial de horário também é bloqueada para o mesmo usuário."""
        start = NOW + timedelta(days=2, hours=14)
        end = start + timedelta(hours=2)

        r1 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end, "Reunião principal"),
            headers=auth_headers,
        )
        assert r1.status_code == 201

        overlap_start = start + timedelta(hours=1)
        overlap_end = end + timedelta(hours=1)
        r2 = await db_client.post(
            "/api/bookings",
            json=make_booking(overlap_start, overlap_end, "Reunião paralela"),
            headers=auth_headers,
        )
        assert r2.status_code == 409

    async def test_adjacent_slots_are_allowed(
        self, db_client: AsyncClient, auth_headers
    ):
        start = NOW + timedelta(days=3, hours=10)
        end = start + timedelta(hours=1)
        next_start = end
        next_end = next_start + timedelta(hours=1)

        r1 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end, "Reunião manhã"),
            headers=auth_headers,
        )
        assert r1.status_code == 201

        r2 = await db_client.post(
            "/api/bookings",
            json=make_booking(next_start, next_end, "Reunião tarde"),
            headers=auth_headers,
        )
        assert r2.status_code == 201

    async def test_cancelled_booking_followed_by_new_one(
        self, db_client: AsyncClient, auth_headers
    ):
        start = NOW + timedelta(days=5, hours=9)
        end = start + timedelta(hours=1)

        b1 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end, "Primeira"),
            headers=auth_headers,
        )
        assert b1.status_code == 201
        booking_id = b1.json()["id"]

        await db_client.delete(f"/api/bookings/{booking_id}", headers=auth_headers)

        b2 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end, "Segunda"),
            headers=auth_headers,
        )
        assert b2.status_code == 201

    async def test_update_preserves_own_slot(
        self, db_client: AsyncClient, auth_headers
    ):
        start = NOW + timedelta(days=6, hours=9)
        end = start + timedelta(hours=1)

        b1 = await db_client.post(
            "/api/bookings",
            json=make_booking(start, end),
            headers=auth_headers,
        )
        assert b1.status_code == 201
        booking_id = b1.json()["id"]

        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"title": "Título novo"},
            headers=auth_headers,
        )
        assert response.status_code == 200
