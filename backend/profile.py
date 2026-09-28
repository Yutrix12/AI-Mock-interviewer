"""Build a candidate profile from resume text: LLM extraction plus keyword fallback."""

import logging

from . import prompts, skills
from .llm import LLM, LLMError
from .schemas import Profile, ResumeDraft, Skill

log = logging.getLogger(__name__)

MAX_SKILLS = 40


def seniority_for(years: float | None) -> str:
    if years is None or years < 2:
        return "entry"
    if years < 5:
        return "mid"
    return "senior"


def merge_skills(llm_skills: list[str], text: str) -> list[Skill]:
    """Canonicalise LLM skills, then add taxonomy hits the LLM missed."""
    ordered: list[str] = []
    seen: set[str] = set()
    for raw in [*llm_skills, *skills.scan_text(text)]:
        if not raw or not raw.strip():
            continue
        name = skills.canonical_name(raw)
        key = name.lower()
        if key in seen or len(name) > 40:
            continue
        seen.add(key)
        ordered.append(name)
    return [Skill(name=name, category=skills.category_of(name)) for name in ordered[:MAX_SKILLS]]


def build_profile(text: str, llm: LLM) -> tuple[Profile, bool]:
    """Returns the profile and whether the LLM contributed (False = keyword fallback only)."""
    try:
        draft = llm.generate(
            system=prompts.EXTRACT_SYSTEM,
            prompt=prompts.EXTRACT_PROMPT.format(resume=text),
            schema=ResumeDraft,
            temperature=0.0,
        )
    except LLMError as exc:
        log.warning("Resume extraction fell back to keyword matching: %s", exc)
        return Profile(skills=merge_skills([], text)), False

    years = max(0.0, draft.years_experience) if draft.years_experience is not None else None
    profile = Profile(
        name=draft.name.strip(),
        headline=draft.headline.strip(),
        years_experience=years,
        seniority=seniority_for(years),
        skills=merge_skills(draft.skills, text),
        experience=[e for e in draft.experience if e.title or e.organization][:6],
        projects=[p for p in draft.projects if p.name][:6],
        education=[e for e in draft.education if e.strip()][:4],
    )
    return profile, True


def brief(profile: Profile, max_chars: int = 1800) -> str:
    """Compact plain-text summary of a profile for prompts."""
    lines = []
    if profile.headline:
        lines.append(f"Headline: {profile.headline} ({profile.seniority} level)")
    if profile.skills:
        lines.append("Skills: " + ", ".join(s.name for s in profile.skills[:25]))
    for job in profile.experience[:4]:
        role = " at ".join(part for part in (job.title, job.organization) if part)
        detail = "; ".join(job.highlights[:2])
        lines.append(f"Role: {role}" + (f" - {detail}" if detail else ""))
    for project in profile.projects[:4]:
        tech = f" [{', '.join(project.technologies[:6])}]" if project.technologies else ""
        lines.append(f"Project: {project.name}{tech} - {project.summary}".rstrip(" -"))
    for item in profile.education[:2]:
        lines.append(f"Education: {item}")
    return "\n".join(lines)[:max_chars] or "No resume details provided."
