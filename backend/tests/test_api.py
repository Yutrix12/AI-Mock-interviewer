import io
import json

from backend.llm import LLMError
from backend.schemas import ResumeDraft

from .conftest import SAMPLE_RESUME, sample_profile


def _upload(client, name="resume.txt", data=SAMPLE_RESUME.encode()):
    return client.post("/api/resume", data={"resume": (io.BytesIO(data), name)}, content_type="multipart/form-data")


def _context(question_type="technical"):
    track = {
        "id": "backend",
        "kind": "technical",
        "title": "Backend engineering",
        "description": "APIs",
        "focus_skills": ["Flask"],
        "recommended": False,
    }
    question = {"id": "q1", "type": question_type, "topic": "APIs", "text": "How do you version an API?", "key_points": []}
    return {"profile": sample_profile().model_dump(), "track": track, "difficulty": "mid", "question": question}


def test_health(client):
    body = client.get("/api/health").get_json()
    assert body["llm"]["reachable"] and body["transcriber"]["state"] == "ready"


def test_hosted_ui_can_reach_local_backend(client):
    origin = "https://yutrix12.github.io"
    preflight = client.options(
        "/api/resume",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert preflight.headers["Access-Control-Allow-Origin"] == origin
    assert preflight.headers["Access-Control-Allow-Private-Network"] == "true"
    assert "Access-Control-Allow-Origin" not in client.get("/api/health", headers={"Origin": "https://evil.example"}).headers


def test_resume_upload_returns_profile_and_tracks(client):
    response = _upload(client)
    assert response.status_code == 200
    body = response.get_json()
    assert body["profile"]["name"] == "Priya Raman"
    assert body["ai_parsed"] is True
    assert body["tracks"][0]["id"] == "full-loop"


def test_resume_upload_errors(client):
    assert client.post("/api/resume").get_json()["error"]["code"] == "no_file"
    bad = _upload(client, name="photo.png", data=b"123")
    assert bad.status_code == 422 and bad.get_json()["error"]["code"] == "unsupported_file"


def test_resume_upload_without_llm_falls_back(client, fake_llm):
    fake_llm.responses[ResumeDraft] = LLMError("down")
    body = _upload(client).get_json()
    assert body["ai_parsed"] is False
    assert "React" in [s["name"] for s in body["profile"]["skills"]]


def test_tracks_recomputed_from_edited_profile(client):
    profile = sample_profile().model_dump()
    # Hand-typed skills arrive uncategorised; the server normalises them.
    profile["skills"] = [{"name": "pytorch"}, {"name": "sklearn"}, {"name": "Pandas"}]
    body = client.post("/api/tracks", json={"profile": profile}).get_json()
    ids = [t["id"] for t in body["tracks"]]
    assert "ml" in ids and "frontend" not in ids and "behavioral" in ids
    assert [s["name"] for s in body["profile"]["skills"]] == ["PyTorch", "scikit-learn", "Pandas"]


def test_questions(client):
    response = client.post("/api/questions", json={"profile": sample_profile().model_dump(), "track_id": "full-loop", "count": 5})
    body = response.get_json()
    assert response.status_code == 200
    assert len(body["questions"]) == 5 and body["track"]["id"] == "full-loop"


def test_questions_validation(client):
    bad_count = client.post("/api/questions", json={"profile": {}, "track_id": "behavioral", "count": 50})
    assert bad_count.status_code == 400 and "count" in bad_count.get_json()["error"]["message"]
    unknown = client.post("/api/questions", json={"profile": {}, "track_id": "frontend"})
    assert unknown.status_code == 404


def test_answer_with_text(client):
    response = client.post(
        "/api/answer",
        data={"context": json.dumps(_context()), "text": "I version APIs with a prefix like /v2 and deprecate old routes."},
    )
    body = response.get_json()
    assert response.status_code == 200
    assert body["evaluation"]["score"] > 0 and body["transcript"].startswith("I version")


def test_answer_with_audio_uses_transcriber(client):
    response = client.post(
        "/api/answer",
        data={"context": json.dumps(_context()), "audio": (io.BytesIO(b"fake-webm"), "answer.webm")},
        content_type="multipart/form-data",
    )
    assert response.get_json()["transcript"].startswith("I would start by profiling")


def test_answer_errors(client):
    assert client.post("/api/answer", data={"text": "hello"}).get_json()["error"]["code"] == "bad_request"
    empty = client.post("/api/answer", data={"context": json.dumps(_context()), "text": "  "})
    assert empty.get_json()["error"]["code"] == "no_speech"
    short = client.post("/api/answer", data={"context": json.dumps(_context()), "text": "not sure"})
    assert short.get_json()["error"]["code"] == "answer_too_short"


def test_llm_outage_returns_503(client, fake_llm):
    from backend.schemas import EvaluationDraft

    fake_llm.responses[EvaluationDraft] = LLMError("down")
    response = client.post("/api/answer", data={"context": json.dumps(_context()), "text": "A long enough answer here."})
    assert response.status_code == 503 and response.get_json()["error"]["code"] == "llm_unavailable"


def test_report(client):
    context = _context()
    answer = client.post("/api/answer", data={"context": json.dumps(context), "text": "I use URL versioning with clear deprecation."}).get_json()
    items = [{"question": context["question"], "transcript": answer["transcript"], "evaluation": answer["evaluation"]}]
    body = client.post("/api/report", json={"profile": context["profile"], "track": context["track"], "items": items}).get_json()
    assert body["report"]["answered"] == 1
    assert body["report"]["overall_score"] == answer["evaluation"]["score"]
