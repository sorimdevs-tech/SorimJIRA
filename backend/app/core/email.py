import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from app.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    @property
    def host(self) -> str:
        return settings.SMTP_HOST

    @property
    def port(self) -> int:
        return settings.SMTP_PORT

    @property
    def username(self) -> str:
        return settings.MAIL_USERNAME

    @property
    def password(self) -> str:
        return settings.MAIL_PASSWORD

    def send_email(self, to: str, sender_email: str = None, subject: str = "", text: str = "", html: str = None):
        """
        Send an email on behalf of an action-doer or system with HTML and Plain Text fallback.
        """
        user_name = self.username
        pass_word = self.password

        if not user_name or not pass_word:
            logger.info(
                f"\n========== [SMTP DISPATCH (MOCK MODE)] ==========\n"
                f"To: {to}\n"
                f"From: {sender_email or 'Sorim System'} ({user_name or 'unconfigured'})\n"
                f"Subject: {subject}\n"
                f"Body:\n{text}\n"
                f"==================================================\n"
            )
            return

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["To"] = to
            
            if sender_email and sender_email.strip():
                msg["From"] = formataddr((sender_email.strip(), user_name))
                msg["Reply-To"] = sender_email.strip()
            else:
                msg["From"] = formataddr(("IntelliSprint System", user_name))

            msg.attach(MIMEText(text, "plain", "utf-8"))
            if html:
                msg.attach(MIMEText(html, "html", "utf-8"))

            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                server.login(user_name, pass_word)
                server.sendmail(user_name, [to], msg.as_string())
            logger.info(f"Email sent successfully to {to} via SMTP (Subject: {subject})")
        except Exception as e:
            logger.error(f"Failed to send email to {to} via SMTP: {e}")

    def send_system_email(self, to: str, subject: str = "", text: str = "", html: str = None):
        """
        Send a system-only email (MFA codes, password resets, status alerts).
        """
        user_name = self.username
        pass_word = self.password

        if not user_name or not pass_word:
            logger.info(
                f"\n====== [SYSTEM SMTP DISPATCH (MOCK MODE)] ======\n"
                f"To: {to}\n"
                f"Subject: {subject}\n"
                f"Body:\n{text}\n"
                f"================================================\n"
            )
            return

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["To"] = to
            msg["From"] = formataddr(("IntelliSprint System", user_name))
            
            msg.attach(MIMEText(text, "plain", "utf-8"))
            if html:
                msg.attach(MIMEText(html, "html", "utf-8"))

            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                server.login(user_name, pass_word)
                server.sendmail(user_name, [to], msg.as_string())
            logger.info(f"System email sent successfully to {to} via SMTP (Subject: {subject})")
        except Exception as e:
            logger.error(f"Failed to send system email to {to} via SMTP: {e}")

email_service = EmailService()
