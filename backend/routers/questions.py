from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException, status
from lib.questions import (
    get_all_questions,
    get_topics,
    get_question_by_id,
    get_topic_resource,
    load_resources
)
from lib.models import Question, TopicResource

router = APIRouter(tags=["questions"])

@router.get("/questions")
async def list_questions(
    topic: Optional[str] = Query(None, description="Filter by topic"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    type: Optional[str] = Query(None, description="Filter by type (concept | coding)")
):
    questions = get_all_questions(topic=topic, difficulty=difficulty, q_type=type)
    return {
        "topics": get_topics(),
        "total": len(questions),
        "questions": questions
    }

@router.get("/questions/{question_id}", response_model=Question)
async def get_question(question_id: str):
    q = get_question_by_id(question_id)
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question '{question_id}' not found."
        )
    return q

@router.get("/resources")
async def get_resources(
    topic: Optional[str] = Query(None, description="Topic name")
):
    if not topic:
        # Return all available resources keyed by topic
        return load_resources()
    
    resource = get_topic_resource(topic)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No resources found for topic '{topic}'. Available topics: {', '.join(get_topics())}"
        )
    return resource
