from datetime import datetime, timedelta, timezone

import pytest

from app.domain.exceptions import BookingDurationError, InvalidDateError
from app.domain.validators import (
    validate_booking,
    validate_booking_dates,
    validate_booking_duration,
)

NOW = datetime.now(tz=timezone.utc)


class TestValidateBookingDates:
    def test_valid_dates(self):
        validate_booking_dates(NOW, NOW + timedelta(hours=1))

    def test_start_equals_end_raises(self):
        with pytest.raises(InvalidDateError):
            validate_booking_dates(NOW, NOW)

    def test_start_after_end_raises(self):
        with pytest.raises(InvalidDateError):
            validate_booking_dates(NOW + timedelta(hours=1), NOW)

    def test_missing_timezone_start_raises(self):
        naive = datetime(2026, 1, 1, 10, 0, 0)  # sem tzinfo
        with pytest.raises(InvalidDateError):
            validate_booking_dates(naive, NOW)

    def test_missing_timezone_end_raises(self):
        naive = datetime(2026, 1, 1, 12, 0, 0)  # sem tzinfo
        with pytest.raises(InvalidDateError):
            validate_booking_dates(NOW, naive)


class TestValidateBookingDuration:
    def test_valid_duration_30min(self):
        validate_booking_duration(NOW, NOW + timedelta(minutes=30))

    def test_valid_duration_8h(self):
        validate_booking_duration(NOW, NOW + timedelta(hours=8))

    def test_valid_duration_middle(self):
        validate_booking_duration(NOW, NOW + timedelta(hours=2))

    def test_too_short_raises(self):
        with pytest.raises(BookingDurationError):
            validate_booking_duration(NOW, NOW + timedelta(minutes=29))

    def test_15min_raises(self):
        with pytest.raises(BookingDurationError):
            validate_booking_duration(NOW, NOW + timedelta(minutes=15))

    def test_too_long_raises(self):
        with pytest.raises(BookingDurationError):
            validate_booking_duration(NOW, NOW + timedelta(hours=8, minutes=1))


class TestValidateBooking:
    def test_valid_booking(self):
        validate_booking(NOW, NOW + timedelta(hours=1))

    def test_invalid_dates_propagates(self):
        with pytest.raises(InvalidDateError):
            validate_booking(NOW, NOW)

    def test_invalid_duration_propagates(self):
        with pytest.raises(BookingDurationError):
            validate_booking(NOW, NOW + timedelta(minutes=5))
