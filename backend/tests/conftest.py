import pytest

from backend.app import create_app
from backend.config import Settings
from backend.llm import LLMError
from backend.schemas import (
    EvaluationDraft,
    Experience,
    Profile,
    Project,
    QuestionDraft,
    QuestionSetDraft,
    ReportDraft,
    ResumeDraft,
    RubricScores,
    Skill,
)

SAMPLE_RESUME = """Priya Raman
Software Engineering Intern | priya@example.com

SKILLS
Python, React, TypeScript, Flask, PostgreSQL, Docker, Git

EXPERIENCE
Software Engineering Intern, Lumen Health (Summer 2025)
- Built a Flask REST API serving 40k appointment requests a day
- Cut page load time by 35% by moving the dashboard to React Query

PROJECTS
StudySync - a React and Node.js app that matches students into study groups.
Pulse - a PyTorch model that flags irregular heartbeats from ECG data.

EDUCATION
B.Tech Computer Science, 2026
"""


class FakeLLM:
    """Returns canned responses per schema. A value may be a model, a callable or an exception."""

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def generate(self, *, system, prompt, schema, temperature=0.2):
        self.calls.append({"schema": schema.__name__, "system": system, "prompt": prompt})
        value = self.responses.get(schema)
        if value is None:
            raise LLMError("no fake response configured")
        if isinstance(value, Exception):
            raise value
        return value(prompt) if callable(value) else value

    def status(self):
        return {"reachable": True, "model": "fake", "model_available": True}


class FakeTranscriber:
    def __init__(self, text="I would start by profiling the slow endpoint and checking the query plan."):
        self.text = text

    def status(self):
        return {"state": "ready", "model": "fake", "device": "cpu", "error": None}

    def transcribe(self, audio: bytes) -> str:
        return self.text


def resume_draft() -> ResumeDraft:
    return ResumeDraft(
        name="Priya Raman",
        headline="Software engineering intern",
        years_experience=0.5,
        skills=["Python", "React.js", "TypeScript", "Flask", "Postgres", "Docker", "Git"],
        experience=[Experience(title="Software Engineering Intern", organization="Lumen Health", highlights=["Built a Flask API"])],
        projects=[
            Project(name="StudySync", summary="Matches students into study groups.", technologies=["React", "Node.js"]),
            Project(name="Pulse", summary="Flags irregular heartbeats.", technologies=["PyTorch"]),
        ],
        education=["B.Tech Computer Science, 2026"],
    )


def question_set(n=5) -> QuestionSetDraft:
    types = ["project", "technical", "technical", "technical", "behavioral"]
    return QuestionSetDraft(
        questions=[
            QuestionDraft(
                type=types[i % len(types)],
                topic=f"Topic {i + 1}",
                text=f"Question number {i + 1}: explain something specific about your work in detail?",
                key_points=["Point A", "Point B", "Point C"],
            )
            for i in range(n)
        ]
    )


def evaluation_draft(content=8, clarity=7, structure=6, relevance=9) -> EvaluationDraft:
    return EvaluationDraft(
        scores=RubricScores(content=content, clarity=clarity, structure=structure, relevance=relevance),
        feedback="You explained the approach clearly and gave a concrete example.",
        strengths=["Concrete example"],
        improvements=["Quantify the result"],
        missed_points=["Point C"],
    )


def report_draft() -> ReportDraft:
    return ReportDraft(
        summary="You gave clear, specific answers.",
        strengths=["Specific examples"],
        focus_areas=["Quantify impact"],
        next_steps=["Practice two STAR stories"],
    )


def sample_profile() -> Profile:
    return Profile(
        name="Priya Raman",
        headline="Software engineering intern",
        seniority="entry",
        years_experience=0.5,
        skills=[
            Skill(name="React", category="frontend"),
            Skill(name="TypeScript", category="frontend"),
            Skill(name="Flask", category="backend"),
            Skill(name="Node.js", category="backend"),
            Skill(name="PostgreSQL", category="databases"),
            Skill(name="Python", category="languages"),
        ],
        experience=[Experience(title="Software Engineering Intern", organization="Lumen Health")],
        projects=[Project(name="StudySync", technologies=["React"])],
    )


@pytest.fixture
def fake_llm():
    return FakeLLM(
        {
            ResumeDraft: resume_draft(),
            QuestionSetDraft: question_set(),
            EvaluationDraft: evaluation_draft(),
            ReportDraft: report_draft(),
        }
    )


@pytest.fixture
def client(fake_llm):
    app = create_app(Settings(), llm=fake_llm, transcriber=FakeTranscriber())
    app.config["TESTING"] = True
    return app.test_client()
