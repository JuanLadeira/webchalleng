"""Testes unitários para smtp_sender — sem dependência de SMTP real."""
from unittest.mock import MagicMock, patch


# ── send_email ──────────────────────────────────────────────────────────────

def test_send_email_empty_recipients_returns_early():
    from app.infrastructure.email.smtp_sender import send_email
    # Não deve chamar smtplib se a lista estiver vazia
    with patch("smtplib.SMTP") as mock_smtp:
        send_email(to=[], subject="Assunto", html_body="<p>corpo</p>")
        mock_smtp.assert_not_called()


def test_send_email_calls_smtp_send_message():
    from app.infrastructure.email.smtp_sender import send_email

    mock_server = MagicMock()
    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_smtp_cls.return_value.__enter__ = lambda s: mock_server
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_email(to=["dest@example.com"], subject="Assunto", html_body="<p>oi</p>")

        mock_server.send_message.assert_called_once()


def test_send_email_with_tls_and_auth():
    from app.infrastructure.email.smtp_sender import send_email
    from app.config import settings

    mock_server = MagicMock()
    with (
        patch("smtplib.SMTP") as mock_smtp_cls,
        patch.object(settings, "SMTP_TLS", True),
        patch.object(settings, "SMTP_USER", "user@smtp.com"),
        patch.object(settings, "SMTP_PASSWORD", "secret"),
    ):
        mock_smtp_cls.return_value.__enter__ = lambda s: mock_server
        mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

        send_email(to=["dest@example.com"], subject="TLS", html_body="<p>tls</p>")

        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("user@smtp.com", "secret")


# ── booking_updated_email ────────────────────────────────────────────────────

def test_booking_updated_email_returns_subject_and_html():
    from app.infrastructure.email.smtp_sender import booking_updated_email

    payload = {
        "title": "Sprint Review",
        "start_at": "2026-04-19T10:00:00+00:00",
        "end_at": "2026-04-19T11:00:00+00:00",
        "participants": [],
        "notes": None,
    }
    subject, html = booking_updated_email(payload)
    assert "Sprint Review" in subject
    assert "atualizada" in subject.lower()
    assert "Sprint Review" in html


def test_booking_updated_email_with_participants():
    from app.infrastructure.email.smtp_sender import booking_updated_email

    payload = {
        "title": "Review",
        "start_at": "2026-04-19T10:00:00+00:00",
        "end_at": "2026-04-19T11:00:00+00:00",
        "participants": ["alice@ex.com", "bob@ex.com"],
        "notes": None,
    }
    _, html = booking_updated_email(payload)
    assert "alice@ex.com" in html


# ── booking_canceled_email ───────────────────────────────────────────────────

def test_booking_canceled_email_returns_subject_and_html():
    from app.infrastructure.email.smtp_sender import booking_canceled_email

    payload = {
        "title": "Reunião cancelada",
        "start_at": "2026-04-19T14:00:00+00:00",
        "end_at": "2026-04-19T15:00:00+00:00",
        "participants": [],
        "notes": None,
    }
    subject, html = booking_canceled_email(payload)
    assert "Reunião cancelada" in subject
    assert "cancelad" in subject.lower()
    assert "Reunião cancelada" in html


def test_booking_canceled_email_with_notes():
    from app.infrastructure.email.smtp_sender import booking_canceled_email

    payload = {
        "title": "Reunião",
        "start_at": "2026-04-19T14:00:00+00:00",
        "end_at": "2026-04-19T15:00:00+00:00",
        "participants": [],
        "notes": "Cancelada por motivo de força maior.",
    }
    _, html = booking_canceled_email(payload)
    assert "Cancelada por motivo" in html


# ── _base_template com notes ─────────────────────────────────────────────────

def test_base_template_renders_notes_block():
    from app.infrastructure.email.smtp_sender import _base_template

    html = _base_template(
        accent="#ff0000",
        icon="📌",
        headline="Título",
        body_rows="<tr></tr>",
        notes="Observação importante & especial",
    )
    assert "Observações" in html
    # HTML-escaped ampersand
    assert "Observação importante" in html


def test_booking_created_email_with_notes_and_participants():
    from app.infrastructure.email.smtp_sender import booking_created_email

    payload = {
        "title": "Planning",
        "start_at": "2026-04-19T09:00:00+00:00",
        "end_at": "2026-04-19T10:00:00+00:00",
        "participants": ["carol@ex.com"],
        "notes": "Trazer laptop.",
    }
    subject, html = booking_created_email(payload)
    assert "Planning" in subject
    assert "carol@ex.com" in html
    assert "Trazer laptop" in html
