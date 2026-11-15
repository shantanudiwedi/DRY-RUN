import os
os.environ["TESTING"] = "true"

import pytest
from fastapi.testclient import TestClient
from server import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_list_questions(client):
    res = client.get("/api/questions")
    assert res.status_code == 200
    data = res.json()
    assert "topics" in data
    assert "questions" in data
    assert data["total"] >= 54  # 36 concept + 18 coding questions
    assert len(data["topics"]) == 6

def test_filter_questions_by_topic_and_difficulty(client):
    res = client.get("/api/questions?topic=Arrays&difficulty=Foundations")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    for q in data["questions"]:
        assert q["topic"] == "Arrays"
        assert q["difficulty"] == "Foundations"

def test_get_single_question_positive_and_negative(client):
    # Positive test
    pos_res = client.get("/api/questions/arr-con-01")
    assert pos_res.status_code == 200
    assert pos_res.json()["id"] == "arr-con-01"

    # Negative test (not found)
    neg_res = client.get("/api/questions/nonexistent-question-id-xyz")
    assert neg_res.status_code == 404

def test_get_resources_positive_and_negative(client):
    # Positive test: all resources
    all_res = client.get("/api/resources")
    assert all_res.status_code == 200
    all_data = all_res.json()
    assert "Arrays" in all_data
    assert isinstance(all_data["Arrays"]["videos"], list)
    assert len(all_data["Arrays"]["cheat_sheet"]) > 50

    # Positive test: specific topic
    topic_res = client.get("/api/resources?topic=Dynamic%20programming")
    assert topic_res.status_code == 200
    assert "videos" in topic_res.json()
    assert "cheat_sheet" in topic_res.json()

    # Negative test: non-existent topic
    neg_res = client.get("/api/resources?topic=NonExistentTopic")
    assert neg_res.status_code == 404


def test_video_resource_11_char_validation():
    """VideoResource must strictly validate 11-character YouTube ID format."""
    from pydantic import ValidationError
    from lib.models import VideoResource

    # Valid 11-char ID
    valid_vid = VideoResource(youtube_id="1234567890a", title="Valid Video")
    assert valid_vid.youtube_id == "1234567890a"

    # Invalid ID (too short)
    with pytest.raises(ValidationError):
        VideoResource(youtube_id="short", title="Invalid")

    # Invalid ID (too long)
    with pytest.raises(ValidationError):
        VideoResource(youtube_id="1234567890abcde", title="Invalid")

    # Invalid ID (special characters not in base64url)
    with pytest.raises(ValidationError):
        VideoResource(youtube_id="123456789$!", title="Invalid")
