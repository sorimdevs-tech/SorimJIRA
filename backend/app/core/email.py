import os
import ssl
import socket
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, formatdate, make_msgid
from app.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    @property
    def host(self) -> str:
        return os.environ.get("SMTP_HOST") or settings.SMTP_HOST or "smtp.gmail.com"

    @property
    def port(self) -> int:
        val = os.environ.get("SMTP_PORT") or settings.SMTP_PORT or 465
        try:
            return int(val)
        except Exception:
            return 465

    @property
    def username(self) -> str:
        u = os.environ.get("MAIL_USERNAME") or settings.MAIL_USERNAME or ""
        return u.strip()

    @property
    def password(self) -> str:
        p = os.environ.get("MAIL_PASSWORD") or settings.MAIL_PASSWORD or ""
        return p.replace(" ", "").strip()

    def _send_message(self, msg: MIMEMultipart, to: str) -> bool:
        user_name = self.username
        pass_word = self.password
        host = self.host
        port = self.port

        # Strategy 1: If port 465 (or on Render/cloud), connect via SMTP_SSL
        if port == 465:
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(host, 465, timeout=15, context=context) as server:
                    server.login(user_name, pass_word)
                    server.sendmail(user_name, [to], msg.as_string())
                logger.info(f"✅ Email delivered to {to} via SMTP_SSL (Port 465)")
                return True
            except Exception as e:
                logger.error(f"❌ SMTP_SSL (465) failed for {to}: {e}")
                return False

        # Strategy 2: If port 587 (or other), try STARTTLS with automatic 465 SSL fallback
        try:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.starttls()
                server.login(user_name, pass_word)
                server.sendmail(user_name, [to], msg.as_string())
            logger.info(f"✅ Email delivered to {to} via SMTP (Port {port})")
            return True
        except (OSError, smtplib.SMTPException) as e:
            logger.warning(f"⚠️ SMTP port {port} failed ({e}). Falling back to SMTP_SSL port 465...")
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15, context=context) as server:
                    server.login(user_name, pass_word)
                    server.sendmail(user_name, [to], msg.as_string())
                logger.info(f"✅ Email delivered to {to} via fallback SMTP_SSL (Port 465)")
                return True
            except Exception as e2:
                logger.error(f"❌ Both Port {port} and Port 465 failed for {to}: {e2}")
                return False

    def send_email(self, to: str, sender_email: str = None, subject: str = "", text: str = "", html: str = None):
        """
        Send an email on behalf of an action-doer or system with HTML and Plain Text fallback.
        """
        user_name = self.username
        pass_word = self.password

        if not user_name or not pass_word:
            logger.warning(
                f"\n========== [SMTP DISPATCH (MOCK MODE - NO CREDENTIALS)] ==========\n"
                f"To: {to}\n"
                f"From: {sender_email or 'Sorim System'} ({user_name or 'unconfigured'})\n"
                f"Subject: {subject}\n"
                f"Body:\n{text}\n"
                f"===================================================================\n"
            )
            return

        try:
            msg = MIMEMultipart("alternative")
            msg["Date"] = formatdate(localtime=True)
            msg["Message-ID"] = make_msgid(domain="gmail.com")
            msg["Subject"] = subject
            msg["To"] = to
            msg["From"] = formataddr(("IntelliSprint Platform", user_name))
            
            if sender_email and sender_email.strip():
                msg["Reply-To"] = sender_email.strip()

            msg.attach(MIMEText(text, "plain", "utf-8"))
            if html:
                msg.attach(MIMEText(html, "html", "utf-8"))

            self._send_message(msg, to)
        except Exception as e:
            logger.error(f"❌ Error preparing email to {to}: {e}")

    def send_system_email(self, to: str, subject: str = "", text: str = "", html: str = None):
        """
        Send a system-only email (MFA codes, password resets, status alerts).
        """
        user_name = self.username
        pass_word = self.password

        if not user_name or not pass_word:
            logger.warning(
                f"\n====== [SYSTEM SMTP DISPATCH (MOCK MODE - NO CREDENTIALS)] ======\n"
                f"To: {to}\n"
                f"Subject: {subject}\n"
                f"Body:\n{text}\n"
                f"=================================================================\n"
            )
            return

        try:
            msg = MIMEMultipart("alternative")
            msg["Date"] = formatdate(localtime=True)
            msg["Message-ID"] = make_msgid(domain="gmail.com")
            msg["Subject"] = subject
            msg["To"] = to
            msg["From"] = formataddr(("IntelliSprint System", user_name))
            
            msg.attach(MIMEText(text, "plain", "utf-8"))
            if html:
                msg.attach(MIMEText(html, "html", "utf-8"))

            self._send_message(msg, to)
        except Exception as e:
            logger.error(f"❌ Error preparing system email to {to}: {e}")

email_service = EmailService()
