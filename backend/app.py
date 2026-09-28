"""HTTP API for MockerAI.

The API is stateless: the client sends the profile, track and question it is
working with on every call, so there is no server-side session to lose.
"""

import json
import logging

from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from . import interview
from .config import Settings
from .llm import LLM, LLMError, OllamaClient
from .profile import build_profile, merge_skills
from .resume import ResumeError, extract_text
from .schemas import AnswerContext, QuestionsRequest, ReportRequest, TracksRequest
from .tracks import derive_tracks, find_track
from .transcriber import Transcriber

log = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def _parse(model, data):
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first["loc"])
        raise ApiError(400, "bad_request", f"Invalid request field {where}: {first['msg']}") from exc


def _json_body() -> dict:
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "bad_request", "Expected a JSON object body.")
    return body


def create_app(settings: Settings | None = None, llm: LLM | None = None, transcriber: Transcriber | None = None) -> Flask:
    settings = settings or Settings()
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = settings.max_upload_mb * 1024 * 1024 * 4  # audio can exceed resume size
    CORS(app, origins=settings.cors_origins)

    if llm is None:
        llm = OllamaClient(settings.ollama_url, settings.ollama_model, settings.llm_timeout, settings.llm_context)
    if transcriber is None:
        transcriber = Transcriber(settings.whisper_model, settings.whisper_device)
        transcriber.load_in_background()

    @app.errorhandler(ApiError)
    def _api_error(err: ApiError):
        return jsonify(error={"code": err.code, "message": err.message}), err.status

    @app.errorhandler(LLMError)
    def _llm_error(err: LLMError):
        log.error("LLM failure: %s", err)
        message = (
            "The local model returned an unusable response. Try again."
            if err.code == "llm_bad_output"
            else "Can't reach the local model. Make sure Ollama is running."
        )
        return jsonify(error={"code": err.code, "message": message}), 503

    @app.errorhandler(RequestEntityTooLarge)
    def _too_large(_err):
        return jsonify(error={"code": "file_too_large", "message": "That file is too large to upload."}), 413

    @app.errorhandler(HTTPException)
    def _http_error(err: HTTPException):
        return jsonify(error={"code": "http_error", "message": err.description}), err.code

    @app.get("/api/health")
    def health():
        status = llm.status() if hasattr(llm, "status") else {"reachable": True}
        return jsonify(llm=status, transcriber=transcriber.status())

    @app.post("/api/resume")
    def parse_resume():
        upload = request.files.get("resume")
        if upload is None or not upload.filename:
            raise ApiError(400, "no_file", "Attach a resume file to upload.")
        data = upload.read()
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            raise ApiError(413, "file_too_large", f"Resumes must be under {settings.max_upload_mb} MB.")
        try:
            text = extract_text(upload.filename, data)
        except ResumeError as exc:
            raise ApiError(422, exc.code, str(exc)) from exc

        profile, used_llm = build_profile(text, llm)
        if not profile.skills and not used_llm:
            raise ApiError(503, "llm_unavailable", "Can't reach the local model to read your resume. Make sure Ollama is running.")
        return jsonify(profile=profile.model_dump(), tracks=[t.model_dump() for t in derive_tracks(profile)], ai_parsed=used_llm)

    @app.post("/api/tracks")
    def tracks():
        """Recompute options after the user edits their skills. Hand-typed skills are normalised here."""
        body = _parse(TracksRequest, _json_body())
        profile = body.profile.model_copy(update={"skills": merge_skills([s.name for s in body.profile.skills], "")})
        return jsonify(profile=profile.model_dump(), tracks=[t.model_dump() for t in derive_tracks(profile)])

    @app.post("/api/questions")
    def questions():
        body = _parse(QuestionsRequest, _json_body())
        track = find_track(body.profile, body.track_id)
        if track is None:
            raise ApiError(404, "unknown_track", "That interview option isn't available for this profile.")
        items, used_llm = interview.generate_questions(llm, body.profile, track, body.difficulty, body.count)
        return jsonify(track=track.model_dump(), questions=[q.model_dump() for q in items], ai_generated=used_llm)

    @app.post("/api/answer")
    def answer():
        try:
            context_data = json.loads(request.form.get("context", ""))
        except json.JSONDecodeError as exc:
            raise ApiError(400, "bad_request", "Missing or invalid 'context' field.") from exc
        context = _parse(AnswerContext, context_data)

        audio = request.files.get("audio")
        if audio is not None:
            try:
                transcript = transcriber.transcribe(audio.read())
            except RuntimeError as exc:
                raise ApiError(503, "transcriber_unavailable", f"Speech recognition isn't ready: {exc}") from exc
        else:
            transcript = (request.form.get("text") or "").strip()

        if not transcript:
            raise ApiError(422, "no_speech", "No speech was detected in the recording.")
        try:
            evaluation = interview.evaluate_answer(
                llm, context.profile, context.track, context.difficulty, context.question, transcript
            )
        except interview.AnswerTooShort as exc:
            raise ApiError(422, "answer_too_short", "That answer was too short to score. Try giving a full answer.") from exc
        return jsonify(transcript=transcript, evaluation=evaluation.model_dump())

    @app.post("/api/report")
    def report():
        body = _parse(ReportRequest, _json_body())
        result = interview.build_report(llm, body.track, body.difficulty, body.items)
        return jsonify(report=result.model_dump())

    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = Settings()
    create_app(settings).run(host="127.0.0.1", port=settings.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
