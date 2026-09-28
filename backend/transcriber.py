"""Speech-to-text with faster-whisper. Loads in the background; prefers the GPU."""

import io
import logging
import os
import sys
import threading

log = logging.getLogger(__name__)


# Phrases Whisper is known to invent for silence, noise or tones (learned from subtitle data).
HALLUCINATIONS = {
    "thanks for watching",
    "thank you for watching",
    "thank you",
    "thanks",
    "you",
    "bye",
    "please subscribe",
    "subscribe to my channel",
    "like and subscribe",
    "see you in the next video",
}


def clean_segments(segments) -> str:
    """Join Whisper segments, dropping ones that are probably not speech.

    Uses Whisper's own confidence: a segment is skipped when it is likely
    silence (high no_speech_prob) *and* decoded with low confidence, the same
    rule OpenAI's reference implementation uses. A transcript that is only a
    known hallucination phrase is treated as empty.
    """
    kept = []
    for seg in segments:
        if seg.no_speech_prob > 0.6 and seg.avg_logprob < -1.0:
            continue
        text = seg.text.strip()
        if text:
            kept.append(text)
    transcript = " ".join(kept).strip()
    normalised = "".join(ch for ch in transcript.lower() if ch.isalnum() or ch == " ").strip()
    return "" if normalised in HALLUCINATIONS else transcript


def _expose_cuda_dlls() -> None:
    """On Windows, point the loader at the cuBLAS/cuDNN DLLs shipped in the nvidia-* pip packages."""
    if sys.platform != "win32":
        return
    try:
        import nvidia.cublas
        import nvidia.cudnn
    except ImportError:
        return
    for package in (nvidia.cublas, nvidia.cudnn):
        bin_dir = os.path.join(package.__path__[0], "bin")
        if os.path.isdir(bin_dir):
            os.add_dll_directory(bin_dir)
            os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")


class Transcriber:
    def __init__(self, model_name: str = "small.en", device: str = "auto"):
        self.model_name = model_name
        self.requested_device = device
        self.device: str | None = None
        self.error: str | None = None
        self._model = None
        self._ready = threading.Event()

    def load_in_background(self) -> None:
        threading.Thread(target=self._load, name="whisper-loader", daemon=True).start()

    def _load(self) -> None:
        try:
            _expose_cuda_dlls()
            from faster_whisper import WhisperModel

            candidates = [("cuda", "float16"), ("cpu", "int8")]
            if self.requested_device != "auto":
                candidates = [(self.requested_device, "float16" if self.requested_device == "cuda" else "int8")]
            for device, compute_type in candidates:
                try:
                    log.info("Loading Whisper %s on %s...", self.model_name, device)
                    self._model = WhisperModel(self.model_name, device=device, compute_type=compute_type)
                    self.device = device
                    log.info("Whisper ready on %s", device)
                    break
                except Exception as exc:  # CUDA/driver problems surface as generic runtime errors
                    log.warning("Whisper could not load on %s: %s", device, exc)
            if self._model is None:
                self.error = "Whisper failed to load on every device."
        except Exception as exc:
            self.error = str(exc)
            log.exception("Whisper failed to load")
        finally:
            self._ready.set()

    @property
    def ready(self) -> bool:
        return self._model is not None

    def status(self) -> dict:
        state = "ready" if self.ready else ("error" if self.error else "loading")
        return {"state": state, "model": self.model_name, "device": self.device, "error": self.error}

    def transcribe(self, audio: bytes) -> str:
        self._ready.wait(timeout=300)
        if self._model is None:
            raise RuntimeError(self.error or "Whisper is still loading.")
        segments, _info = self._model.transcribe(
            io.BytesIO(audio),
            beam_size=5,
            vad_filter=True,
            # Stops one hallucinated phrase from seeding the next segment.
            condition_on_previous_text=False,
        )
        return clean_segments(segments)
