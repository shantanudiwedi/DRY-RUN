import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "dryrun"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    GEMINI_MODEL: str = "gemini-3.5-flash"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
