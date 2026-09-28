import pytest

from backend import interview
from backend.llm import LLMError
from backend.schemas import (
    AnsweredQuestion,
    EvaluationDraft,
    Profile,
    Question,
    QuestionSetDraft,
    ReportDraft,
    RubricScores,
    Skill,
)
from backend.tracks import derive_tracks, find_track, type_plan

from .conftest import FakeLLM, evaluation_draft, question_set, report_draft, sample_profile


def test_tracks_for_full_stack_profile():
    tracks = derive_tracks(sample_profile())
    ids = [t.id for t in tracks]
    assert ids[0] == "full-loop" and tracks[0].recommended
    assert {"frontend", "backend", "resume-deep-dive", "behavioral"} <= set(ids)
    backend = next(t for t in tracks if t.id == "backend")
    assert "PostgreSQL" in backend.focus_skills  # database layer folded into backend


def test_tracks_without_skills_only_offer_behavioral():
    tracks = derive_tracks(Profile())
    assert [t.id for t in tracks] == ["behavioral"]
    assert tracks[0].recommended


def test_languages_only_profile_gets_fundamentals_track():
    profile = Profile(skills=[Skill(name="Java", category="languages"), Skill(name="Python", category="languages")])
    assert "languages" in [t.id for t in derive_tracks(profile)]


@pytest.mark.parametrize("count", [1, 2, 3, 5, 8, 10])
def test_mixed_type_plan_always_has_requested_length(count):
    track = find_track(sample_profile(), "full-loop")
    plan = type_plan(track, count)
    assert len(plan) == count
    if count >= 3:
        assert plan[0] == "project" and plan[-1] == "behavioral" and "technical" in plan


def test_overall_score_uses_type_weights():
    scores = RubricScores(content=10, clarity=0, structure=0, relevance=0)
    assert interview.overall_score(scores, "technical") == 4.5
    assert interview.overall_score(scores, "behavioral") == 3.0


def test_depth_gate_caps_polished_but_shallow_answers():
    shallow = RubricScores(content=3, clarity=8, structure=9, relevance=10)
    assert interview.overall_score(shallow, "technical") == 5.0  # weighted 6.4, capped at content + 2
    strong = RubricScores(content=8, clarity=9, structure=9, relevance=10)
    assert interview.overall_score(strong, "technical") == 8.8  # below the gate, unchanged


def test_short_answers_cannot_claim_structure():
    scores = RubricScores(content=3, clarity=8, structure=9, relevance=10)
    assert interview.apply_guards(scores, "Add an index. It makes queries faster.").structure == 5.0
    long_answer = " ".join(["word"] * 60)
    assert interview.apply_guards(scores, long_answer).structure == 9


def test_rubric_scores_are_clamped():
    scores = RubricScores(content=14, clarity=-2, structure=7.25, relevance=10)
    assert (scores.content, scores.clarity, scores.structure) == (10, 0, 7.2)


def test_generate_questions_dedupes_and_tops_up():
    draft = question_set(3)
    draft.questions.append(draft.questions[0])  # duplicate
    llm = FakeLLM({QuestionSetDraft: draft})
    track = find_track(sample_profile(), "full-loop")
    questions, used_llm = interview.generate_questions(llm, sample_profile(), track, "mid", 5)
    assert used_llm
    assert len(questions) == 5
    assert len({q.text for q in questions}) == 5
    assert [q.id for q in questions] == ["q1", "q2", "q3", "q4", "q5"]
    assert "exactly 5 questions" in llm.calls[0]["prompt"]


def test_generate_questions_falls_back_to_templates():
    track = find_track(sample_profile(), "frontend")
    questions, used_llm = interview.generate_questions(FakeLLM(), sample_profile(), track, "entry", 4)
    assert not used_llm
    assert len(questions) == 4
    assert all(q.type == "technical" for q in questions)
    assert "React" in questions[0].text


def _question(qtype="technical"):
    return Question(id="q1", type=qtype, topic="Caching", text="How would you add caching to an API?", key_points=["TTL"])


def test_evaluate_answer_computes_score_in_code():
    llm = FakeLLM({EvaluationDraft: evaluation_draft(content=8, clarity=7, structure=6, relevance=9)})
    track = find_track(sample_profile(), "backend")
    answer = (
        "I would put Redis in front of the slowest read endpoints, keyed by the request parameters, with a TTL "
        "based on how stale the data is allowed to be. Writes invalidate the matching keys, and I would watch the "
        "hit rate and p95 latency to confirm the cache is actually helping before expanding it."
    )
    result = interview.evaluate_answer(llm, sample_profile(), track, "mid", _question(), answer)
    assert result.score == round(8 * 0.45 + 7 * 0.2 + 6 * 0.15 + 9 * 0.2, 1)
    assert result.missed_points == ["Point C"]
    assert "<answer>" in llm.calls[0]["prompt"]


def test_evaluate_answer_rejects_near_empty_answers():
    track = find_track(sample_profile(), "backend")
    with pytest.raises(interview.AnswerTooShort):
        interview.evaluate_answer(FakeLLM(), sample_profile(), track, "mid", _question(), "um yes")


def _answered(score_draft, qtype="technical", topic="Caching"):
    evaluation = interview.Evaluation(
        score=interview.overall_score(score_draft.scores, qtype),
        scores=score_draft.scores,
        feedback=score_draft.feedback,
        strengths=score_draft.strengths,
        improvements=score_draft.improvements,
    )
    question = _question(qtype).model_copy(update={"topic": topic})
    return AnsweredQuestion(question=question, transcript="answer", evaluation=evaluation)


def test_report_aggregates_scores_and_uses_llm_narrative():
    items = [_answered(evaluation_draft(9, 9, 9, 9), topic="Strong"), _answered(evaluation_draft(3, 3, 3, 3), topic="Weak")]
    track = find_track(sample_profile(), "backend")
    report = interview.build_report(FakeLLM({ReportDraft: report_draft()}), track, "mid", items)
    assert report.overall_score == 6.0
    assert report.dimension_scores == {"content": 6.0, "clarity": 6.0, "structure": 6.0, "relevance": 6.0}
    assert (report.strongest_topic, report.weakest_topic) == ("Strong", "Weak")
    assert report.summary == "You gave clear, specific answers."


def test_report_survives_llm_failure():
    items = [_answered(evaluation_draft())]
    track = find_track(sample_profile(), "backend")
    report = interview.build_report(FakeLLM({ReportDraft: LLMError("down")}), track, "mid", items)
    assert report.answered == 1
    assert "average score" in report.summary
    assert report.focus_areas == ["Quantify the result"]
