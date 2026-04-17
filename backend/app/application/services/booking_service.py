from typing import Annotated
from uuid import UUID

from asyncpg import UniqueViolationError
from asyncpg.exceptions import ExclusionViolationError
from fastapi import Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.interfaces.booking_repository import BookingRepository
from app.application.interfaces.outbox_repository import OutboxRepository
from app.application.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from app.domain.entities.booking import Booking
from app.domain.entities.outbox_event import EventType
from app.infrastructure.database.session import get_db
from app.infrastructure.repositories.sqlalchemy_booking_repo import (
    SQLAlchemyBookingRepository,
)
from app.infrastructure.repositories.sqlalchemy_outbox_repo import (
    SQLAlchemyOutboxRepository,
)


def _to_out(booking: Booking) -> BookingOut:
    return BookingOut(
        id=booking.id,
        title=booking.title,
        room_id=booking.room_id,
        user_id=booking.user_id,
        start_at=booking.start_at,
        end_at=booking.end_at,
        status=booking.status.value,
        participants=[
            {"id": p.id, "email": p.email, "name": p.name}
            for p in booking.participants
        ],
    )


def _booking_payload(booking: Booking) -> dict:
    return {
        "booking_id": str(booking.id),
        "title": booking.title,
        "room_id": str(booking.room_id),
        "start_at": booking.start_at.isoformat(),
        "end_at": booking.end_at.isoformat(),
        "participants": [p.email for p in booking.participants],
    }


class BookingService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo: BookingRepository = SQLAlchemyBookingRepository(session)
        self.outbox: OutboxRepository = SQLAlchemyOutboxRepository(session)

    async def create(self, data: BookingCreate, organizer_id: UUID) -> BookingOut:
        overlap = await self.repo.find_overlap(
            room_id=data.room_id,
            start_at=data.start_at,
            end_at=data.end_at,
        )
        if overlap:
            raise HTTPException(
                status_code=409,
                detail="Sala já reservada nesse horário.",
            )

        try:
            booking = await self.repo.create(
                title=data.title,
                room_id=data.room_id,
                user_id=organizer_id,
                start_at=data.start_at,
                end_at=data.end_at,
                participant_emails=data.participant_emails,
            )
            await self.outbox.create(
                event_type=EventType.BOOKING_CREATED,
                booking_id=booking.id,
                payload=_booking_payload(booking),
            )
        except IntegrityError as exc:
            await self.session.rollback()
            if _is_exclusion_violation(exc):
                raise HTTPException(
                    status_code=409,
                    detail="Conflito de reserva (constraint banco).",
                ) from exc
            raise

        return _to_out(booking)

    async def get(self, booking_id: UUID, user_id: UUID) -> BookingOut:
        booking = await self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Reserva não encontrada.")
        if booking.user_id != user_id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
        return _to_out(booking)

    async def list_mine(self, user_id: UUID) -> list[BookingOut]:
        bookings = await self.repo.list_by_user(user_id)
        return [_to_out(b) for b in bookings]

    async def update(
        self, booking_id: UUID, data: BookingUpdate, user_id: UUID
    ) -> BookingOut:
        booking = await self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Reserva não encontrada.")
        if booking.user_id != user_id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
        if not booking.is_active:
            raise HTTPException(status_code=409, detail="Reserva já cancelada.")

        new_start = data.start_at or booking.start_at
        new_end = data.end_at or booking.end_at

        overlap = await self.repo.find_overlap(
            room_id=booking.room_id,
            start_at=new_start,
            end_at=new_end,
            exclude_id=booking_id,
        )
        if overlap:
            raise HTTPException(
                status_code=409,
                detail="Sala já reservada nesse horário.",
            )

        try:
            updated = await self.repo.update(
                booking_id=booking_id,
                title=data.title,
                start_at=data.start_at,
                end_at=data.end_at,
                participant_emails=data.participant_emails,
            )
            await self.outbox.create(
                event_type=EventType.BOOKING_UPDATED,
                booking_id=booking_id,
                payload=_booking_payload(updated),
            )
        except IntegrityError as exc:
            await self.session.rollback()
            if _is_exclusion_violation(exc):
                raise HTTPException(
                    status_code=409,
                    detail="Conflito de reserva (constraint banco).",
                ) from exc
            raise

        return _to_out(updated)

    async def cancel(self, booking_id: UUID, user_id: UUID) -> BookingOut:
        booking = await self.repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Reserva não encontrada.")
        if booking.user_id != user_id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
        if not booking.is_active:
            raise HTTPException(status_code=409, detail="Reserva já cancelada.")

        cancelled = await self.repo.cancel(booking_id)
        await self.outbox.create(
            event_type=EventType.BOOKING_CANCELED,
            booking_id=booking_id,
            payload=_booking_payload(cancelled),
        )
        return _to_out(cancelled)


def _is_exclusion_violation(exc: IntegrityError) -> bool:
    orig = getattr(exc, "orig", None)
    if orig is None:
        return False
    return isinstance(orig, ExclusionViolationError) or isinstance(
        orig, UniqueViolationError
    )


async def get_booking_service(session: AsyncSession = Depends(get_db)) -> BookingService:
    return BookingService(session)


BookingServiceDep = Annotated[BookingService, Depends(get_booking_service)]
