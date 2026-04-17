import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_token(db_client: AsyncClient) -> str:
    payload = {
        "name": "Usuário Rooms",
        "email": "rooms_user@example.com",
        "password": "senha123",
    }
    await db_client.post("/api/auth/register", json=payload)
    login = await db_client.post(
        "/api/auth/login",
        data={"username": payload["email"], "password": payload["password"]},
    )
    return login.json()["access_token"]


@pytest.fixture
def room_payload():
    return {
        "name": "Sala Berlim",
        "capacity": 10,
        "location": "2º andar",
        "description": "Sala com projetor",
    }


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


class TestCreateRoom:
    async def test_create_success(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        response = await db_client.post(
            "/api/rooms", json=room_payload, headers=auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == room_payload["name"]
        assert data["capacity"] == room_payload["capacity"]
        assert data["location"] == room_payload["location"]
        assert data["is_active"] is True
        assert "id" in data

    async def test_create_duplicate_name(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        await db_client.post("/api/rooms", json=room_payload, headers=auth_headers)
        response = await db_client.post(
            "/api/rooms", json=room_payload, headers=auth_headers
        )
        assert response.status_code == 409

    async def test_create_invalid_capacity(self, db_client: AsyncClient, auth_headers):
        response = await db_client.post(
            "/api/rooms",
            json={"name": "Sala X", "capacity": 0, "location": "Térreo"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_create_requires_auth(self, db_client: AsyncClient, room_payload):
        response = await db_client.post("/api/rooms", json=room_payload)
        assert response.status_code == 401


class TestListRooms:
    async def test_list_returns_active_rooms(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        await db_client.post("/api/rooms", json=room_payload, headers=auth_headers)
        response = await db_client.get("/api/rooms", headers=auth_headers)
        assert response.status_code == 200
        rooms = response.json()
        assert isinstance(rooms, list)
        assert any(r["name"] == room_payload["name"] for r in rooms)

    async def test_list_includes_inactive_when_requested(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        payload = {**room_payload, "name": "Sala Inativa Lista"}
        created = await db_client.post("/api/rooms", json=payload, headers=auth_headers)
        room_id = created.json()["id"]
        await db_client.delete(f"/api/rooms/{room_id}", headers=auth_headers)

        active_only = await db_client.get("/api/rooms", headers=auth_headers)
        all_rooms = await db_client.get(
            "/api/rooms?active_only=false", headers=auth_headers
        )

        active_names = [r["name"] for r in active_only.json()]
        all_names = [r["name"] for r in all_rooms.json()]

        assert payload["name"] not in active_names
        assert payload["name"] in all_names

    async def test_list_requires_auth(self, db_client: AsyncClient):
        response = await db_client.get("/api/rooms")
        assert response.status_code == 401


class TestGetRoom:
    async def test_get_existing_room(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        created = await db_client.post(
            "/api/rooms", json=room_payload, headers=auth_headers
        )
        room_id = created.json()["id"]

        response = await db_client.get(f"/api/rooms/{room_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == room_id

    async def test_get_nonexistent_room(self, db_client: AsyncClient, auth_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await db_client.get(f"/api/rooms/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


class TestUpdateRoom:
    async def test_update_capacity(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        created = await db_client.post(
            "/api/rooms", json=room_payload, headers=auth_headers
        )
        room_id = created.json()["id"]

        response = await db_client.patch(
            f"/api/rooms/{room_id}",
            json={"capacity": 20},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["capacity"] == 20

    async def test_update_name_conflict(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        await db_client.post("/api/rooms", json=room_payload, headers=auth_headers)
        other = {**room_payload, "name": "Sala Paris"}
        created = await db_client.post("/api/rooms", json=other, headers=auth_headers)
        room_id = created.json()["id"]

        response = await db_client.patch(
            f"/api/rooms/{room_id}",
            json={"name": room_payload["name"]},
            headers=auth_headers,
        )
        assert response.status_code == 409


class TestDeleteRoom:
    async def test_delete_deactivates_room(
        self, db_client: AsyncClient, auth_headers, room_payload
    ):
        payload = {**room_payload, "name": "Sala para deletar"}
        created = await db_client.post("/api/rooms", json=payload, headers=auth_headers)
        room_id = created.json()["id"]

        response = await db_client.delete(f"/api/rooms/{room_id}", headers=auth_headers)
        assert response.status_code == 204

        get_response = await db_client.get(
            f"/api/rooms/{room_id}", headers=auth_headers
        )
        assert get_response.json()["is_active"] is False

    async def test_delete_nonexistent(self, db_client: AsyncClient, auth_headers):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await db_client.delete(f"/api/rooms/{fake_id}", headers=auth_headers)
        assert response.status_code == 404
