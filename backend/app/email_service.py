"""Email sending utility using Python's smtplib (no extra dependencies)."""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@varzeaprime.com.br")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Varzea Prime")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://varzeaprime.com.br")


def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Send email via SMTP. Returns True on success, False on failure."""
    if not is_smtp_configured():
        logger.warning("SMTP not configured, skipping email to %s", to)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
        msg["To"] = to
        msg["Subject"] = subject

        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


def send_verification_email(to: str, name: str, token: str) -> bool:
    """Send the email verification link."""
    verify_url = f"{APP_BASE_URL}/auth?verify={token}"
    subject = "Verifique seu email - Varzea Prime"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 500px; margin: 0 auto; padding: 32px; background: #18181b;
                border-radius: 16px; color: #e4e4e7;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #f59e0b; margin: 0; font-size: 24px;">Varzea Prime</h2>
      </div>
      <p style="margin: 0 0 16px;">Ola <strong>{name}</strong>,</p>
      <p style="margin: 0 0 24px; color: #a1a1aa;">
        Clique no botao abaixo para verificar seu email e completar seu cadastro:
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{verify_url}"
           style="display: inline-block; background: #f59e0b; color: #18181b;
                  padding: 14px 32px; border-radius: 10px; text-decoration: none;
                  font-weight: bold; font-size: 15px;">
          Verificar Email
        </a>
      </div>
      <p style="color: #71717a; font-size: 12px; margin: 24px 0 0; border-top: 1px solid #27272a; padding-top: 16px;">
        Se voce nao criou esta conta, ignore este email.<br/>
        Este link expira em 24 horas.
      </p>
    </div>
    """
    text = f"Ola {name}, verifique seu email acessando: {verify_url}"
    return send_email(to, subject, html, text)
