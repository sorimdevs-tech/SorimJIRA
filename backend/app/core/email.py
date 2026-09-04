import os
import ssl
import json
import logging
import threading
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr, formatdate, make_msgid
from typing import Optional
import urllib.request
import urllib.error

from app.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    @property
    def host(self) -> str:
        return os.environ.get("SMTP_HOST") or settings.SMTP_HOST or "smtp.gmail.com"

    @property
    def port(self) -> int:
        val = os.environ.get("SMTP_PORT") or settings.SMTP_PORT or 587
        try:
            return int(val)
        except Exception:
            return 587

    @property
    def username(self) -> str:
        u = os.environ.get("MAIL_USERNAME") or settings.MAIL_USERNAME or ""
        return u.strip()

    @property
    def password(self) -> str:
        p = os.environ.get("MAIL_PASSWORD") or settings.MAIL_PASSWORD or ""
        return p.replace(" ", "").strip()

    @property
    def resend_api_key(self) -> str:
        return (os.environ.get("RESEND_API_KEY") or settings.RESEND_API_KEY or "").strip()

    @property
    def brevo_api_key(self) -> str:
        return (os.environ.get("BREVO_API_KEY") or settings.BREVO_API_KEY or "").strip()

    @property
    def sendgrid_api_key(self) -> str:
        return (os.environ.get("SENDGRID_API_KEY") or settings.SENDGRID_API_KEY or "").strip()

    @property
    def mail_from(self) -> str:
        return (os.environ.get("MAIL_FROM") or settings.MAIL_FROM or "").strip()

    def _send_via_resend(self, to: str, sender_email: Optional[str], subject: str, text: str, html: Optional[str]) -> bool:
        """Send email via Resend HTTP REST API (port 443 - Works seamlessly on Render/Cloud)."""
        api_key = self.resend_api_key
        # Resend allows 'onboarding@resend.dev' for free test domain, or any verified domain.
        from_address = self.mail_from or "IntelliSprint <onboarding@resend.dev>"
        
        payload = {
            "from": from_address,
            "to": [to],
            "subject": subject,
            "text": text or ""
        }
        if html:
            payload["html"] = html
        if sender_email and sender_email.strip():
            payload["reply_to"] = sender_email.strip()

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "IntelliSprint-Backend/1.0"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                if res.status in (200, 201):
                    logger.info(f"✅ [Resend API] Email delivered successfully to {to}")
                    return True
                logger.warning(f"⚠️ [Resend API] Unexpected status {res.status}: {res.read().decode('utf-8')}")
                return False
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"❌ [Resend API HTTPError] Code {e.code} for {to}: {err_body}")
            return False
        except Exception as e:
            logger.error(f"❌ [Resend API Error] Failed for {to}: {e}")
            return False

    def _send_via_brevo(self, to: str, sender_email: Optional[str], subject: str, text: str, html: Optional[str]) -> bool:
        """Send email via Brevo (Sendinblue) HTTP REST API (port 443)."""
        api_key = self.brevo_api_key
        sender_addr = self.mail_from or self.username or "noreply@flowsync.com"
        
        payload = {
            "sender": {"name": "IntelliSprint Platform", "email": sender_addr},
            "to": [{"email": to}],
            "subject": subject,
            "textContent": text or ""
        }
        if html:
            payload["htmlContent"] = html
        if sender_email and sender_email.strip():
            payload["replyTo"] = {"email": sender_email.strip()}

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=data,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json",
                "User-Agent": "IntelliSprint-Backend/1.0"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                if res.status in (200, 201):
                    logger.info(f"✅ [Brevo API] Email delivered successfully to {to}")
                    return True
                logger.warning(f"⚠️ [Brevo API] Unexpected status {res.status}: {res.read().decode('utf-8')}")
                return False
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"❌ [Brevo API HTTPError] Code {e.code} for {to}: {err_body}")
            return False
        except Exception as e:
            logger.error(f"❌ [Brevo API Error] Failed for {to}: {e}")
            return False

    def _send_via_sendgrid(self, to: str, sender_email: Optional[str], subject: str, text: str, html: Optional[str]) -> bool:
        """Send email via SendGrid HTTP REST API (port 443)."""
        api_key = self.sendgrid_api_key
        from_email = self.mail_from or self.username or "noreply@flowsync.com"
        
        content = [{"type": "text/plain", "value": text or ""}]
        if html:
            content.append({"type": "text/html", "value": html})

        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": from_email, "name": "IntelliSprint Platform"},
            "subject": subject,
            "content": content
        }
        if sender_email and sender_email.strip():
            payload["reply_to"] = {"email": sender_email.strip()}

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "IntelliSprint-Backend/1.0"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                if res.status in (200, 202):
                    logger.info(f"✅ [SendGrid API] Email delivered successfully to {to}")
                    return True
                logger.warning(f"⚠️ [SendGrid API] Unexpected status {res.status}: {res.read().decode('utf-8')}")
                return False
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.error(f"❌ [SendGrid API HTTPError] Code {e.code} for {to}: {err_body}")
            return False
        except Exception as e:
            logger.error(f"❌ [SendGrid API Error] Failed for {to}: {e}")
            return False

    def _send_via_smtp(self, msg: MIMEMultipart, to: str) -> bool:
        """Send email via standard SMTP / SMTP_SSL."""
        user_name = self.username
        pass_word = self.password
        host = self.host
        port = self.port

        # Strategy 1: If port 465, connect via SMTP_SSL
        if port == 465:
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(host, 465, timeout=10, context=context) as server:
                    server.login(user_name, pass_word)
                    server.sendmail(user_name, [to], msg.as_string())
                logger.info(f"✅ Email delivered to {to} via SMTP_SSL (Port 465)")
                return True
            except (OSError, smtplib.SMTPException) as e:
                if "[Errno 101]" in str(e) or "Network is unreachable" in str(e):
                    logger.error(
                        f"❌ [Render/Cloud Firewall Block] Outbound SMTP port 465 is blocked by hosting environment ([Errno 101]). "
                        f"Please configure RESEND_API_KEY or BREVO_API_KEY in your Render environment variables to send emails via HTTP REST API."
                    )
                else:
                    logger.error(f"❌ SMTP_SSL (465) failed for {to}: {e}")
                return False

        # Strategy 2: Port 587 (STARTTLS) with 465 fallback
        try:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.starttls()
                server.login(user_name, pass_word)
                server.sendmail(user_name, [to], msg.as_string())
            logger.info(f"✅ Email delivered to {to} via SMTP (Port {port})")
            return True
        except (OSError, smtplib.SMTPException) as e:
            if "[Errno 101]" in str(e) or "Network is unreachable" in str(e):
                logger.error(
                    f"❌ [Render/Cloud Firewall Block] Outbound SMTP port {port} is blocked by hosting provider ([Errno 101]). "
                    f"Please add RESEND_API_KEY or BREVO_API_KEY to Render Environment Variables to send emails via HTTPS port 443."
                )
                return False

            logger.warning(f"⚠️ SMTP port {port} failed ({e}). Falling back to SMTP_SSL port 465...")
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10, context=context) as server:
                    server.login(user_name, pass_word)
                    server.sendmail(user_name, [to], msg.as_string())
                logger.info(f"✅ Email delivered to {to} via fallback SMTP_SSL (Port 465)")
                return True
            except Exception as e2:
                logger.error(f"❌ Both Port {port} and Port 465 failed for {to}: {e2}")
                return False

    def _dispatch_sync(self, to: str, sender_email: Optional[str] = None, subject: str = "", text: str = "", html: Optional[str] = None) -> bool:
        """Internal synchronous dispatcher that prioritizes HTTP APIs before raw SMTP."""
        if not to or not to.strip():
            return False
            
        to = to.strip().lower()

        # 1. Check HTTP API Providers (Brevo / Resend / SendGrid)
        # HTTP REST APIs work on port 443 (HTTPS) which is NEVER blocked by Render / cloud providers
        if self.brevo_api_key:
            return self._send_via_brevo(to, sender_email, subject, text, html)

        if self.resend_api_key:
            return self._send_via_resend(to, sender_email, subject, text, html)

        if self.sendgrid_api_key:
            return self._send_via_sendgrid(to, sender_email, subject, text, html)

        # 2. Check SMTP configuration
        user_name = self.username
        pass_word = self.password

        if not user_name or not pass_word:
            logger.warning(
                f"\n========== [EMAIL DISPATCH (MOCK MODE - NO CREDENTIALS/API KEY)] ==========\n"
                f"To: {to}\n"
                f"From: {sender_email or 'IntelliSprint System'}\n"
                f"Subject: {subject}\n"
                f"Body:\n{text}\n"
                f"===========================================================================\n"
            )
            return True

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

            return self._send_via_smtp(msg, to)
        except Exception as e:
            logger.error(f"❌ Error preparing email to {to}: {e}")
            return False

    def send_email(
        self,
        to: str,
        sender_email: Optional[str] = None,
        subject: str = "",
        text: str = "",
        html: Optional[str] = None,
        background: bool = True
    ):
        """
        Send an email asynchronously in background thread so HTTP requests never block.
        """
        if background:
            t = threading.Thread(
                target=self._dispatch_sync,
                args=(to, sender_email, subject, text, html),
                daemon=True
            )
            t.start()
        else:
            self._dispatch_sync(to, sender_email, subject, text, html)

    def send_system_email(
        self,
        to: str,
        subject: str = "",
        text: str = "",
        html: Optional[str] = None,
        background: bool = True
    ):
        """
        Send a system-only email (MFA codes, temporary passwords, alerts).
        """
        self.send_email(to, None, subject, text, html, background=background)

email_service = EmailService()
