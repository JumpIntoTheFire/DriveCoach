from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_ENV: str = "development"
    SECRET_KEY: str = "dev-secret-change-me"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://drivecoach:password@db:5432/drivecoach"
    TEST_DATABASE_URL: str = ""

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Twilio — optional, leave blank in development
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # Web Push (VAPID) — generate keys with: python scripts/gen_vapid.py
    # Leave blank to disable push notifications
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "admin@drivecoach.local"

    # Stripe — optional, leave blank in development
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""

    # Frontend origin — used for CORS and Stripe redirect URLs
    FRONTEND_URL: str = "http://localhost:3000"


settings = Settings()
