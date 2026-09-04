import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database
    DB_HOST: str = ""
    DB_PORT: str = "3306"
    DB_NAME: str = "flowsyncdb"
    DB_USERNAME: str = ""
    DB_PASSWORD: str = ""
    DATABASE_URL: str = ""

    # JWT
    JWT_SECRET: str = "flowsync-super-secret-jwt-key-for-token-signing-32-chars-long"
    JWT_EXPIRATION_MS: int = 604800000  # 7 days
    JWT_REFRESH_EXPIRATION_MS: int = 2592000000  # 30 days
    JWT_ALGORITHM: str = "HS256"

    # App
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://jira-tool-1.onrender.com,http://127.0.0.1:3000,http://127.0.0.1:5173"

    # Mail (SMTP or HTTP API for Render/Cloud)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    RESEND_API_KEY: str = ""
    BREVO_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    # AI
    AI_ENABLED: bool = True
    AI_MOCK: bool = False
    GROQ_API_KEY: str = ""

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.DB_HOST and self.DB_USERNAME:
            return f"mysql+pymysql://{self.DB_USERNAME}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        # Default SQLite
        os.makedirs(os.path.join(os.path.dirname(__file__), "..", "db"), exist_ok=True)
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db", "flowsyncdb.sqlite3"))
        return f"sqlite:///{db_path}"

    class Config:
        env_file = (
            os.path.join(os.path.dirname(__file__), "..", ".env"),
            os.path.join(os.getcwd(), ".env"),
            os.path.join(os.getcwd(), "backend", ".env"),
            ".env"
        )
        extra = "ignore"

settings = Settings()
