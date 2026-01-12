import os
import smtplib
from email.message import EmailMessage


def send_email(to_email: str, subject: str, body: str) -> dict:
    """Send an email.

    If SMTP is not configured, falls back to console output (useful for local tests).
    """

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_username
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes", "y"}

    if not smtp_host or not smtp_from:
        # Console fallback for quick verification
        print("[EMAIL][CONSOLE] to=", to_email)
        print("[EMAIL][CONSOLE] subject=", subject)
        print("[EMAIL][CONSOLE] body=", body)
        return {"mode": "console"}

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        if use_tls:
            server.starttls()
        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)
        server.send_message(msg)

    return {"mode": "smtp", "host": smtp_host, "port": smtp_port, "from": smtp_from}
