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


@pytest.fixture
async def room_id(db_client: AsyncClient, auth_headers) -> str:
    resp = await db_client.post(
        "/api/rooms",
        json={"name": "Sala Overlap", "capacity": 5, "location": "Térreo"},
        headers=auth_headers,
    )
    return resp.json()["id"]


def make_booking(room_id: str, start: datetime, end: datetime) -> dict:
    return {
        "title": "Reunião",
        "room_id": room_id,
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }


class TestOverlapDetection:
    async def test_exact_same_slot_returns_409(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=2, hours=9)
        end = start + timedelta(hours=1)

        r1 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )
        assert r1.status_code == 201

        r2 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )
        assert r2.status_code == 409

    async def test_partial_overlap_returns_409(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=2, hours=14)
        end = start + timedelta(hours=2)

        await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )

        overlap_start = start + timedelta(hours=1)
        overlap_end = end + timedelta(hours=1)
        r2 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, overlap_start, overlap_end),
            headers=auth_headers,
        )
        assert r2.status_code == 409

    async def test_adjacent_slots_are_allowed(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=3, hours=10)
        end = start + timedelta(hours=1)
        next_start = end
        next_end = next_start + timedelta(hours=1)

        r1 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )
        assert r1.status_code == 201

        r2 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, next_start, next_end),
            headers=auth_headers,
        )
        assert r2.status_code == 201

    async def test_different_rooms_no_conflict(
        self, db_client: AsyncClient, auth_headers
    ):
        r1 = await db_client.post(
            "/api/rooms",
            json={"name": "Sala Overlap A", "capacity": 5, "location": "A"},
            headers=auth_headers,
        )
        r2 = await db_client.post(
            "/api/rooms",
            json={"name": "Sala Overlap B", "capacity": 5, "location": "B"},
            headers=auth_headers,
        )
        room_a = r1.json()["id"]
        room_b = r2.json()["id"]

        start = NOW + timedelta(days=4, hours=9)
        end = start + timedelta(hours=1)

        b1 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_a, start, end),
            headers=auth_headers,
        )
        b2 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_b, start, end),
            headers=auth_headers,
        )
        assert b1.status_code == 201
        assert b2.status_code == 201

    async def test_cancelled_booking_frees_slot(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=5, hours=9)
        end = start + timedelta(hours=1)

        b1 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )
        booking_id = b1.json()["id"]

        await db_client.delete(f"/api/bookings/{booking_id}", headers=auth_headers)

        b2 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )
        assert b2.status_code == 201

    async def test_update_preserves_own_slot(
        self, db_client: AsyncClient, auth_headers, room_id
    ):
        start = NOW + timedelta(days=6, hours=9)
        end = start + timedelta(hours=1)

        b1 = await db_client.post(
            "/api/bookings",
            json=make_booking(room_id, start, end),
            headers=auth_headers,
        )
        booking_id = b1.json()["id"]

        response = await db_client.patch(
            f"/api/bookings/{booking_id}",
            json={"title": "Título novo"},
            headers=auth_headers,
        )
        assert response.status_code == 200
