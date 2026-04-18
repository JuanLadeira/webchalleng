from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.application.schemas.booking import BookingOut
from app.application.schemas.room import RoomCreate, RoomOut, RoomUpdate
from app.application.services.booking_service import BookingService
from app.application.services.room_service import RoomServiceDep
from app.infrastructure.database.session import get_db

router = APIRouter(prefix="/rooms", tags=["Rooms"])


@router.post("", response_model=RoomOut, status_code=201)
async def create_room(data: RoomCreate, service: RoomServiceDep, _: CurrentUser):
    return await service.create(data)


@router.get("", response_model=list[RoomOut])
async def list_rooms(service: RoomServiceDep, _: CurrentUser, active_only: bool = True):
    return await service.list_all(active_only=active_only)


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(room_id: UUID, service: RoomServiceDep, _: CurrentUser):
    return await service.get(room_id)


@router.patch("/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: UUID, data: RoomUpdate, service: RoomServiceDep, _: CurrentUser
):
    return await service.update(room_id, data)


@router.delete("/{room_id}", status_code=204)
async def delete_room(room_id: UUID, service: RoomServiceDep, _: CurrentUser):
    await service.delete(room_id)


@router.get("/{room_id}/bookings", response_model=list[BookingOut])
async def list_room_bookings(
    room_id: UUID,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
) -> list[BookingOut]:
    svc = BookingService(session)
    bookings = await svc.repo.list_by_room(room_id)
    from app.application.services.booking_service import _to_out
    return [_to_out(b) for b in bookings]
