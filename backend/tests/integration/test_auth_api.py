import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import UserModel


@pytest.fixture
def user_payload():
    return {"name": "João Silva", "email": "joao@example.com", "password": "senha123"}


class TestRegister:
    async def test_register_success(self, db_client: AsyncClient, user_payload):
        response = await db_client.post("/api/auth/register", json=user_payload)
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_payload["email"]
        assert data["name"] == user_payload["name"]
        assert "id" in data
        assert "password_hash" not in data

    async def test_register_duplicate_email(self, db_client: AsyncClient, user_payload):
        await db_client.post("/api/auth/register", json=user_payload)
        response = await db_client.post("/api/auth/register", json=user_payload)
        assert response.status_code == 409

    async def test_register_invalid_email(self, db_client: AsyncClient):
        response = await db_client.post(
            "/api/auth/register",
            json={"name": "Teste", "email": "nao-e-email", "password": "123456"},
        )
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, db_client: AsyncClient, user_payload):
        await db_client.post("/api/auth/register", json=user_payload)
        response = await db_client.post(
            "/api/auth/login",
            data={
                "username": user_payload["email"],
                "password": user_payload["password"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, db_client: AsyncClient, user_payload):
        await db_client.post("/api/auth/register", json=user_payload)
        response = await db_client.post(
            "/api/auth/login",
            data={"username": user_payload["email"], "password": "errada"},
        )
        assert response.status_code == 401

    async def test_login_unknown_email(self, db_client: AsyncClient):
        response = await db_client.post(
            "/api/auth/login",
            data={"username": "naoexiste@example.com", "password": "qualquer"},
        )
        assert response.status_code == 401


class TestLoginInactiveUser:
    async def test_login_inactive_user_returns_403(
        self, db_client: AsyncClient, db_session: AsyncSession
    ):
        payload = {
            "name": "Inativo",
            "email": "inativo@example.com",
            "password": "senha123",
        }
        await db_client.post("/api/auth/register", json=payload)

        await db_session.execute(
            update(UserModel)
            .where(UserModel.email == payload["email"])
            .values(is_active=False)
        )
        await db_session.flush()

        response = await db_client.post(
            "/api/auth/login",
            data={"username": payload["email"], "password": payload["password"]},
        )
        assert response.status_code == 403


class TestMe:
    async def test_me_success(self, db_client: AsyncClient, user_payload):
        await db_client.post("/api/auth/register", json=user_payload)
        login = await db_client.post(
            "/api/auth/login",
            data={
                "username": user_payload["email"],
                "password": user_payload["password"],
            },
        )
        token = login.json()["access_token"]

        response = await db_client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == user_payload["email"]

    async def test_me_without_token(self, db_client: AsyncClient):
        response = await db_client.get("/api/auth/me")
        assert response.status_code == 401

    async def test_me_invalid_token(self, db_client: AsyncClient):
        response = await db_client.get(
            "/api/auth/me", headers={"Authorization": "Bearer token.invalido.aqui"}
        )
        assert response.status_code == 401
