import asyncio
import logging

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="process_pending_events", bind=True, max_retries=0)
def process_pending_events(self) -> dict:
    return asyncio.run(_process())


async def _process() -> dict:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.infrastructure.database.session import engine

    SessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with SessionLocal() as session:
        result = await _process_with_session(session)
        await session.commit()
    return result


async def _process_with_session(session) -> dict:
    from app.infrastructure.email.smtp_sender import build_email_body, send_email
    from app.infrastructure.repositories.sqlalchemy_outbox_repo import (
        SQLAlchemyOutboxRepository,
    )

    repo = SQLAlchemyOutboxRepository(session)
    events = await repo.get_pending(limit=20)

    processed = 0
    failed = 0

    for event in events:
        try:
            participants: list[str] = event.payload.get("participants", [])
            subject, body = build_email_body(event.event_type.value, event.payload)
            await send_email(to=participants, subject=subject, body=body)
            await repo.mark_processed(event.id)
            processed += 1
            logger.info("Evento %s processado.", event.id)
        except Exception as exc:
            await repo.mark_failed(event.id)
            failed += 1
            logger.warning("Falha no evento %s: %s", event.id, exc)

    return {"processed": processed, "failed": failed}
