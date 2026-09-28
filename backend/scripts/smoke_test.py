"""End-to-end check against a running backend with the real models.

Usage (backend running on :5000):
    python backend/scripts/smoke_test.py [path/to/resume] [--audio path/to/answer.m4a]
"""

import argparse
import json
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
API = "http://127.0.0.1:5000/api"


def timed(label, fn):
    start = time.perf_counter()
    result = fn()
    print(f"[{time.perf_counter() - start:5.1f}s] {label}")
    return result


def check(response):
    body = response.json()
    if response.status_code != 200:
        raise SystemExit(f"{response.status_code}: {json.dumps(body, indent=2)}")
    return body


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("resume", nargs="?", default=str(ROOT / "frontend/public/sample-resume.txt"))
    parser.add_argument("--audio", help="optional recorded answer to send instead of text")
    parser.add_argument("--track", default="full-loop")
    args = parser.parse_args()

    print("health:", check(requests.get(f"{API}/health", timeout=10)))

    with open(args.resume, "rb") as f:
        parsed = timed("parse resume", lambda: check(requests.post(f"{API}/resume", files={"resume": f}, timeout=300)))
    profile = parsed["profile"]
    print(f"  {profile['name']} - {profile['headline']} ({profile['seniority']}), ai_parsed={parsed['ai_parsed']}")
    print("  skills:", ", ".join(f"{s['name']}[{s['category']}]" for s in profile["skills"]))
    print("  tracks:", ", ".join(t["id"] for t in parsed["tracks"]))

    body = {"profile": profile, "track_id": args.track, "difficulty": profile["seniority"], "count": 3}
    generated = timed("generate questions", lambda: check(requests.post(f"{API}/questions", json=body, timeout=300)))
    for q in generated["questions"]:
        print(f"  [{q['type']}] {q['topic']}: {q['text']}")

    question = generated["questions"][0]
    context = {"profile": profile, "track": generated["track"], "difficulty": body["difficulty"], "question": question}
    if args.audio:
        with open(args.audio, "rb") as f:
            files = {"audio": f}
            answer = timed("transcribe + score", lambda: check(requests.post(f"{API}/answer", data={"context": json.dumps(context)}, files=files, timeout=300)))
    else:
        text = (
            "On DevPulse I was the main developer. CI dashboards were slow because we polled the GitHub API for every repo, "
            "so I moved to webhooks, stored job timings in Postgres and exposed them over GraphQL. Page loads went from about "
            "eight seconds to under two, and people used it to find flaky tests quickly."
        )
        answer = timed("score answer", lambda: check(requests.post(f"{API}/answer", data={"context": json.dumps(context), "text": text}, timeout=300)))
    print("  transcript:", answer["transcript"])
    print("  evaluation:", json.dumps(answer["evaluation"], indent=2))

    items = [{"question": question, "transcript": answer["transcript"], "evaluation": answer["evaluation"]}]
    report_body = {"profile": profile, "track": generated["track"], "difficulty": body["difficulty"], "items": items}
    report = timed("build report", lambda: check(requests.post(f"{API}/report", json=report_body, timeout=300)))
    print("  report:", json.dumps(report["report"], indent=2))


if __name__ == "__main__":
    main()
