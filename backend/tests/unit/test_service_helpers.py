"""Testes unitários dos helpers internos do booking_service."""
from unittest.mock import MagicMock

from sqlalchemy.exc import IntegrityError

from app.application.services.booking_service import _is_exclusion_violation, _is_fk_violation


def _make_integrity_error(orig) -> IntegrityError:
    exc = MagicMock(spec=IntegrityError)
    exc.orig = orig
    return exc


def test_is_exclusion_violation_orig_none():
    exc = _make_integrity_error(orig=None)
    assert _is_exclusion_violation(exc) is False


def test_is_exclusion_violation_with_exclusion_error():
    from asyncpg.exceptions import ExclusionViolationError
    orig = MagicMock(spec=ExclusionViolationError)
    exc = _make_integrity_error(orig=orig)
    assert _is_exclusion_violation(exc) is True


def test_is_exclusion_violation_with_unique_error():
    from asyncpg import UniqueViolationError
    orig = MagicMock(spec=UniqueViolationError)
    exc = _make_integrity_error(orig=orig)
    assert _is_exclusion_violation(exc) is True


def test_is_exclusion_violation_with_unrelated_error():
    exc = _make_integrity_error(orig=ValueError("unrelated"))
    assert _is_exclusion_violation(exc) is False


def test_is_fk_violation_orig_none():
    exc = _make_integrity_error(orig=None)
    assert _is_fk_violation(exc) is False


def test_is_fk_violation_with_fk_error():
    from asyncpg.exceptions import ForeignKeyViolationError
    orig = MagicMock(spec=ForeignKeyViolationError)
    exc = _make_integrity_error(orig=orig)
    assert _is_fk_violation(exc) is True


def test_is_fk_violation_with_unrelated_error():
    exc = _make_integrity_error(orig=ValueError("unrelated"))
    assert _is_fk_violation(exc) is False
