"""Question generation, answer scoring and the end-of-interview report."""

import logging
from statistics import mean

from . import prompts
from .llm import LLM, LLMError
from .profile import brief
from .schemas import (
    AnsweredQuestion,
    Evaluation,
    EvaluationDraft,
    Profile,
    Question,
    QuestionSetDraft,
    Report,
    ReportDraft,
    RubricScores,
    Track,
)
from .tracks import type_plan

log = logging.getLogger(__name__)

DIMENSIONS = ("content", "clarity", "structure", "relevance")

# How much each rubric dimension counts toward the overall score, per question type.
# Kept in code (not left to the LLM) so scores are consistent between answers.
WEIGHTS = {
    "technical": {"content": 0.45, "clarity": 0.2, "structure": 0.15, "relevance": 0.2},
    "project": {"content": 0.4, "clarity": 0.2, "structure": 0.2, "relevance": 0.2},
    "behavioral": {"content": 0.3, "clarity": 0.2, "structure": 0.3, "relevance": 0.2},
}

# Minimum words before an answer is sent to the LLM at all.
MIN_ANSWER_WORDS = 3


# --- Questions ----------------------------------------------------------------


def _fallback_questions(profile: Profile, track: Track, plan: list[str]) -> list[Question]:
    """Template questions used when the LLM is unavailable, still based on the resume."""
    skills = track.focus_skills or [s.name for s in profile.skills[:4]] or ["your main technology"]
    projects = [p.name for p in profile.projects] or [e.title or e.organization for e in profile.experience] or [
        "a recent project"
    ]
    technical = [
        ("{s} fundamentals", "Explain how {s} works under the hood, as you would to a teammate who is new to it."),
        ("{s} trade-offs", "When would you choose {s}, and when would you pick something else instead?"),
        ("Debugging {s}", "Walk me through how you would debug a tricky problem in a {s} codebase."),
        ("{s} performance", "What have you done, or would you do, to make a {s} feature faster or more reliable?"),
    ]
    project = [
        ("{p}", "Tell me about {p}. What problem did it solve and what was your specific contribution?"),
        ("{p} decisions", "What was the hardest technical decision in {p}, and what would you do differently now?"),
        ("{p} challenges", "Describe a bug or obstacle you hit while building {p} and how you worked through it."),
    ]
    behavioral = [
        ("Handling conflict", "Tell me about a time you disagreed with a teammate. How did you resolve it?"),
        ("Ownership", "Describe a time you took ownership of a problem nobody else was handling."),
        ("Learning from failure", "Tell me about something that went wrong on a project and what you learned from it."),
        ("Tight deadline", "Describe a time you had to deliver under a tight deadline. How did you prioritise?"),
    ]
    counters = {"technical": 0, "project": 0, "behavioral": 0}
    questions = []
    for i, qtype in enumerate(plan):
        n = counters[qtype]
        counters[qtype] += 1
        if qtype == "technical":
            topic, text = technical[n % len(technical)]
            value = skills[n % len(skills)]
            topic, text = topic.format(s=value), text.format(s=value)
        elif qtype == "project":
            topic, text = project[n % len(project)]
            value = projects[n % len(projects)]
            topic, text = topic.format(p=value), text.format(p=value)
        else:
            topic, text = behavioral[n % len(behavioral)]
        questions.append(Question(id=f"q{i + 1}", type=qtype, topic=topic[:40], text=text))
    return questions


def generate_questions(llm: LLM, profile: Profile, track: Track, difficulty: str, count: int) -> tuple[list[Question], bool]:
    """Returns the questions and whether they came from the LLM (False = template fallback)."""
    plan = type_plan(track, count)
    try:
        draft = llm.generate(
            system=prompts.QUESTIONS_SYSTEM,
            prompt=prompts.QUESTIONS_PROMPT.format(
                track_title=track.title,
                track_description=track.description,
                difficulty=difficulty,
                focus_skills=", ".join(track.focus_skills) or "general software engineering",
                count=count,
                type_plan=", ".join(plan),
                profile_brief=brief(profile),
            ),
            schema=QuestionSetDraft,
            temperature=0.7,
        )
    except LLMError as exc:
        log.warning("Question generation fell back to templates: %s", exc)
        return _fallback_questions(profile, track, plan), False

    questions: list[Question] = []
    seen: set[str] = set()
    for item in draft.questions:
        text = " ".join(item.text.split())
        if len(text) < 15 or text.lower() in seen:
            continue
        seen.add(text.lower())
        questions.append(
            Question(
                id=f"q{len(questions) + 1}",
                type=item.type,
                topic=" ".join(item.topic.split())[:40] or item.type.title(),
                text=text,
                key_points=[p.strip() for p in item.key_points if p.strip()][:5],
            )
        )
        if len(questions) == count:
            break

    # Top up with templates if the model returned too few usable questions.
    if len(questions) < count:
        extra = _fallback_questions(profile, track, plan[len(questions):])
        for q in extra:
            questions.append(q.model_copy(update={"id": f"q{len(questions) + 1}"}))
    return questions, True


# --- Scoring --------------------------------------------------------------------


def overall_score(scores, question_type: str) -> float:
    weights = WEIGHTS.get(question_type, WEIGHTS["technical"])
    weighted = sum(getattr(scores, d) * weights[d] for d in DIMENSIONS)
    # Depth gate: clarity and relevance can't lift an answer far above its substance.
    return round(min(weighted, scores.content + DEPTH_GATE), 1)


# An answer can score at most this far above its content score overall.
DEPTH_GATE = 2.0
# Below this many words an answer is too short to show real structure.
SHORT_ANSWER_WORDS = 40
SHORT_ANSWER_MAX_STRUCTURE = 5.0


def apply_guards(scores: RubricScores, answer: str) -> RubricScores:
    """Deterministic checks on the model's rubric that it is known to be lenient about."""
    if len(answer.split()) < SHORT_ANSWER_WORDS and scores.structure > SHORT_ANSWER_MAX_STRUCTURE:
        return scores.model_copy(update={"structure": SHORT_ANSWER_MAX_STRUCTURE})
    return scores


class AnswerTooShort(Exception):
    pass


def evaluate_answer(
    llm: LLM, profile: Profile, track: Track, difficulty: str, question: Question, answer: str
) -> Evaluation:
    answer = answer.strip()
    if len(answer.split()) < MIN_ANSWER_WORDS:
        raise AnswerTooShort()

    draft = llm.generate(
        system=prompts.EVALUATE_SYSTEM,
        prompt=prompts.EVALUATE_PROMPT.format(
            track_title=track.title,
            difficulty=difficulty,
            question_type=question.type,
            question=question.text,
            key_points="\n".join(f"- {p}" for p in question.key_points) or "- (none listed)",
            profile_brief=brief(profile, max_chars=900),
            answer=answer[:6000],
        ),
        schema=EvaluationDraft,
        temperature=0.1,
    )
    scores = apply_guards(draft.scores, answer)
    return Evaluation(
        score=overall_score(scores, question.type),
        scores=scores,
        feedback=draft.feedback.strip(),
        strengths=[s.strip() for s in draft.strengths if s.strip()][:3],
        improvements=[s.strip() for s in draft.improvements if s.strip()][:3],
        missed_points=[s.strip() for s in draft.missed_points if s.strip()][:5],
    )


# --- Report -----------------------------------------------------------------------


def _aggregate(items: list[AnsweredQuestion]) -> dict:
    if not items:
        return {"overall": None, "dimensions": {}, "strongest": None, "weakest": None}
    dimensions = {d: round(mean(getattr(i.evaluation.scores, d) for i in items), 1) for d in DIMENSIONS}
    ranked = sorted(items, key=lambda i: i.evaluation.score)
    return {
        "overall": round(mean(i.evaluation.score for i in items), 1),
        "dimensions": dimensions,
        "strongest": ranked[-1].question.topic if len(items) > 1 else None,
        "weakest": ranked[0].question.topic if len(items) > 1 else None,
    }


def _fallback_narrative(items: list[AnsweredQuestion], agg: dict) -> ReportDraft:
    dims = agg["dimensions"]
    best = max(dims, key=dims.get) if dims else None
    worst = min(dims, key=dims.get) if dims else None
    improvements = [imp for i in items for imp in i.evaluation.improvements]
    strengths = [s for i in items for s in i.evaluation.strengths]
    return ReportDraft(
        summary=(
            f"You answered {len(items)} question{'s' if len(items) != 1 else ''} with an average score of "
            f"{agg['overall']}/10. Your strongest dimension was {best} and the one to work on is {worst}."
            if items
            else "No answers were scored in this session."
        ),
        strengths=strengths[:3],
        focus_areas=improvements[:3],
        next_steps=["Redo your lowest-scoring question and aim to cover every key point you missed."],
    )


def build_report(llm: LLM, track: Track, difficulty: str, items: list[AnsweredQuestion]) -> Report:
    agg = _aggregate(items)
    narrative = _fallback_narrative(items, agg)
    if items:
        lines = []
        for n, item in enumerate(items, 1):
            e = item.evaluation
            lines.append(
                f"{n}. [{item.question.type}] {item.question.topic}: {e.score}/10. "
                f"Feedback: {e.feedback} Missed: {', '.join(e.missed_points) or 'nothing major'}."
            )
        try:
            narrative = llm.generate(
                system=prompts.REPORT_SYSTEM,
                prompt=prompts.REPORT_PROMPT.format(
                    track_title=track.title,
                    difficulty=difficulty,
                    overall=agg["overall"],
                    dimensions=", ".join(f"{k} {v}" for k, v in agg["dimensions"].items()),
                    items="\n".join(lines),
                ),
                schema=ReportDraft,
                temperature=0.3,
            )
        except LLMError as exc:
            log.warning("Report narrative fell back to a summary of scores: %s", exc)

    return Report(
        overall_score=agg["overall"],
        answered=len(items),
        dimension_scores=agg["dimensions"],
        strongest_topic=agg["strongest"],
        weakest_topic=agg["weakest"],
        summary=narrative.summary.strip(),
        strengths=[s.strip() for s in narrative.strengths if s.strip()][:3],
        focus_areas=[s.strip() for s in narrative.focus_areas if s.strip()][:3],
        next_steps=[s.strip() for s in narrative.next_steps if s.strip()][:3],
    )
