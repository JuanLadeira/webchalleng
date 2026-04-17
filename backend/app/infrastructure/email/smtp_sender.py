from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings


async def send_email(to: list[str], subject: str, body: str) -> None:
    if not to:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(body, "plain"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        use_tls=settings.SMTP_TLS,
        username=settings.SMTP_USER or None,
        password=settings.SMTP_PASSWORD or None,
    )


def build_email_body(event_type: str, payload: dict) -> tuple[str, str]:
    title = payload.get("title", "—")
    room_id = payload.get("room_id", "—")
    start_at = payload.get("start_at", "—")
    end_at = payload.get("end_at", "—")

    labels = {
        "BOOKING_CREATED": "Nova reserva criada",
        "BOOKING_UPDATED": "Reserva atualizada",
        "BOOKING_CANCELED": "Reserva cancelada",
    }
    subject = labels.get(event_type, "Atualização de reserva")

    body = (
        f"{subject}\n"
        f"{'=' * len(subject)}\n\n"
        f"Título:  {title}\n"
        f"Sala:    {room_id}\n"
        f"Início:  {start_at}\n"
        f"Término: {end_at}\n"
    )
    return subject, body
