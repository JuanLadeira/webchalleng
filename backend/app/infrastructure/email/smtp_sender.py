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


# ── Helpers ─────────────────────────────────────────────────────────────────

def _fmt_dt(iso: str) -> str:
    from datetime import datetime, timezone
    dt = datetime.fromisoformat(iso).astimezone(timezone.utc)
    return dt.strftime("%d/%m/%Y às %H:%M (UTC)")


def _base_template(accent: str, icon: str, headline: str, body_rows: str, notes: str | None = None) -> str:
    notes_block = ""
    if notes:
        import html as _html
        escaped = _html.escape(notes).replace("\n", "<br>")
        notes_block = f"""
        <tr>
          <td style="padding:20px 32px 0">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#9ca3af">
              Observações
            </p>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;background:#f9fafb;border-left:3px solid {accent};border-radius:4px;padding:10px 14px">
              {escaped}
            </p>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{headline}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="background:#f3f4f6;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
               style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.10)">

          <!-- Header -->
          <tr>
            <td style="background:{accent};padding:28px 32px">
              <p style="margin:0;font-size:28px;line-height:1">{icon}</p>
              <h1 style="margin:10px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3">
                {headline}
              </h1>
            </td>
          </tr>

          <!-- Info rows -->
          <tr>
            <td style="padding:24px 32px 0">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                     style="border-collapse:collapse">
                {body_rows}
              </table>
            </td>
          </tr>

          <!-- Notes -->
          {notes_block}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 28px">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
                Você recebeu este e-mail porque está listado como participante de uma reserva
                no sistema de salas de reunião.<br>
                Caso não reconheça esta reserva, entre em contato com o organizador.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _info_row(label: str, value: str) -> str:
    return f"""<tr>
  <td style="padding:6px 0;width:110px;vertical-align:top;font-size:13px;color:#6b7280;font-weight:500">
    {label}
  </td>
  <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600">
    {value}
  </td>
</tr>"""


# ── Templates ────────────────────────────────────────────────────────────────

def booking_created_email(payload: dict) -> tuple[str, str]:
    title = payload.get("title", "Reserva")
    start = _fmt_dt(payload.get("start_at", ""))
    end = _fmt_dt(payload.get("end_at", ""))
    notes = payload.get("notes")
    participants: list[str] = payload.get("participants", [])

    rows = _info_row("Título", title)
    rows += _info_row("Início", start)
    rows += _info_row("Término", end)
    if participants:
        rows += _info_row("Participantes", "<br>".join(participants))

    subject = f"Reserva confirmada: {title}"
    html = _base_template(
        accent="#2563eb",
        icon="✅",
        headline="Reserva confirmada!",
        body_rows=rows,
        notes=notes,
    )
    return subject, html


def booking_updated_email(payload: dict) -> tuple[str, str]:
    title = payload.get("title", "Reserva")
    start = _fmt_dt(payload.get("start_at", ""))
    end = _fmt_dt(payload.get("end_at", ""))
    notes = payload.get("notes")
    participants: list[str] = payload.get("participants", [])

    rows = _info_row("Título", title)
    rows += _info_row("Novo início", start)
    rows += _info_row("Novo término", end)
    if participants:
        rows += _info_row("Participantes", "<br>".join(participants))

    subject = f"Reserva atualizada: {title}"
    html = _base_template(
        accent="#d97706",
        icon="✏️",
        headline="Reserva atualizada",
        body_rows=rows,
        notes=notes,
    )
    return subject, html


def booking_canceled_email(payload: dict) -> tuple[str, str]:
    title = payload.get("title", "Reserva")
    start = _fmt_dt(payload.get("start_at", ""))
    notes = payload.get("notes")

    rows = _info_row("Título", title)
    rows += _info_row("Estava marcada para", start)

    subject = f"Reserva cancelada: {title}"
    html = _base_template(
        accent="#dc2626",
        icon="❌",
        headline="Reserva cancelada",
        body_rows=rows,
        notes=notes,
    )
    return subject, html
