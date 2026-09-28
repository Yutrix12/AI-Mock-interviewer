import os
from dataclasses import dataclass, field


def _env_list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    ollama_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_URL", "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: os.environ.get("OLLAMA_MODEL", "llama3.1:8b"))
    # Seconds to wait for a single LLM call before giving up.
    llm_timeout: float = field(default_factory=lambda: float(os.environ.get("LLM_TIMEOUT", "240")))
    # Ollama defaults to a small context window; resumes need more room.
    llm_context: int = field(default_factory=lambda: int(os.environ.get("LLM_CONTEXT", "8192")))

    whisper_model: str = field(default_factory=lambda: os.environ.get("WHISPER_MODEL", "small.en"))
    # "auto" tries CUDA first and falls back to CPU.
    whisper_device: str = field(default_factory=lambda: os.environ.get("WHISPER_DEVICE", "auto"))

    max_upload_mb: int = field(default_factory=lambda: int(os.environ.get("MAX_UPLOAD_MB", "5")))
    cors_origins: list[str] = field(
        default_factory=lambda: _env_list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    )
    port: int = field(default_factory=lambda: int(os.environ.get("PORT", "5000")))
