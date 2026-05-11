from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # =========================
    # Database
    # =========================

    supabase_db_user: str
    supabase_db_password: str
    supabase_db_host: str
    supabase_db_port: int
    supabase_db_name: str

    # =========================
    # AI
    # =========================

    mistral_api_key: str | None = None

    # =========================
    # WhatsApp / Twilio
    # =========================

    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_phone_number: str | None = None

    # =========================
    # Environment
    # =========================

    app_env: str = "development"

    # =========================
    # Pydantic config
    # =========================

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    # =========================
    # Computed database URL
    # =========================

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://"
            f"{self.supabase_db_user}:"
            f"{self.supabase_db_password}@"
            f"{self.supabase_db_host}:"
            f"{self.supabase_db_port}/"
            f"{self.supabase_db_name}"
        )


settings = Settings()