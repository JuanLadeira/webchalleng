import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.infrastructure.database.session import Base

# ── Enums ─────────────────────────────────────────────────────────────────────


class UserRoleEnum(str, enum.Enum):
    OWNER = "OWNER"
    MEMBER = "MEMBER"


class BookingStatusEnum(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"


class EventTypeEnum(str, enum.Enum):
    BOOKING_CREATED = "BOOKING_CREATED"
    BOOKING_UPDATED = "BOOKING_UPDATED"
    BOOKING_CANCELED = "BOOKING_CANCELED"


class OutboxStatusEnum(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


# ── Models ────────────────────────────────────────────────────────────────────


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRoleEnum] = mapped_column(
        Enum(UserRoleEnum), nullable=False, default=UserRoleEnum.MEMBER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    bookings: Mapped[list["BookingModel"]] = relationship(
        "BookingModel", back_populates="user"
    )


class RoomModel(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    location: Mapped[str] = mapped_column(
        String(255), nullable=False, server_default=""
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    bookings: Mapped[list["BookingModel"]] = relationship(
        "BookingModel", back_populates="room"
    )


class BookingModel(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[BookingStatusEnum] = mapped_column(
        Enum(BookingStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=BookingStatusEnum.ACTIVE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    room: Mapped["RoomModel"] = relationship("RoomModel", back_populates="bookings")
    user: Mapped["UserModel"] = relationship("UserModel", back_populates="bookings")
    participants: Mapped[list["BookingParticipantModel"]] = relationship(
        "BookingParticipantModel",
        back_populates="booking",
        cascade="all, delete-orphan",
    )
    outbox_events: Mapped[list["OutboxEventModel"]] = relationship(
        "OutboxEventModel", back_populates="booking"
    )


class BookingParticipantModel(Base):
    __tablename__ = "booking_participants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=True)

    booking: Mapped["BookingModel"] = relationship(
        "BookingModel", back_populates="participants"
    )


class OutboxEventModel(Base):
    __tablename__ = "outbox_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[EventTypeEnum] = mapped_column(
        Enum(EventTypeEnum), nullable=False
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[OutboxStatusEnum] = mapped_column(
        Enum(OutboxStatusEnum, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=OutboxStatusEnum.PENDING,
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    idempotency_key: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    booking: Mapped["BookingModel"] = relationship(
        "BookingModel", back_populates="outbox_events"
    )
