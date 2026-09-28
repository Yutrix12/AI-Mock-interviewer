"""Derive interview options from a profile.

Deliberately rule-based (no LLM): the same resume always yields the same
options, and the logic is easy to test and explain.
"""

from collections import defaultdict

from .schemas import Profile, Track
from .skills import CATEGORY_TITLES

TECHNICAL_CATEGORIES = ["frontend", "backend", "ml", "data", "cloud", "mobile", "databases"]
MAX_TECHNICAL_TRACKS = 3
MIN_SKILLS_FOR_TRACK = 2

_TECH_DESCRIPTIONS = {
    "frontend": "Components, state, rendering and browser performance.",
    "backend": "APIs, data flow, reliability and service design.",
    "ml": "Models, training, evaluation and putting ML into production.",
    "data": "Pipelines, data modelling and analysis.",
    "cloud": "Deployment, containers, infrastructure and CI/CD.",
    "mobile": "App architecture, platform APIs and mobile performance.",
    "databases": "Schema design, queries, indexing and transactions.",
    "languages": "Core language concepts, data structures and problem solving.",
}


def _skills_by_category(profile: Profile) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for skill in profile.skills:
        grouped[skill.category].append(skill.name)
    return grouped


def derive_tracks(profile: Profile) -> list[Track]:
    grouped = _skills_by_category(profile)

    technical: list[Track] = []
    ranked = sorted(
        (c for c in TECHNICAL_CATEGORIES if len(grouped.get(c, [])) >= MIN_SKILLS_FOR_TRACK),
        key=lambda c: (-len(grouped[c]), TECHNICAL_CATEGORIES.index(c)),
    )
    for category in ranked[:MAX_TECHNICAL_TRACKS]:
        focus = grouped[category][:4]
        # Backend interviews usually cover the database layer too.
        if category == "backend":
            focus += [s for s in grouped.get("databases", [])[:2] if s not in focus]
        technical.append(
            Track(
                id=category,
                kind="technical",
                title=CATEGORY_TITLES[category],
                description=_TECH_DESCRIPTIONS[category],
                focus_skills=focus,
            )
        )

    if not technical and grouped.get("languages"):
        technical.append(
            Track(
                id="languages",
                kind="technical",
                title=CATEGORY_TITLES["languages"],
                description=_TECH_DESCRIPTIONS["languages"],
                focus_skills=grouped["languages"][:4],
            )
        )

    tracks: list[Track] = []
    top_skills = [s.name for s in profile.skills[:5]]
    if technical:
        tracks.append(
            Track(
                id="full-loop",
                kind="mixed",
                title="Full interview loop",
                description="Technical questions, a deep dive into your projects and a behavioral round.",
                focus_skills=technical[0].focus_skills[:3] + [s for s in top_skills if s not in technical[0].focus_skills][:2],
                recommended=True,
            )
        )
    tracks.extend(technical)

    if profile.projects or profile.experience:
        names = [p.name for p in profile.projects[:3]] or [e.organization or e.title for e in profile.experience[:3]]
        tracks.append(
            Track(
                id="resume-deep-dive",
                kind="project",
                title="Resume deep dive",
                description="Detailed questions about the projects and roles on your resume.",
                focus_skills=[n for n in names if n],
            )
        )

    tracks.append(
        Track(
            id="behavioral",
            kind="behavioral",
            title="Behavioral",
            description="Teamwork, ownership and conflict, answered with the STAR method.",
            focus_skills=["Communication", "Teamwork", "Problem solving"],
            recommended=not technical,
        )
    )
    return tracks


def find_track(profile: Profile, track_id: str) -> Track | None:
    return next((t for t in derive_tracks(profile) if t.id == track_id), None)


def type_plan(track: Track, count: int) -> list[str]:
    """How many of each question type an interview of `count` questions gets."""
    if track.kind == "technical":
        return ["technical"] * count
    if track.kind == "project":
        return ["project"] * count
    if track.kind == "behavioral":
        return ["behavioral"] * count
    # Mixed: open with a project question, end with behavioral, technical in between.
    if count == 1:
        return ["technical"]
    if count == 2:
        return ["project", "technical"]
    behavioral = max(1, round(count * 0.2))
    project = max(1, round(count * 0.2))
    technical = count - behavioral - project
    return ["project"] + ["technical"] * technical + ["project"] * (project - 1) + ["behavioral"] * behavioral
