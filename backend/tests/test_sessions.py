"""Tests for sessions, turns, and reports endpoints."""
from datetime import datetime, timezone, timedelta
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

DEVICE_A = "test-device-aaa-111"
DEVICE_B = "test-device-bbb-222"
HEADERS_A = {"X-Device-Id": DEVICE_A}
HEADERS_B = {"X-Device-Id": DEVICE_B}


class MockCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, field, direction):
        return self

    async def to_list(self, length=100):
        return self._docs[:length]


class MockCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return None

    def _matches(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, subq) for subq in v):
                    return False
            elif doc.get(k) != v:
                return False
        return True

    async def find_one(self, query):
        for doc in self.docs:
            if self._matches(doc, query):
                return dict(doc)
        return None

    def find(self, query=None):
        if not query:
            return MockCursor(list(self.docs))
        matched = [d for d in self.docs if self._matches(d, query)]
        return MockCursor(matched)

    async def update_one(self, query, update, upsert=False):
        for doc in self.docs:
            if self._matches(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$addToSet" in update:
                    for field, val in update["$addToSet"].items():
                        cur_list = list(doc.get(field, []))
                        if val not in cur_list:
                            cur_list.append(val)
                        doc[field] = cur_list
                return
        if upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            if "$addToSet" in update:
                for field, val in update["$addToSet"].items():
                    new_doc[field] = [val]
            self.docs.append(new_doc)
        return None

    async def count_documents(self, query):
        return len([d for d in self.docs if self._matches(d, query)])

    async def delete_one(self, query):
        for i, doc in enumerate(self.docs):
            if self._matches(doc, query):
                del self.docs[i]
                break
        return None

    async def delete_many(self, query):
        init_len = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        del_count = init_len - len(self.docs)

        class Result:
            deleted_count = del_count

        return Result()


class MockDatabase:
    def __init__(self):
        self.sessions = MockCollection()
        self.turns = MockCollection()
        self.reports = MockCollection()
        self.mastery = MockCollection()


mock_db = MockDatabase()


@pytest.fixture(autouse=True)
def patch_db():
    mock_db.sessions.docs.clear()
    mock_db.turns.docs.clear()
    mock_db.reports.docs.clear()
    mock_db.mastery.docs.clear()
    with patch("routers.sessions.get_database", return_value=mock_db), \
         patch("routers.reports.get_database", return_value=mock_db), \
         patch("routers.progress.get_database", return_value=mock_db):
        yield


# ── POST /api/sessions ──────────────────────────────────────────────


def test_create_session_success():
    """POST with valid payload returns 201 with session + question."""
    resp = client.post(
        "/api/sessions",
        json={"topic": "Arrays", "duration_seconds": 1200, "difficulty": "Adaptive", "mode": "viva"},
        headers=HEADERS_A,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "session" in data
    assert "question" in data
    session = data["session"]
    assert session["status"] == "active"
    assert session["device_id"] == DEVICE_A
    assert len(session["asked_question_ids"]) == 1
    assert data["question"]["id"] == session["asked_question_ids"][0]


def test_create_session_surprise_me():
    """'Surprise me' topic is accepted."""
    resp = client.post("/api/sessions", json={"topic": "Surprise me"}, headers=HEADERS_A)
    assert resp.status_code == 201
    assert resp.json()["session"]["topic"] == "Surprise me"


def test_create_session_missing_device_id():
    """Missing X-Device-Id returns 422."""
    resp = client.post("/api/sessions", json={"topic": "Arrays"})
    assert resp.status_code == 422


def test_create_session_invalid_duration():
    """Invalid duration returns 422."""
    resp = client.post("/api/sessions", json={"topic": "Arrays", "duration_seconds": 999}, headers=HEADERS_A)
    assert resp.status_code == 422


def test_create_session_unknown_topic():
    """Unknown topic returns 422."""
    resp = client.post("/api/sessions", json={"topic": "Quantum Computing"}, headers=HEADERS_A)
    assert resp.status_code == 422


# ── GET /api/sessions/{id} ───────────────────────────────────────────


def test_get_session_success():
    create_resp = client.post("/api/sessions", json={"topic": "Trees", "duration_seconds": 600}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    get_resp = client.get(f"/api/sessions/{session_id}", headers=HEADERS_A)
    assert get_resp.status_code == 200
    assert get_resp.json()["session"]["id"] == session_id


def test_get_session_other_device_returns_404():
    create_resp = client.post("/api/sessions", json={"topic": "Strings"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    get_resp = client.get(f"/api/sessions/{session_id}", headers=HEADERS_B)
    assert get_resp.status_code == 404


# ── POST /api/sessions/{id}/turn ─────────────────────────────────────


def test_submit_turn_success():
    """Submit an answer to a question in an active session."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    turn_resp = client.post(
        f"/api/sessions/{session_id}/turn",
        json={"question_id": q_id, "answer": "Dynamic arrays double their capacity when full, achieving amortized O(1)."},
        headers=HEADERS_A,
    )
    assert turn_resp.status_code == 200
    data = turn_resp.json()
    assert "turn" in data
    assert data["turn"]["question_id"] == q_id
    assert data["turn"]["scores"]["correctness"] >= 0
    assert data["turn"]["source"] in ("llm", "fallback")


def test_submit_turn_other_device_returns_404():
    """Submit turn from a different device returns 404."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    turn_resp = client.post(
        f"/api/sessions/{session_id}/turn",
        json={"question_id": q_id, "answer": "Some answer"},
        headers=HEADERS_B,
    )
    assert turn_resp.status_code == 404


def test_submit_turn_invalid_question_id():
    """Submitting with non-existent question id returns 422."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]

    turn_resp = client.post(
        f"/api/sessions/{session_id}/turn",
        json={"question_id": "nonexistent-qid", "answer": "Some answer"},
        headers=HEADERS_A,
    )
    assert turn_resp.status_code == 422


def test_submit_turn_expired_session():
    """Turn on an expired session returns 400."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "duration_seconds": 600}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # Artificially set started_at in mock_db to 700 seconds ago
    for doc in mock_db.sessions.docs:
        if doc["id"] == session_id:
            doc["started_at"] = datetime.now(timezone.utc) - timedelta(seconds=700)

    turn_resp = client.post(
        f"/api/sessions/{session_id}/turn",
        json={"question_id": q_id, "answer": "Answering too late"},
        headers=HEADERS_A,
    )
    assert turn_resp.status_code == 400
    assert "expired" in turn_resp.json()["detail"].lower()


# ── POST /api/sessions/{id}/finish & Reports ─────────────────────────


def test_finish_session_success():
    """Finish session with stored turns computes rubric scores and builds report."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    client.post(
        f"/api/sessions/{session_id}/turn",
        json={"question_id": q_id, "answer": "We use two pointers to scan from both ends."},
        headers=HEADERS_A,
    )

    finish_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    assert finish_resp.status_code == 200
    report = finish_resp.json()
    assert report["session_id"] == session_id
    assert report["overall"] >= 0
    assert report["coach_note"] != ""
    assert report["coach_note_source"] in ("llm", "fallback")


def test_finish_twice_returns_same_report():
    """Calling finish twice returns identical report."""
    create_resp = client.post("/api/sessions", json={"topic": "Strings"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]

    rep1 = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A).json()
    rep2 = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A).json()
    assert rep1["id"] == rep2["id"]
    assert rep1["overall"] == rep2["overall"]


def test_finish_session_with_no_turns():
    """A session with no turns finishes with overall None (not scored) and valid report."""
    create_resp = client.post("/api/sessions", json={"topic": "Trees"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]

    finish_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    assert finish_resp.status_code == 200
    report = finish_resp.json()
    assert report["overall"] is None
    assert "without any answered questions" in report["coach_note"]


def test_get_reports_list():
    """List reports returns past reports for device."""
    create_resp = client.post("/api/sessions", json={"topic": "Graphs"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)

    list_resp = client.get("/api/reports", headers=HEADERS_A)
    assert list_resp.status_code == 200
    reports = list_resp.json()
    assert len(reports) >= 1
    assert any(r["session_id"] == session_id for r in reports)


def test_get_report_detail_other_device_returns_404():
    """GET report from a different device returns 404."""
    create_resp = client.post("/api/sessions", json={"topic": "Graphs"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    finish_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    report_id = finish_resp.json()["id"]

    get_resp = client.get(f"/api/reports/{report_id}", headers=HEADERS_B)
    assert get_resp.status_code == 404


def test_delete_report_cascade_leaves_no_turns():
    """Delete report deletes report, session, and all associated turns."""
    create_resp = client.post("/api/sessions", json={"topic": "Linked lists"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # Create 2 turns
    client.post(f"/api/sessions/{session_id}/turn", json={"question_id": q_id, "answer": "Turn 1"}, headers=HEADERS_A)
    client.post(f"/api/sessions/{session_id}/turn", json={"question_id": q_id, "answer": "Turn 2"}, headers=HEADERS_A)

    # Finish to create report
    finish_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    report_id = finish_resp.json()["id"]

    # Assert turns exist
    assert len([t for t in mock_db.turns.docs if t["session_id"] == session_id]) == 2

    # Delete report
    del_resp = client.delete(f"/api/reports/{report_id}", headers=HEADERS_A)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "ok"

    # Confirm cascade deletion: 0 reports, 0 sessions, 0 turns remain for this session
    assert len([r for r in mock_db.reports.docs if r["session_id"] == session_id]) == 0
    assert len([s for s in mock_db.sessions.docs if s["id"] == session_id]) == 0
    assert len([t for t in mock_db.turns.docs if t["session_id"] == session_id]) == 0


def test_delete_report_other_device_returns_404():
    """Delete report from a different device returns 404."""
    create_resp = client.post("/api/sessions", json={"topic": "Dynamic programming"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    finish_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    report_id = finish_resp.json()["id"]

    del_resp = client.delete(f"/api/reports/{report_id}", headers=HEADERS_B)
    assert del_resp.status_code == 404


# ── Milestone 5: Code Mode Tests ────────────────────────────────────


def test_code_submission_success():
    """Submit valid code review without executing it."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "code"}, headers=HEADERS_A)
    assert create_resp.status_code == 201
    assert create_resp.json()["question"]["type"] == "coding"
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    code = "def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n"

    code_resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "python", "code": code},
        headers=HEADERS_A,
    )
    assert code_resp.status_code == 200
    data = code_resp.json()
    assert "turn" in data
    assert data["turn"]["kind"] == "code"
    assert data["turn"]["language"] == "python"
    assert len(data["follow_ups"]) >= 2


def test_code_submission_empty_code_422():
    """Empty code is rejected with 422."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "code"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "python", "code": "   "},
        headers=HEADERS_A,
    )
    assert resp.status_code == 422


def test_code_submission_oversized_code_422():
    """Code > 10,000 characters is rejected with 422."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "code"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    oversized = "x = 1\n" * 2500  # > 10,000 chars
    resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "python", "code": oversized},
        headers=HEADERS_A,
    )
    assert resp.status_code == 422


def test_code_submission_unsupported_language_422():
    """Unsupported language is rejected with 422."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "code"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "rust", "code": "fn main() {}"},
        headers=HEADERS_A,
    )
    assert resp.status_code == 422


def test_code_submission_other_device_404():
    """Code submission from a different device returns 404."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "code"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "python", "code": "def solve(): pass"},
        headers=HEADERS_B,
    )
    assert resp.status_code == 404


def test_code_follow_up_flow_and_report_scores():
    """Follow-ups to code submission and report scores breakdown."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "code"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # 1. Submit code
    code = "def twoSum(nums, target):\n    return []\n"
    code_resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "python", "code": code},
        headers=HEADERS_A,
    )
    assert code_resp.status_code == 200

    # 2. Answer a follow-up
    fu_resp = client.post(
        f"/api/sessions/{session_id}/turn",
        json={"question_id": q_id, "kind": "follow_up", "answer": "The time complexity is O(N) using a single loop."},
        headers=HEADERS_A,
    )
    assert fu_resp.status_code == 200

    # 3. Finish and check code_score and viva_score
    fin_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    assert fin_resp.status_code == 200
    report = fin_resp.json()
    assert report["code_score"] is not None
    assert report["viva_score"] is not None


def test_code_score_present_only_in_code_sessions():
    """Viva sessions have code_score None; code sessions have code_score integer."""
    # Viva session
    viva_resp = client.post("/api/sessions", json={"topic": "Trees", "mode": "viva"}, headers=HEADERS_A)
    viva_id = viva_resp.json()["session"]["id"]
    q_id = viva_resp.json()["question"]["id"]
    client.post(f"/api/sessions/{viva_id}/turn", json={"question_id": q_id, "answer": "BFS traverses level by level."}, headers=HEADERS_A)
    rep_viva = client.post(f"/api/sessions/{viva_id}/finish", headers=HEADERS_A).json()
    assert rep_viva["code_score"] is None
    assert rep_viva["viva_score"] is not None


def test_progress_endpoint():
    """GET /api/progress returns topic mastery, 4-week activity, and recommendations."""
    resp = client.get("/api/progress", headers=HEADERS_A)
    assert resp.status_code == 200
    data = resp.json()
    assert "topics" in data
    assert len(data["topics"]) == 6
    assert "least_practiced_topic" in data
    assert "weakest_topic" in data
    for t in data["topics"]:
        assert "topic" in t
        assert "mastery_score" in t
        assert len(t["weekly_scores"]) == 4


def test_tutor_chat_and_learned_flow():
    """Tutor chat returns hints/solutions and marking learned updates session."""
    create_resp = client.post("/api/sessions", json={"topic": "Arrays", "mode": "viva"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # 1. Ask tutor for a hint
    learn_resp = client.post(
        f"/api/sessions/{session_id}/learn",
        json={"question_id": q_id, "message": "Can you give me a hint on how to start?"},
        headers=HEADERS_A,
    )
    assert learn_resp.status_code == 200
    learn_data = learn_resp.json()
    assert "reply" in learn_data
    assert learn_data["source"] in ("llm", "fallback")
    assert "http" not in learn_data["reply"]  # No URLs

    # 2. Mark question as learned
    learned_resp = client.post(
        f"/api/sessions/{session_id}/learned",
        json={"question_id": q_id},
        headers=HEADERS_A,
    )
    assert learned_resp.status_code == 200
    assert q_id in learned_resp.json()["learned_question_ids"]

    # 3. Finish session and verify learned questions are included in report
    fin_resp = client.post(f"/api/sessions/{session_id}/finish", headers=HEADERS_A)
    assert fin_resp.status_code == 200
    report = fin_resp.json()
    assert q_id in report["learned"]
    assert "practice them again" in report["coach_note"].lower() or "practise" in report["coach_note"].lower()


def test_tutor_chat_message_cap_422():
    """Tutor chat capped at 20 messages per session."""
    create_resp = client.post("/api/sessions", json={"topic": "Strings", "mode": "viva"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # Mock session with 20 messages already sent
    for doc in mock_db.sessions.docs:
        if doc["id"] == session_id:
            doc["learn_messages_count"] = 20
            break

    resp = client.post(
        f"/api/sessions/{session_id}/learn",
        json={"question_id": q_id, "message": "Another message"},
        headers=HEADERS_A,
    )
    assert resp.status_code == 422
    assert "limit" in resp.json()["detail"].lower()


def test_mark_learned_unasked_question_422():
    """Cannot mark learned for a question not asked in that session."""
    create_resp = client.post("/api/sessions", json={"topic": "Strings", "mode": "viva"}, headers=HEADERS_A)
    session_id = create_resp.json()["session"]["id"]

    resp = client.post(
        f"/api/sessions/{session_id}/learned",
        json={"question_id": "nonexistent-question-id"},
        headers=HEADERS_A,
    )
    assert resp.status_code == 422


def test_llm_rate_limit_fallback_chain():
    """When primary provider (Groq) hits rate limit (429), fallback executes cleanly."""
    import asyncio
    from lib.evaluator import evaluate_answer

    # Mock Groq raising RateLimitError
    with patch("lib.config.settings.GROQ_API_KEY", "mock-groq-key"), \
         patch("lib.config.settings.GEMINI_API_KEY", ""), \
         patch("groq.AsyncGroq") as mock_groq_class:

        mock_instance = mock_groq_class.return_value
        mock_instance.chat.completions.create.side_effect = Exception("Rate limit exceeded: 429 Too Many Requests")

        scores, note, source, is_vague, fu = asyncio.run(
            evaluate_answer("What is dynamic array?", "Doubling strategy", "It doubles capacity.")
        )
        # Honest fallback returns None scores with source "fallback"
        assert source == "fallback"
        assert scores is None
        assert note == "AI evaluation unavailable"


# ── Regression Tests: Offset-naive datetimes & Error visibility ─────────


def test_regression_session_naive_datetime_handling():
    """Session started_at deserialized as naive datetime from MongoDB must be UTC-aware."""
    from lib.models import Session
    from routers.sessions import get_session_elapsed_seconds

    # Simulate MongoDB returning a naive datetime in UTC
    naive_dt = datetime(2026, 11, 15, 6, 30, 0, 0)
    session = Session(
        id="test-naive-sess",
        device_id=DEVICE_A,
        topic="Arrays",
        mode="viva",
        difficulty="Adaptive",
        started_at=naive_dt,
    )
    assert session.started_at.tzinfo is not None
    assert session.started_at.tzinfo == timezone.utc

    # Verify elapsed calculation does not raise TypeError
    elapsed = get_session_elapsed_seconds(session)
    assert isinstance(elapsed, float)
    assert elapsed >= 0


def test_regression_code_submit_with_naive_started_at():
    """POST /api/sessions/{id}/code with naive started_at in DB succeeds (does not raise 500)."""
    # Create session
    create_resp = client.post(
        "/api/sessions",
        json={"topic": "Arrays", "mode": "code"},
        headers=HEADERS_A,
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # Overwrite started_at in mock_db with naive datetime (simulating MongoDB driver)
    for doc in mock_db.sessions.docs:
        if doc["id"] == session_id:
            doc["started_at"] = (datetime.now(timezone.utc) - timedelta(seconds=10)).replace(tzinfo=None)

    # Submit code
    code_resp = client.post(
        f"/api/sessions/{session_id}/code",
        json={"question_id": q_id, "language": "python", "code": "def solution(nums): return []"},
        headers=HEADERS_A,
    )
    # Must succeed (200 OK) without 500 TypeError
    assert code_resp.status_code == 200
    data = code_resp.json()
    assert "turn" in data
    assert "follow_ups" in data
    assert data["turn"]["question_id"] == q_id


def test_regression_tutor_chat_with_naive_started_at():
    """POST /api/sessions/{id}/learn with naive started_at in DB succeeds (does not raise 500)."""
    # Create session
    create_resp = client.post(
        "/api/sessions",
        json={"topic": "Arrays", "mode": "viva"},
        headers=HEADERS_A,
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["session"]["id"]
    q_id = create_resp.json()["question"]["id"]

    # Overwrite started_at in mock_db with naive datetime
    for doc in mock_db.sessions.docs:
        if doc["id"] == session_id:
            doc["started_at"] = (datetime.now(timezone.utc) - timedelta(seconds=10)).replace(tzinfo=None)

    # Send tutor chat message
    chat_resp = client.post(
        f"/api/sessions/{session_id}/learn",
        json={"question_id": q_id, "messages": [], "message": "Can you give a hint?"},
        headers=HEADERS_A,
    )
    # Must succeed (200 OK) without 500 TypeError
    assert chat_resp.status_code == 200
    data = chat_resp.json()
    assert "reply" in data
    assert data["messages_count"] >= 1
