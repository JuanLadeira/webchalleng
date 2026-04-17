from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from app.domain.entities.booking import Booking


class BookingRepository(ABC):
    @abstractmethod
    async def get_by_id(self, booking_id: UUID) -> Booking | None: ...

    @abstractmethod
    async def list_by_user(self, user_id: UUID) -> list[Booking]: ...

    @abstractmethod
    async def find_overlap(
        self,
        room_id: UUID,
        start_at: datetime,
        end_at: datetime,
        exclude_id: UUID | None = None,
    ) -> Booking | None: ...

    @abstractmethod
    async def create(
        self,
        title: str,
        room_id: UUID,
        user_id: UUID,
        start_at: datetime,
        end_at: datetime,
        participant_emails: list[str],
    ) -> Booking: ...

    @abstractmethod
    async def update(
        self,
        booking_id: UUID,
        title: str | None,
        start_at: datetime | None,
        end_at: datetime | None,
        participant_emails: list[str] | None,
    ) -> Booking | None: ...

    @abstractmethod
    async def cancel(self, booking_id: UUID) -> Booking | None: ...
