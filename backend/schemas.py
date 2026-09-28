"""Data shapes shared by the API, the LLM layer and the tests.

Models ending in `Draft` describe exactly what the LLM is asked to return
(they are sent to Ollama as JSON schemas). Everything else is the cleaned,
validated shape the rest of the app works with.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Seniority = Literal["entry", "mid", "senior"]
QuestionType = Literal["technical", "project", "behavioral"]
TrackKind = Literal["mixed", "technical", "project", "behavioral"]


# --- Resume -----------------------------------------------------------------


class Skill(BaseModel):
    name: str
    category: str = "other"


class Experience(BaseModel):
    title: str = ""
    organization: str = ""
    highlights: list[str] = Field(default_factory=list)


class Project(BaseModel):
    name: str
    summary: str = ""
    technologies: list[str] = Field(default_factory=list)


class Profile(BaseModel):
    name: str = ""
    headline: str = ""
    seniority: Seniority = "entry"
    years_experience: float | None = None
    skills: list[Skill] = Field(default_factory=list)
    experience: list[Experience] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)


class ResumeDraft(BaseModel):
    name: str
    headline: str
    years_experience: float
    skills: list[str]
    experience: list[Experience]
    projects: list[Project]
    education: list[str]


# --- Interview setup ---------------------------------------------------------


class Track(BaseModel):
    id: str
    kind: TrackKind
    title: str
    description: str
    focus_skills: list[str] = Field(default_factory=list)
    recommended: bool = False


class Question(BaseModel):
    id: str
    type: QuestionType
    topic: str
    text: str
    key_points: list[str] = Field(default_factory=list)


class QuestionDraft(BaseModel):
    type: QuestionType
    topic: str
    text: str
    key_points: list[str]


class QuestionSetDraft(BaseModel):
    questions: list[QuestionDraft]


# --- Scoring -----------------------------------------------------------------


class RubricScores(BaseModel):
    """Each dimension is 0-10. Out-of-range model output is clamped, not rejected."""

    content: float
    clarity: float
    structure: float
    relevance: float

    @field_validator("content", "clarity", "structure", "relevance")
    @classmethod
    def _clamp(cls, value: float) -> float:
        return round(min(10.0, max(0.0, float(value))), 1)


class EvaluationDraft(BaseModel):
    scores: RubricScores
    feedback: str
    strengths: list[str]
    improvements: list[str]
    missed_points: list[str]


class Evaluation(BaseModel):
    score: float
    scores: RubricScores
    feedback: str
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    missed_points: list[str] = Field(default_factory=list)


class AnsweredQuestion(BaseModel):
    question: Question
    transcript: str
    evaluation: Evaluation


class ReportDraft(BaseModel):
    summary: str
    strengths: list[str]
    focus_areas: list[str]
    next_steps: list[str]


class Report(BaseModel):
    overall_score: float | None
    answered: int
    dimension_scores: dict[str, float]
    strongest_topic: str | None
    weakest_topic: str | None
    summary: str
    strengths: list[str]
    focus_areas: list[str]
    next_steps: list[str]


# --- Request bodies ----------------------------------------------------------

Difficulty = Literal["entry", "mid", "senior"]


class TracksRequest(BaseModel):
    profile: Profile


class QuestionsRequest(BaseModel):
    profile: Profile
    track_id: str
    difficulty: Difficulty = "mid"
    count: int = Field(default=5, ge=1, le=10)


class AnswerContext(BaseModel):
    profile: Profile
    track: Track
    difficulty: Difficulty = "mid"
    question: Question


class ReportRequest(BaseModel):
    profile: Profile
    track: Track
    difficulty: Difficulty = "mid"
    items: list[AnsweredQuestion]
