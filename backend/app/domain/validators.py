from datetime import datetime, timedelta

from app.domain.exceptions import BookingDurationError, InvalidDateError

MIN_DURATION = timedelta(minutes=30)
MAX_DURATION = timedelta(hours=8)


def validate_booking_dates(start_at: datetime, end_at: datetime) -> None:
    if start_at.tzinfo is None or end_at.tzinfo is None:
        raise InvalidDateError("As datas devem conter timezone (ISO 8601).")
    if start_at >= end_at:
        raise InvalidDateError("O horário de início deve ser anterior ao horário de término.")


def validate_booking_duration(start_at: datetime, end_at: datetime) -> None:
    duration = end_at - start_at
    if duration < MIN_DURATION:
        raise BookingDurationError(
            "A reserva deve ter no mínimo 30 minutos de duração."
        )
    if duration > MAX_DURATION:
        raise BookingDurationError(
            "A reserva não pode ultrapassar 8 horas de duração."
        )


def validate_booking(start_at: datetime, end_at: datetime) -> None:
    """Executa todas as validações de data/duração em sequência."""
    validate_booking_dates(start_at, end_at)
    validate_booking_duration(start_at, end_at)
