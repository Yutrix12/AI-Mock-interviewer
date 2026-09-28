from types import SimpleNamespace

import pytest

from backend.transcriber import clean_segments


def seg(text, no_speech_prob=0.05, avg_logprob=-0.3):
    return SimpleNamespace(text=text, no_speech_prob=no_speech_prob, avg_logprob=avg_logprob)


def test_keeps_confident_speech():
    assert clean_segments([seg(" I built a queue."), seg(" Then I scaled workers.")]) == "I built a queue. Then I scaled workers."


def test_drops_segments_whisper_marks_as_silence():
    segments = [seg(" Real answer here."), seg(" Thanks for watching!", no_speech_prob=0.9, avg_logprob=-1.4)]
    assert clean_segments(segments) == "Real answer here."


@pytest.mark.parametrize("phrase", [" Thanks for watching!", " Thank you.", " you", "  Please subscribe. "])
def test_hallucination_only_transcript_is_empty(phrase):
    assert clean_segments([seg(phrase)]) == ""


def test_hallucination_phrase_inside_real_answer_is_kept():
    assert clean_segments([seg(" Thank you for the question. I would use Redis.")]).startswith("Thank you for the question")
