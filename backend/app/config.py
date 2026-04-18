from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── App ───────────────────────────────────────────────────────────────────
    APP_ENV: str = "development"  # development | production
    DEBUG: bool = False
    BACKEND_CORS_ORIGINS: str = "*"  # comma-separated list for production

    # ── Database ──────────────────────────────────────────────────────────────
    POSTGRES_USER: str = "user"
    POSTGRES_PASSWORD: str = "pass"
    POSTGRES_DB: str = "meetings"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def TEST_DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/test_{self.POSTGRES_DB}"
        )

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def CELERY_BROKER_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def CELERY_RESULT_BACKEND(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/1"

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60

    # ── SMTP ──────────────────────────────────────────────────────────────────
    SMTP_HOST: str = "mailpit"
    SMTP_PORT: int = 1025
    SMTP_FROM: str = "noreply@meetingrooms.local"
    SMTP_USER: str = ""  # deixar vazio para Mailpit (dev)
    SMTP_PASSWORD: str = ""  # deixar vazio para Mailpit (dev)
    SMTP_TLS: bool = False  # True em produção com SMTP real

    # ── Celery Beat ───────────────────────────────────────────────────────────
    OUTBOX_POLL_INTERVAL_SECONDS: int = 10

    # ── Dev Seed ──────────────────────────────────────────────────────────────
    SEED_ADMIN_NAME: str = ""
    SEED_ADMIN_EMAIL: str = ""
    SEED_ADMIN_PASSWORD: str = ""


settings = Settings()
