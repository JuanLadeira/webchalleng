from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.interfaces.outbox_repository import OutboxRepository
from app.domain.entities.outbox_event import EventType, OutboxEvent, OutboxStatus
from app.infrastructure.database.models import (
    EventTypeEnum,
    OutboxEventModel,
    OutboxStatusEnum,
)


def _to_entity(model: OutboxEventModel) -> OutboxEvent:
    return OutboxEvent(
        id=model.id,
        event_type=EventType(model.event_type.value),
        booking_id=model.booking_id,
        payload=model.payload,
        status=OutboxStatus(model.status.value),
        attempts=model.attempts,
        max_attempts=model.max_attempts,
        idempotency_key=model.idempotency_key,
        processed_at=model.processed_at,
        created_at=model.created_at,
    )


class SQLAlchemyOutboxRepository(OutboxRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        event_type: EventType,
        booking_id: UUID,
        payload: dict,
    ) -> OutboxEvent:
        model = OutboxEventModel(
            event_type=EventTypeEnum(event_type.value),
            booking_id=booking_id,
            payload=payload,
        )
        self.session.add(model)
        await self.session.flush()
        await self.session.refresh(model)
        return _to_entity(model)

    async def get_pending(self, limit: int = 10) -> list[OutboxEvent]:
        result = await self.session.execute(
            select(OutboxEventModel)
            .where(OutboxEventModel.status == OutboxStatusEnum.PENDING)
            .order_by(OutboxEventModel.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return [_to_entity(m) for m in result.scalars().all()]

    async def mark_processed(self, event_id: UUID) -> None:
        result = await self.session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == event_id)
        )
        model = result.scalar_one_or_none()
        if model:
            from datetime import datetime, timezone

            model.status = OutboxStatusEnum.PROCESSED
            model.processed_at = datetime.now(tz=timezone.utc)
            await self.session.flush()

    async def mark_failed(self, event_id: UUID) -> None:
        result = await self.session.execute(
            select(OutboxEventModel).where(OutboxEventModel.id == event_id)
        )
        model = result.scalar_one_or_none()
        if model:
            model.attempts += 1
            if model.attempts >= model.max_attempts:
                model.status = OutboxStatusEnum.FAILED
            await self.session.flush()
