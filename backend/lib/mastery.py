"""Mastery calculation and adaptive difficulty selection."""
from typing import List, Literal, Optional, Tuple

DIFFICULTY_LEVELS = ["Foundations", "Intermediate", "Advanced"]


def compute_new_mastery(
    current_score: float,
    rubric_avg: float,
    difficulty: str,
    weight: float = 1.0,
) -> float:
    """Updates topic mastery score (0 to 100) using Elo-style update rule.
    - rubric_avg: 0 to 100 (average of 5 rubric dimensions from the turn)
    - difficulty: "Foundations", "Intermediate", "Advanced"
    - weight: scaling factor (0.5 for retrying a learned question)
    """
    # Expected performance benchmark by difficulty
    expected_map = {
        "foundations": 75.0,
        "intermediate": 60.0,
        "advanced": 45.0,
    }
    expected = expected_map.get(difficulty.lower(), 60.0)

    # K-factor for sensitivity
    k = 0.15
    delta = k * (rubric_avg - expected) * weight

    new_score = current_score + delta
    # Clamp strictly between 0.0 and 100.0, rounded to 1 decimal place
    return round(max(0.0, min(100.0, new_score)), 1)


def mastery_to_difficulty(score: float) -> Literal["Foundations", "Intermediate", "Advanced"]:
    """Maps mastery score to recommended difficulty level."""
    if score < 45.0:
        return "Foundations"
    elif score <= 75.0:
        return "Intermediate"
    else:
        return "Advanced"


def step_difficulty(current_diff: str, direction: Literal["up", "down"]) -> str:
    """Steps difficulty up or down within [Foundations, Intermediate, Advanced]."""
    diffs = ["Foundations", "Intermediate", "Advanced"]
    try:
        idx = [d.lower() for d in diffs].index(current_diff.lower())
    except ValueError:
        idx = 1

    if direction == "up":
        new_idx = min(len(diffs) - 1, idx + 1)
    else:
        new_idx = max(0, idx - 1)
    return diffs[new_idx]


def evaluate_adaptation_step(
    recent_rubric_scores: List[float],
    current_diff: str
) -> Tuple[str, Optional[Literal["stepped_up", "stepped_down"]]]:
    """Checks consecutive scores to step up or step down difficulty.
    - 2 consecutive strong answers (>= 75) -> step up
    - 2 consecutive weak answers (<= 55) -> step down
    """
    if len(recent_rubric_scores) < 2:
        return current_diff, None

    last_two = recent_rubric_scores[-2:]
    if all(s >= 75 for s in last_two):
        stepped = step_difficulty(current_diff, "up")
        if stepped.lower() != current_diff.lower():
            return stepped, "stepped_up"
    elif all(s <= 55 for s in last_two):
        stepped = step_difficulty(current_diff, "down")
        if stepped.lower() != current_diff.lower():
            return stepped, "stepped_down"

    return current_diff, None
