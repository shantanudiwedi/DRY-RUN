import os
import json
from typing import List, Optional, Dict
from lib.models import Question, TopicResource

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
QUESTIONS_FILE = os.path.join(DATA_DIR, "questions.json")
RESOURCES_FILE = os.path.join(DATA_DIR, "resources.json")

_questions_cache: List[Question] = []
_resources_cache: Dict[str, TopicResource] = {}

def load_questions() -> List[Question]:
    global _questions_cache
    if not _questions_cache:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                _questions_cache = [Question(**q) for q in data]
        else:
            _questions_cache = []
    return _questions_cache

def load_resources() -> Dict[str, TopicResource]:
    global _resources_cache
    if not _resources_cache:
        if os.path.exists(RESOURCES_FILE):
            with open(RESOURCES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                _resources_cache = {k: TopicResource(**v) for k, v in data.items()}
        else:
            _resources_cache = {}
    return _resources_cache

def get_topics() -> List[str]:
    return [
        "Arrays",
        "Strings",
        "Linked lists",
        "Trees",
        "Graphs",
        "Dynamic programming"
    ]

def get_all_questions(
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    q_type: Optional[str] = None
) -> List[Question]:
    questions = load_questions()
    filtered = questions
    if topic:
        filtered = [q for q in filtered if q.topic.lower() == topic.lower()]
    if difficulty:
        filtered = [q for q in filtered if q.difficulty.lower() == difficulty.lower()]
    if q_type:
        filtered = [q for q in filtered if q.type.lower() == q_type.lower()]
    return filtered

def get_question_by_id(question_id: str) -> Optional[Question]:
    questions = load_questions()
    for q in questions:
        if q.id == question_id:
            return q
    return None

def get_topic_resource(topic: str) -> Optional[TopicResource]:
    resources = load_resources()
    for t_name, res in resources.items():
        if t_name.lower() == topic.lower():
            return res
    return None

import random

def select_initial_question(
    topic: str,
    difficulty: str = "Adaptive",
    mode: str = "viva"
) -> Optional[Question]:
    questions = load_questions()
    q_type = "coding" if mode == "code" else "concept"
    
    # Filter by type
    candidates = [q for q in questions if q.type == q_type]

    # Filter by topic if not "Surprise me"
    if topic.strip().lower() != "surprise me":
        candidates = [q for q in candidates if q.topic.lower() == topic.strip().lower()]

    if not candidates:
        return None

    # Filter by difficulty
    if difficulty.lower() == "adaptive":
        # Adaptive sessions start with Foundations or Intermediate
        adaptive_pool = [q for q in candidates if q.difficulty in ("Foundations", "Intermediate")]
        if adaptive_pool:
            candidates = adaptive_pool
    else:
        diff_pool = [q for q in candidates if q.difficulty.lower() == difficulty.lower()]
        if diff_pool:
            candidates = diff_pool

    # Return a randomly selected initial question to avoid looping or predictable starts
    return random.choice(candidates)


def select_next_question(
    topic: str,
    difficulty: str = "Adaptive",
    mode: str = "viva",
    excluded_ids: Optional[List[str]] = None,
) -> Optional[Question]:
    questions = load_questions()
    q_type = "coding" if mode == "code" else "concept"
    excluded_set = set(excluded_ids or [])

    # Filter by type and exclude already asked questions to guarantee no repeats
    candidates = [q for q in questions if q.type == q_type and q.id not in excluded_set]

    # Filter by topic if not "Surprise me"
    if topic.strip().lower() != "surprise me":
        candidates = [q for q in candidates if q.topic.lower() == topic.strip().lower()]

    if not candidates:
        return None

    # Filter by difficulty
    if difficulty.lower() != "adaptive":
        diff_pool = [q for q in candidates if q.difficulty.lower() == difficulty.lower()]
        if diff_pool:
            candidates = diff_pool

    return random.choice(candidates)
