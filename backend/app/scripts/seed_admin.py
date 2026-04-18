"""
Seed de usuário admin para ambiente de desenvolvimento.

Lê SEED_ADMIN_NAME, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD do ambiente.
Se as variáveis não estiverem definidas, o script encerra sem fazer nada.
Se o usuário já existir, o script encerra sem erro (idempotente).
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)


async def seed_admin() -> None:
    name = os.getenv("SEED_ADMIN_NAME", "")
    email = os.getenv("SEED_ADMIN_EMAIL", "")
    password = os.getenv("SEED_ADMIN_PASSWORD", "")

    if not (name and email and password):
        logger.info("Seed de admin ignorado: SEED_ADMIN_* não configurados.")
        return

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.infrastructure.database.models import UserModel, UserRoleEnum
    from app.infrastructure.database.session import engine
    from app.infrastructure.repositories.sqlalchemy_user_repo import SQLAlchemyUserRepository
    from app.infrastructure.security.jwt import get_password_hash

    SessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with SessionLocal() as session:
        repo = SQLAlchemyUserRepository(session)
        existing = await repo.get_by_email(email)

        if existing:
            logger.info("Admin '%s' já existe, seed ignorado.", email)
            return

        user = UserModel(
            name=name,
            email=email,
            password_hash=get_password_hash(password),
            role=UserRoleEnum.OWNER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        logger.info("Admin '%s' criado com sucesso.", email)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_admin())
