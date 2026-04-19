import os
import subprocess
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.infrastructure.database.session import get_db
from app.main import app

_BACKEND_DIR = Path(__file__).parent.parent


@pytest.fixture(scope="session")
def postgres_container():
    with PostgresContainer("postgres:16") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def setup_database(postgres_container: PostgresContainer):
    host = postgres_container.get_container_host_ip()
    port = str(postgres_container.get_exposed_port(5432))
    user = postgres_container.username
    password = postgres_container.password
    dbname = postgres_container.dbname

    env = os.environ.copy()
    env.update(
        {
            "POSTGRES_HOST": host,
            "POSTGRES_PORT": port,
            "POSTGRES_USER": user,
            "POSTGRES_PASSWORD": password,
            "POSTGRES_DB": dbname,
        }
    )
    subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        cwd=_BACKEND_DIR,
        env=env,
        check=True,
        capture_output=True,
    )

    async_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{dbname}"
    engine = create_async_engine(async_url, echo=False)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(setup_database):
    session_factory = async_sessionmaker(
        bind=setup_database,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def async_client():
    """Plain HTTP client — sem DB override. Para testes de health e rotas sem DB."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest_asyncio.fixture
async def db_client(db_session: AsyncSession, postgres_container: PostgresContainer):
    """HTTP client com sessão de teste injetada. Para testes de integração."""
    host = postgres_container.get_container_host_ip()
    port = str(postgres_container.get_exposed_port(5432))
    user = postgres_container.username
    password = postgres_container.password
    dbname = postgres_container.dbname

    # Override config so the app connects to the testcontainer
    os.environ.update(
        {
            "POSTGRES_HOST": host,
            "POSTGRES_PORT": port,
            "POSTGRES_USER": user,
            "POSTGRES_PASSWORD": password,
            "POSTGRES_DB": dbname,
        }
    )

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
    app.dependency_overrides.clear()
