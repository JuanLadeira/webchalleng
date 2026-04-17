from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.application.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from app.application.services.booking_service import BookingServiceDep

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    data: BookingCreate,
    service: BookingServiceDep,
    current_user: CurrentUser,
):
    return await service.create(data, organizer_id=current_user.id)


@router.get("", response_model=list[BookingOut])
async def list_bookings(service: BookingServiceDep, current_user: CurrentUser):
    return await service.list_mine(user_id=current_user.id)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: UUID,
    service: BookingServiceDep,
    current_user: CurrentUser,
):
    return await service.get(booking_id, user_id=current_user.id)


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: UUID,
    data: BookingUpdate,
    service: BookingServiceDep,
    current_user: CurrentUser,
):
    return await service.update(booking_id, data, user_id=current_user.id)


@router.delete("/{booking_id}", response_model=BookingOut)
async def cancel_booking(
    booking_id: UUID,
    service: BookingServiceDep,
    current_user: CurrentUser,
):
    return await service.cancel(booking_id, user_id=current_user.id)
