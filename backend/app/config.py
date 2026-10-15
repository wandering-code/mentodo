from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://mentodo:mentodo@localhost:5437/mentodo"
    secret_key: str = "dev-secret-change-me"
    admin_username: str = "wander"
    admin_password: str = ""
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@wanderingcode.dev"
    cookie_secure: bool = False
    session_days: int = 60


settings = Settings()
