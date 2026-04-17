from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.interfaces.booking_repository import BookingRepository
from app.domain.entities.booking import Booking, BookingParticipant, BookingStatus
from app.infrastructure.database.models import (
    BookingModel,
    BookingParticipantModel,
    BookingStatusEnum,
)


def _to_entity(model: BookingModel) -> Booking:
    return Booking(
        id=model.id,
        title=model.title,
        room_id=model.room_id,
        user_id=model.user_id,
        start_at=model.start_at,
        end_at=model.end_at,
        status=BookingStatus(model.status.value),
        created_at=model.created_at,
        updated_at=model.updated_at,
        participants=[
            BookingParticipant(
                id=p.id,
                booking_id=p.booking_id,
                email=p.email,
                name=p.name or "",
            )
            for p in model.participants
        ],
    )


class SQLAlchemyBookingRepository(BookingRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, booking_id: UUID) -> Booking | None:
        result = await self.session.execute(
            select(BookingModel)
            .where(BookingModel.id == booking_id)
            .options(selectinload(BookingModel.participants))
        )
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_by_user(self, user_id: UUID) -> list[Booking]:
        result = await self.session.execute(
            select(BookingModel)
            .where(BookingModel.user_id == user_id)
            .options(selectinload(BookingModel.participants))
            .order_by(BookingModel.start_at)
        )
        return [_to_entity(m) for m in result.scalars().all()]

    async def find_overlap(
        self,
        room_id: UUID,
        start_at: datetime,
        end_at: datetime,
        exclude_id: UUID | None = None,
    ) -> Booking | None:
        query = select(BookingModel).options(selectinload(BookingModel.participants)).where(
            BookingModel.room_id == room_id,
            BookingModel.status == BookingStatusEnum.ACTIVE,
            BookingModel.start_at < end_at,
            BookingModel.end_at > start_at,
        )
        if exclude_id:
            query = query.where(BookingModel.id != exclude_id)

        result = await self.session.execute(query)
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def create(
        self,
        title: str,
        room_id: UUID,
        user_id: UUID,
        start_at: datetime,
        end_at: datetime,
        participant_emails: list[str],
    ) -> Booking:
        model = BookingModel(
            title=title,
            room_id=room_id,
            user_id=user_id,
            start_at=start_at,
            end_at=end_at,
        )
        self.session.add(model)
        await self.session.flush()

        for email in participant_emails:
            participant = BookingParticipantModel(
                booking_id=model.id,
                email=email,
            )
            self.session.add(participant)

        await self.session.flush()
        # recarrega o model com participantes via nova query com selectinload
        result2 = await self.session.execute(
            select(BookingModel)
            .where(BookingModel.id == model.id)
            .options(selectinload(BookingModel.participants))
        )
        model = result2.scalar_one()
        return _to_entity(model)

    async def update(
        self,
        booking_id: UUID,
        title: str | None,
        start_at: datetime | None,
        end_at: datetime | None,
        participant_emails: list[str] | None,
    ) -> Booking | None:
        result = await self.session.execute(
            select(BookingModel)
            .where(BookingModel.id == booking_id)
            .options(selectinload(BookingModel.participants))
        )
        model = result.scalar_one_or_none()
        if not model:
            return None

        if title is not None:
            model.title = title
        if start_at is not None:
            model.start_at = start_at
        if end_at is not None:
            model.end_at = end_at

        if participant_emails is not None:
            for p in list(model.participants):
                await self.session.delete(p)
            await self.session.flush()
            for email in participant_emails:
                self.session.add(
                    BookingParticipantModel(booking_id=model.id, email=email)
                )

        await self.session.flush()
        await self.session.refresh(model)
        return _to_entity(model)

    async def cancel(self, booking_id: UUID) -> Booking | None:
        result = await self.session.execute(
            select(BookingModel)
            .where(BookingModel.id == booking_id)
            .options(selectinload(BookingModel.participants))
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        model.status = BookingStatusEnum.CANCELLED
        await self.session.flush()
        result2 = await self.session.execute(
            select(BookingModel)
            .where(BookingModel.id == booking_id)
            .options(selectinload(BookingModel.participants))
        )
        return _to_entity(result2.scalar_one())
