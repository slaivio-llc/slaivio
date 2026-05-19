from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_db_user: str
    supabase_db_password: str
    supabase_db_host: str
    supabase_db_port: int
    supabase_db_name: str

    mistral_api_key: str | None = None

    app_env: str = "development"
    app_org_id: str = "demo_agency"
    manager_api_key: str = "change-me-dev-key"

    meta_wa_access_token: str | None = None
    meta_wa_verify_token: str = "slaivo_verify_token_secret"
    meta_wa_api_version: str = "v20.0"


    whatsapp_provider: str = "mock"
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_whatsapp_from: str | None = None
    twilio_validate_signature: bool = False
    twilio_status_callback_path: str = "/webhook/twilio/status"
    twilio_messaging_service_sid: str | None = None
    public_base_url: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    voice_transcription_provider: str = "mistral"

settings = Settings()
