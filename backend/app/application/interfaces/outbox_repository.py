from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.outbox_event import EventType, OutboxEvent


class OutboxRepository(ABC):
    @abstractmethod
    async def create(
        self,
        event_type: EventType,
        booking_id: UUID,
        payload: dict,
    ) -> OutboxEvent: ...

    @abstractmethod
    async def get_pending(self, limit: int = 10) -> list[OutboxEvent]: ...

    @abstractmethod
    async def mark_processed(self, event_id: UUID) -> None: ...

    @abstractmethod
    async def mark_failed(self, event_id: UUID) -> None: ...
