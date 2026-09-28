"""Thin Ollama client that returns validated Pydantic models.

Every call sends the model's JSON schema as Ollama's `format`, so the LLM is
constrained to the expected shape; the reply is then validated, with one retry
on malformed output.
"""

import logging
from typing import Protocol, TypeVar

import requests
from pydantic import BaseModel, ValidationError

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    """The LLM could not be reached or kept returning unusable output."""

    def __init__(self, message: str, code: str = "llm_unavailable"):
        super().__init__(message)
        self.code = code


class LLM(Protocol):
    def generate(self, *, system: str, prompt: str, schema: type[T], temperature: float = 0.2) -> T: ...


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: float = 240, context: int = 8192):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.context = context

    def generate(self, *, system: str, prompt: str, schema: type[T], temperature: float = 0.2) -> T:
        payload = {
            "model": self.model,
            "stream": False,
            "format": schema.model_json_schema(),
            "keep_alive": "15m",
            "options": {"temperature": temperature, "num_ctx": self.context},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=self.timeout)
            except requests.RequestException as exc:
                raise LLMError(f"Could not reach Ollama at {self.base_url}: {exc}") from exc
            if response.status_code != 200:
                raise LLMError(f"Ollama returned {response.status_code}: {response.text[:300]}")

            content = response.json().get("message", {}).get("content", "")
            try:
                return schema.model_validate_json(content)
            except ValidationError as exc:
                last_error = exc
                log.warning("LLM returned invalid %s (attempt %d): %s", schema.__name__, attempt + 1, exc)
        raise LLMError(f"The model kept returning malformed {schema.__name__}: {last_error}", code="llm_bad_output")

    def status(self) -> dict:
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=3)
            models = [m.get("name") for m in response.json().get("models", [])]
        except (requests.RequestException, ValueError):
            return {"reachable": False, "model": self.model, "model_available": False}
        return {"reachable": True, "model": self.model, "model_available": self.model in models}
