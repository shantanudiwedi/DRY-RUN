from datetime import datetime, timezone
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class RubricScores(BaseModel):
    correctness: int = Field(ge=0, le=100, default=0)
    approach: int = Field(ge=0, le=100, default=0)
    complexity: int = Field(ge=0, le=100, default=0)
    edge_cases: int = Field(ge=0, le=100, default=0)
    communication: int = Field(ge=0, le=100, default=0)

class QuestionExample(BaseModel):
    input: str
    output: str
    explanation: Optional[str] = None

class Question(BaseModel):
    id: str
    topic: str
    difficulty: Literal["Foundations", "Intermediate", "Advanced"]
    type: Literal["concept", "coding"]
    prompt: str
    follow_up: str
    tags: List[str] = []
    reference_answer: str
    examples: Optional[List[QuestionExample]] = None
    constraints: Optional[List[str]] = None

class VideoResource(BaseModel):
    youtube_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{11}$")
    title: str

class TopicResource(BaseModel):
    videos: List[VideoResource] = []
    cheat_sheet: str

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1000)

class TutorChatRequest(BaseModel):
    question_id: str
    messages: List[ChatMessage] = Field(default=[], max_length=6)
    message: str = Field(min_length=1, max_length=1000)

class TutorChatResponse(BaseModel):
    reply: str
    source: Literal["llm", "fallback"] = "llm"
    messages_count: int

class MarkLearnedRequest(BaseModel):
    question_id: str

class MarkLearnedResponse(BaseModel):
    status: str = "ok"
    learned_question_ids: List[str]

class Session(BaseModel):
    id: str
    device_id: str
    topic: str
    mode: Literal["viva", "code"]
    difficulty: Literal["Adaptive", "Foundations", "Intermediate", "Advanced"]
    duration_seconds: int = 1200
    status: Literal["active", "finished", "expired"] = "active"
    started_at: datetime = Field(default_factory=utc_now)
    finished_at: Optional[datetime] = None
    asked_question_ids: List[str] = []
    learned_question_ids: List[str] = []
    learn_messages_count: int = 0

    @field_validator("started_at", "finished_at", mode="before")
    @classmethod
    def ensure_utc_tz(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
            return v.astimezone(timezone.utc)
        if isinstance(v, str):
            if not v.endswith("Z") and "+" not in v and "-" not in v[10:]:
                v = v + "Z"
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        return v

class SessionCreate(BaseModel):
    topic: str
    mode: Literal["viva", "code"] = "viva"
    difficulty: Literal["Adaptive", "Foundations", "Intermediate", "Advanced"] = "Adaptive"
    duration_seconds: Literal[600, 1200, 1800] = 1200

class SessionResponse(BaseModel):
    session: Session
    question: Question

class Turn(BaseModel):
    id: str
    session_id: str
    device_id: str
    question_id: str
    kind: Literal["viva", "code", "follow_up", "learn"]
    answer: Optional[str] = None
    code: Optional[str] = None
    language: Optional[str] = None
    scores: Optional[RubricScores] = None
    note: Optional[str] = None
    source: Literal["llm", "fallback"] = "llm"
    follow_ups: Optional[List[str]] = None
    code_turn_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("created_at", mode="before")
    @classmethod
    def ensure_created_at_tz(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
            return v.astimezone(timezone.utc)
        if isinstance(v, str):
            if not v.endswith("Z") and "+" not in v and "-" not in v[10:]:
                v = v + "Z"
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        return v

class TurnCreate(BaseModel):
    question_id: str
    kind: Literal["viva", "code", "follow_up", "learn"] = "viva"
    answer: str = Field(min_length=1)
    code_turn_id: Optional[str] = None

class CodeSubmissionCreate(BaseModel):
    question_id: str
    language: Literal["python", "javascript", "java", "cpp"]
    code: str = Field(min_length=1, max_length=10000)

class CodeSubmissionResponse(BaseModel):
    turn: Turn
    follow_ups: List[str]

class TurnResponse(BaseModel):
    turn: Turn
    next_question: Optional[Question] = None
    follow_up: Optional[str] = None
    session_status: Literal["active", "finished", "expired"] = "active"

class Report(BaseModel):
    id: str
    session_id: str
    device_id: str
    topic: str
    mode: str = "viva"
    overall: Optional[int] = Field(default=None, ge=0, le=100)
    dimensions: Optional[RubricScores] = None
    code_score: Optional[int] = Field(default=None, ge=0, le=100)
    viva_score: Optional[int] = Field(default=None, ge=0, le=100)
    weak_topics: List[str] = []
    coach_note: str
    coach_note_source: Literal["llm", "fallback"] = "llm"
    questions_asked: List[str] = []
    learned: List[str] = []
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("created_at", mode="before")
    @classmethod
    def ensure_created_at_tz(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
            return v.astimezone(timezone.utc)
        if isinstance(v, str):
            if not v.endswith("Z") and "+" not in v and "-" not in v[10:]:
                v = v + "Z"
            dt = datetime.fromisoformat(v)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        return v

class ReportListItem(BaseModel):
    id: str
    session_id: str
    topic: str
    mode: str
    overall: Optional[int] = None
    created_at: datetime
    duration_seconds: int = 1200
    turns_count: int = 0

class ReportDetailResponse(BaseModel):
    report: Report
    session: Session
    turns: List[Turn]
    questions: List[Question]

class Mastery(BaseModel):
    device_id: str
    topic: str
    score: float = 50.0
    updated_at: datetime = Field(default_factory=utc_now)

class TopicProgress(BaseModel):
    topic: str
    mastery_score: float
    weekly_scores: List[float]
    practice_count: int

class ProgressResponse(BaseModel):
    topics: List[TopicProgress]
    least_practiced_topic: str
    weakest_topic: str
