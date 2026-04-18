import logging
import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(*, to: list[str], subject: str, html_body: str) -> None:
    """Envia um e-mail via SMTP (síncrono — chamado pelo worker Celery)."""
    if not to:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)

    logger.info("E-mail enviado para %s — assunto: %s", to, subject)


# ── Templates ──────────────────────────────────────────────────────────────

def _fmt_dt(iso: str) -> str:
    from datetime import datetime, timezone
    dt = datetime.fromisoformat(iso).astimezone(timezone.utc)
    return dt.strftime("%d/%m/%Y %H:%M UTC")


def booking_created_email(payload: dict) -> tuple[str, str]:
    title = payload.get("title", "Reserva")
    start = _fmt_dt(payload.get("start_at", ""))
    end = _fmt_dt(payload.get("end_at", ""))
    subject = f"Reserva confirmada: {title}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1d4ed8">Reserva confirmada</h2>
      <p><strong>{title}</strong></p>
      <table style="border-collapse:collapse;width:100%">
        <tr>
          <td style="padding:6px 0;color:#6b7280">In&iacute;cio</td>
          <td style="padding:6px 0"><strong>{start}</strong></td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">Fim</td>
          <td style="padding:6px 0"><strong>{end}</strong></td>
        </tr>
      </table>
      <p style="margin-top:16px;color:#6b7280;font-size:13px">
        Voc&ecirc; recebeu este e-mail porque foi adicionado como participante.
      </p>
    </div>
    """
    return subject, html


def booking_updated_email(payload: dict) -> tuple[str, str]:
    title = payload.get("title", "Reserva")
    start = _fmt_dt(payload.get("start_at", ""))
    end = _fmt_dt(payload.get("end_at", ""))
    subject = f"Reserva atualizada: {title}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#d97706">Reserva atualizada</h2>
      <p><strong>{title}</strong></p>
      <table style="border-collapse:collapse;width:100%">
        <tr>
          <td style="padding:6px 0;color:#6b7280">Novo in&iacute;cio</td>
          <td style="padding:6px 0"><strong>{start}</strong></td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280">Novo fim</td>
          <td style="padding:6px 0"><strong>{end}</strong></td>
        </tr>
      </table>
    </div>
    """
    return subject, html


def booking_canceled_email(payload: dict) -> tuple[str, str]:
    title = payload.get("title", "Reserva")
    start = _fmt_dt(payload.get("start_at", ""))
    subject = f"Reserva cancelada: {title}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#dc2626">Reserva cancelada</h2>
      <p>A reserva <strong>{title}</strong> marcada para <strong>{start}</strong>
         foi cancelada.</p>
    </div>
    """
    return subject, html
