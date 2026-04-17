from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.domain.entities.booking import Booking, BookingStatus
from app.domain.entities.outbox_event import EventType, OutboxEvent, OutboxStatus
from app.domain.entities.user import User, UserRole

NOW = datetime.now(tz=timezone.utc)


class TestBookingEntity:
    def _make_booking(self, **kwargs):
        defaults = dict(
            title="Reunião",
            room_id=uuid4(),
            user_id=uuid4(),
            start_at=NOW,
            end_at=NOW + timedelta(hours=1),
        )
        return Booking(**{**defaults, **kwargs})

    def test_default_status_is_active(self):
        booking = self._make_booking()
        assert booking.status == BookingStatus.ACTIVE
        assert booking.is_active is True

    def test_cancel_changes_status(self):
        booking = self._make_booking()
        booking.cancel()
        assert booking.status == BookingStatus.CANCELLED
        assert booking.is_active is False

    def test_cancel_updates_updated_at(self):
        booking = self._make_booking()
        before = booking.updated_at
        booking.cancel()
        assert booking.updated_at >= before


class TestOutboxEventEntity:
    def _make_event(self, **kwargs):
        defaults = dict(
            event_type=EventType.BOOKING_CREATED,
            booking_id=uuid4(),
            payload={"title": "Reunião"},
        )
        return OutboxEvent(**{**defaults, **kwargs})

    def test_default_status_is_pending(self):
        event = self._make_event()
        assert event.status == OutboxStatus.PENDING

    def test_can_retry_when_pending(self):
        event = self._make_event()
        assert event.can_retry() is True

    def test_cannot_retry_when_processed(self):
        event = self._make_event()
        event.mark_processed()
        assert event.can_retry() is False

    def test_mark_processed_sets_status_and_timestamp(self):
        event = self._make_event()
        event.mark_processed()
        assert event.status == OutboxStatus.PROCESSED
        assert event.processed_at is not None

    def test_mark_failed_increments_attempts(self):
        event = self._make_event()
        event.mark_failed()
        assert event.attempts == 1
        assert event.status == OutboxStatus.PENDING

    def test_mark_failed_sets_failed_when_max_reached(self):
        event = self._make_event(max_attempts=2)
        event.mark_failed()
        event.mark_failed()
        assert event.status == OutboxStatus.FAILED
        assert event.can_retry() is False

    def test_idempotency_key_is_unique_per_instance(self):
        e1 = self._make_event()
        e2 = self._make_event()
        assert e1.idempotency_key != e2.idempotency_key


class TestUserEntity:
    def _make_user(self, **kwargs):
        defaults = dict(
            email="user@example.com",
            name="Usuário Teste",
            password_hash="hashed",
        )
        return User(**{**defaults, **kwargs})

    def test_default_role_is_member(self):
        user = self._make_user()
        assert user.role == UserRole.MEMBER

    def test_default_is_active(self):
        user = self._make_user()
        assert user.is_active is True

    def test_unique_id_per_instance(self):
        u1 = self._make_user()
        u2 = self._make_user()
        assert u1.id != u2.id

    def test_owner_role(self):
        user = self._make_user(role=UserRole.OWNER)
        assert user.role == UserRole.OWNER

    def test_inactive_user(self):
        user = self._make_user(is_active=False)
        assert user.is_active is False
