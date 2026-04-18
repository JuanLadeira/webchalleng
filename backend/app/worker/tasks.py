import asyncio
import logging

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="process_pending_events")
def process_pending_events() -> dict:
    """Processa eventos pendentes do outbox e envia e-mails."""
    return asyncio.run(_process_with_new_session())


async def _process_with_new_session() -> dict:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        try:
            result = await _process_with_session(session)
            await session.commit()
            return result
        except Exception:
            await session.rollback()
            raise
        finally:
            await engine.dispose()


async def _process_with_session(session) -> dict:
    from app.domain.entities.outbox_event import EventType
    from app.infrastructure.email.smtp_sender import (
        booking_canceled_email,
        booking_created_email,
        booking_updated_email,
        send_email,
    )
    from app.infrastructure.repositories.sqlalchemy_outbox_repo import SQLAlchemyOutboxRepository

    repo = SQLAlchemyOutboxRepository(session)
    events = await repo.get_pending(limit=10)

    processed = 0
    failed = 0

    for event in events:
        try:
            participants: list[str] = event.payload.get("participants", [])

            if event.event_type == EventType.BOOKING_CREATED:
                subject, html = booking_created_email(event.payload)
            elif event.event_type == EventType.BOOKING_UPDATED:
                subject, html = booking_updated_email(event.payload)
            elif event.event_type == EventType.BOOKING_CANCELED:
                subject, html = booking_canceled_email(event.payload)
            else:
                logger.warning("Tipo de evento desconhecido: %s", event.event_type)
                await repo.mark_failed(event.id)
                failed += 1
                continue

            send_email(to=participants, subject=subject, html_body=html)
            await repo.mark_processed(event.id)
            processed += 1
            logger.info("Evento %s processado (booking %s)", event.id, event.booking_id)

        except Exception as exc:
            logger.error("Falha ao processar evento %s: %s", event.id, exc)
            await repo.mark_failed(event.id)
            failed += 1

    if events:
        logger.info("Outbox: %d processados, %d falhas", processed, failed)

    return {"processed": processed, "failed": failed}
