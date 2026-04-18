import enum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


class RecurrenceType(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"


class ParticipantOut(BaseModel):
    id: UUID
    email: str
    name: str

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    start_at: datetime
    end_at: datetime
    participant_emails: list[EmailStr] = Field(default_factory=list)
    recurrence: RecurrenceType = RecurrenceType.NONE
    recurrence_count: int = Field(1, ge=1, le=52)

    @model_validator(mode="after")
    def validate_dates(self):
        from app.domain.exceptions import DomainError
        from app.domain.validators import validate_booking

        try:
            validate_booking(self.start_at, self.end_at)
        except DomainError as e:
            raise ValueError(str(e)) from e
        return self


class BookingUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    start_at: datetime | None = None
    end_at: datetime | None = None
    participant_emails: list[EmailStr] | None = None

    @model_validator(mode="after")
    def validate_dates_if_present(self):
        if self.start_at and self.end_at:
            from app.domain.exceptions import DomainError
            from app.domain.validators import validate_booking

            try:
                validate_booking(self.start_at, self.end_at)
            except DomainError as e:
                raise ValueError(str(e)) from e
        return self


class BookingOut(BaseModel):
    id: UUID
    title: str
    room_id: UUID
    user_id: UUID
    start_at: datetime
    end_at: datetime
    status: str
    participants: list[ParticipantOut]

    model_config = {"from_attributes": True}
