import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


class BookingStatus(enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"


@dataclass
class BookingParticipant:
    booking_id: UUID
    email: str
    id: UUID = field(default_factory=uuid4)
    name: str = ""


@dataclass
class Booking:
    title: str
    room_id: UUID
    user_id: UUID
    start_at: datetime
    end_at: datetime
    id: UUID = field(default_factory=uuid4)
    status: BookingStatus = BookingStatus.ACTIVE
    notes: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    participants: list[BookingParticipant] = field(default_factory=list)

    def cancel(self) -> None:
        self.status = BookingStatus.CANCELLED
        self.updated_at = datetime.now(timezone.utc)

    @property
    def is_active(self) -> bool:
        return self.status == BookingStatus.ACTIVE
