from uuid import uuid4
from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, status
from lib.auth import require_device_id
from lib.db import get_database
from lib.models import (
    SessionCreate,
    SessionResponse,
    Session,
    Turn,
    TurnCreate,
    TurnResponse,
    CodeSubmissionCreate,
    CodeSubmissionResponse,
    Report,
    RubricScores,
    TutorChatRequest,
    TutorChatResponse,
    MarkLearnedRequest,
    MarkLearnedResponse,
    utc_now,
)

def get_session_elapsed_seconds(session: Session) -> float:
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    return (utc_now() - started_at).total_seconds()
from lib.questions import (
    get_topics,
    select_initial_question,
    select_next_question,
    get_question_by_id,
)
from lib.evaluator import (
    evaluate_answer,
    generate_coach_note,
    review_code,
    tutor_chat,
)
from lib.mastery import compute_new_mastery

router = APIRouter(tags=["sessions"])


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(
    payload: SessionCreate,
    device_id: str = Depends(require_device_id),
):
    # Validate topic
    valid_topics = get_topics() + ["Surprise me"]
    matched_topic = None
    for t in valid_topics:
        if t.lower() == payload.topic.strip().lower():
            matched_topic = t
            break
    if matched_topic is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown topic '{payload.topic}'. Valid topics: {', '.join(valid_topics)}",
        )

    # Select the initial question
    question = select_initial_question(
        topic=matched_topic,
        difficulty=payload.difficulty,
        mode=payload.mode,
    )
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions found for topic '{matched_topic}' with difficulty '{payload.difficulty}' and mode '{payload.mode}'.",
        )

    # Build the session document
    session = Session(
        id=str(uuid4()),
        device_id=device_id,
        topic=matched_topic,
        mode=payload.mode,
        difficulty=payload.difficulty,
        duration_seconds=payload.duration_seconds,
        status="active",
        started_at=utc_now(),
        asked_question_ids=[question.id],
        learned_question_ids=[],
    )

    # Persist to MongoDB — fail loudly on DB errors (503, no silent fallback)
    try:
        db = get_database()
        await db.sessions.insert_one(session.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable. Please try again later. ({type(exc).__name__})",
        )

    return SessionResponse(session=session, question=question)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        doc = await db.sessions.find_one({"id": session_id})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable. Please try again later. ({type(exc).__name__})",
        )

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    # Scope by device — another device's session returns 404
    if doc.get("device_id") != device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = Session(**{k: v for k, v in doc.items() if k != "_id"})

    # Load the current question (last asked)
    current_question_id = session.asked_question_ids[-1] if session.asked_question_ids else None
    question = get_question_by_id(current_question_id) if current_question_id else None

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Session exists but the current question could not be loaded.",
        )

    return SessionResponse(session=session, question=question)


@router.post("/sessions/{session_id}/turn", response_model=TurnResponse)
async def submit_turn(
    session_id: str,
    payload: TurnCreate,
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        doc = await db.sessions.find_one({"id": session_id})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable. ({type(exc).__name__})",
        )

    if doc is None or doc.get("device_id") != device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = Session(**{k: v for k, v in doc.items() if k != "_id"})

    # Enforce session duration server-side
    elapsed = get_session_elapsed_seconds(session)
    if elapsed >= session.duration_seconds:
        if session.status != "expired":
            await db.sessions.update_one({"id": session_id}, {"$set": {"status": "expired"}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has expired. Time limit exceeded.",
        )

    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit turn on a {session.status} session.",
        )

    # Validate question_id against bank
    question = get_question_by_id(payload.question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid question ID '{payload.question_id}'.",
        )

    # Evaluate the answer via Groq -> Gemini -> Fallback
    scores, note, source, is_vague, follow_up = await evaluate_answer(
        prompt=question.prompt,
        reference=question.reference_answer,
        answer=payload.answer,
    )

    turn = Turn(
        id=str(uuid4()),
        session_id=session.id,
        device_id=device_id,
        question_id=question.id,
        kind=payload.kind,
        answer=payload.answer,
        scores=scores,
        note=note,
        source=source,
        created_at=utc_now(),
    )

    try:
        await db.turns.insert_one(turn.model_dump())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to record turn: {type(exc).__name__}",
        )

    # Update topic mastery for evaluated viva turn only if scored by LLM
    if source == "llm" and scores is not None:
        rubric_avg = (
            scores.correctness + scores.approach + scores.complexity + scores.edge_cases + scores.communication
        ) / 5.0
        target_topic = question.topic if session.topic == "Surprise me" else session.topic
        mastery_doc = await db.mastery.find_one({"device_id": device_id, "topic": target_topic})
        cur_score = mastery_doc.get("score", 50.0) if mastery_doc else 50.0
        weight = 0.5 if question.id in session.learned_question_ids else 1.0
        new_mastery = compute_new_mastery(cur_score, rubric_avg, question.difficulty, weight=weight)
        await db.mastery.update_one(
            {"device_id": device_id, "topic": target_topic},
            {"$set": {"score": new_mastery, "updated_at": utc_now()}},
            upsert=True,
        )

    # Follow-up check: if answer was vague and this turn was not already a follow-up
    if is_vague and payload.kind != "follow_up":
        fu_text = follow_up or question.follow_up
        return TurnResponse(
            turn=turn,
            next_question=None,
            follow_up=fu_text,
            session_status="active",
        )

    # Otherwise select next question without repetition
    next_q = select_next_question(
        topic=session.topic,
        difficulty=session.difficulty,
        mode=session.mode,
        excluded_ids=session.asked_question_ids,
    )

    if next_q:
        updated_asked = session.asked_question_ids + [next_q.id]
        await db.sessions.update_one(
            {"id": session_id},
            {"$set": {"asked_question_ids": updated_asked}},
        )
        return TurnResponse(
            turn=turn,
            next_question=next_q,
            follow_up=None,
            session_status="active",
        )
    else:
        # All questions in pool for topic/difficulty exhausted
        await db.sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "finished", "finished_at": utc_now()}},
        )
        return TurnResponse(
            turn=turn,
            next_question=None,
            follow_up=None,
            session_status="finished",
        )


@router.post("/sessions/{session_id}/code", response_model=CodeSubmissionResponse)
async def submit_code(
    session_id: str,
    payload: CodeSubmissionCreate,
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        doc = await db.sessions.find_one({"id": session_id})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )

    if doc is None or doc.get("device_id") != device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = Session(**{k: v for k, v in doc.items() if k != "_id"})

    # Check duration
    elapsed = get_session_elapsed_seconds(session)
    if elapsed >= session.duration_seconds:
        if session.status != "expired":
            await db.sessions.update_one({"id": session_id}, {"$set": {"status": "expired"}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has expired. Time limit exceeded.",
        )

    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit code on a {session.status} session.",
        )

    # Validate language
    allowed_langs = ["python", "javascript", "java", "cpp"]
    if payload.language.lower() not in allowed_langs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported language '{payload.language}'. Supported: {', '.join(allowed_langs)}",
        )

    # Validate code length
    code_text = payload.code.strip()
    if not code_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Code submission cannot be empty.",
        )
    if len(payload.code) > 10000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Code submission exceeds 10,000 characters limit.",
        )

    # Validate question
    question = get_question_by_id(payload.question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid question ID '{payload.question_id}'.",
        )

    # Review code WITHOUT executing it
    scores, review_note, source, follow_ups = await review_code(
        prompt=question.prompt,
        reference_answer=question.reference_answer,
        language=payload.language,
        code=payload.code,
    )

    turn = Turn(
        id=str(uuid4()),
        session_id=session.id,
        device_id=device_id,
        question_id=question.id,
        kind="code",
        code=payload.code,
        language=payload.language,
        scores=scores,
        note=review_note,
        source=source,
        follow_ups=follow_ups,
        created_at=utc_now(),
    )

    await db.turns.insert_one(turn.model_dump())

    # Update topic mastery for code turn only if scored by LLM
    if source == "llm" and scores is not None:
        rubric_avg = (
            scores.correctness + scores.approach + scores.complexity + scores.edge_cases + scores.communication
        ) / 5.0
        target_topic = question.topic if session.topic == "Surprise me" else session.topic
        mastery_doc = await db.mastery.find_one({"device_id": device_id, "topic": target_topic})
        cur_score = mastery_doc.get("score", 50.0) if mastery_doc else 50.0
        weight = 0.5 if question.id in session.learned_question_ids else 1.0
        new_mastery = compute_new_mastery(cur_score, rubric_avg, question.difficulty, weight=weight)
        await db.mastery.update_one(
            {"device_id": device_id, "topic": target_topic},
            {"$set": {"score": new_mastery, "updated_at": utc_now()}},
            upsert=True,
        )

    return CodeSubmissionResponse(turn=turn, follow_ups=follow_ups)


@router.post("/sessions/{session_id}/finish", response_model=Report)
async def finish_session(
    session_id: str,
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        doc = await db.sessions.find_one({"id": session_id})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable. ({type(exc).__name__})",
        )

    if doc is None or doc.get("device_id") != device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = Session(**{k: v for k, v in doc.items() if k != "_id"})

    # Calling finish twice returns the same report (idempotent)
    existing_report = await db.reports.find_one({"session_id": session_id, "device_id": device_id})
    if existing_report:
        return Report(**{k: v for k, v in existing_report.items() if k != "_id"})

    # Fetch stored turns for this session
    cursor = db.turns.find({"session_id": session_id, "device_id": device_id}).sort("created_at", 1)
    turns_docs = await cursor.to_list(length=100)

    code_score = None
    viva_score = None

    # Exclude fallback (unscored) turns from report averages
    scored_turns = [t for t in turns_docs if t.get("scores") is not None and t.get("source") != "fallback"]

    if scored_turns:
        c = round(sum(t.get("scores", {}).get("correctness", 0) for t in scored_turns) / len(scored_turns))
        a = round(sum(t.get("scores", {}).get("approach", 0) for t in scored_turns) / len(scored_turns))
        comp = round(sum(t.get("scores", {}).get("complexity", 0) for t in scored_turns) / len(scored_turns))
        e = round(sum(t.get("scores", {}).get("edge_cases", 0) for t in scored_turns) / len(scored_turns))
        comm = round(sum(t.get("scores", {}).get("communication", 0) for t in scored_turns) / len(scored_turns))
        overall = round((c + a + comp + e + comm) / 5)
        dims = RubricScores(
            correctness=c,
            approach=a,
            complexity=comp,
            edge_cases=e,
            communication=comm,
        )

        # Separate code_score and viva_score
        code_turns = [t for t in scored_turns if t.get("kind") == "code"]
        viva_turns = [t for t in scored_turns if t.get("kind") in ("viva", "follow_up")]

        if code_turns:
            code_score = round(
                sum(
                    (
                        t.get("scores", {}).get("correctness", 0)
                        + t.get("scores", {}).get("approach", 0)
                        + t.get("scores", {}).get("complexity", 0)
                        + t.get("scores", {}).get("edge_cases", 0)
                        + t.get("scores", {}).get("communication", 0)
                    )
                    / 5.0
                    for t in code_turns
                )
                / len(code_turns)
            )

        if viva_turns:
            viva_score = round(
                sum(
                    (
                        t.get("scores", {}).get("correctness", 0)
                        + t.get("scores", {}).get("approach", 0)
                        + t.get("scores", {}).get("complexity", 0)
                        + t.get("scores", {}).get("edge_cases", 0)
                        + t.get("scores", {}).get("communication", 0)
                    )
                    / 5.0
                    for t in viva_turns
                )
                / len(viva_turns)
            )
        elif session.mode == "viva":
            viva_score = overall

        dim_map = [
            ("Correctness", c),
            ("Approach", a),
            ("Complexity", comp),
            ("Edge cases", e),
            ("Communication", comm),
        ]
        weak_topics = [name for name, score in dim_map if score < 70]
        if not weak_topics:
            lowest = min(dim_map, key=lambda x: x[1])
            if lowest[1] < 85:
                weak_topics = [lowest[0]]

        coach_note, note_source = await generate_coach_note(session.topic, overall, dims, weak_topics)
    else:
        # No scored turns in this session (e.g. all fallback or empty session)
        overall = None
        dims = None
        code_score = None
        viva_score = None
        weak_topics = []
        if turns_docs:
            coach_note = "AI evaluation was unavailable; no turns were scored in this session. Re-try submitting your answers to obtain rubric scores."
        else:
            coach_note = "Session ended without any answered questions. Practice out loud to build your interview readiness!"
        note_source = "fallback"

    if session.learned_question_ids:
        coach_note += " You reviewed key concepts during this session; be sure to practice them again to lock in mastery."

    # Mark session finished
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "finished", "finished_at": utc_now()}},
    )

    # In "viva" mode, code_score must be None
    if session.mode == "viva":
        code_score = None
        viva_score = overall if viva_score is None else viva_score

    report = Report(
        id=str(uuid4()),
        session_id=session.id,
        device_id=device_id,
        topic=session.topic,
        mode=session.mode,
        overall=overall,
        dimensions=dims,
        code_score=code_score,
        viva_score=viva_score,
        weak_topics=weak_topics,
        coach_note=coach_note,
        coach_note_source=note_source,
        questions_asked=session.asked_question_ids,
        learned=session.learned_question_ids,
        created_at=utc_now(),
    )

    await db.reports.insert_one(report.model_dump())
    return report


@router.post("/sessions/{session_id}/end", response_model=Report)
async def end_session(
    session_id: str,
    device_id: str = Depends(require_device_id),
):
    """End session early and generate report."""
    return await finish_session(session_id=session_id, device_id=device_id)


@router.post("/sessions/{session_id}/learn", response_model=TutorChatResponse)
async def chat_with_tutor(
    session_id: str,
    payload: TutorChatRequest,
    device_id: str = Depends(require_device_id),
):
    """Socratic tutor chat for a question in an active session."""
    try:
        db = get_database()
        doc = await db.sessions.find_one({"id": session_id})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )

    if doc is None or doc.get("device_id") != device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = Session(**{k: v for k, v in doc.items() if k != "_id"})

    # Check duration / status
    elapsed = get_session_elapsed_seconds(session)
    if elapsed >= session.duration_seconds:
        if session.status != "expired":
            await db.sessions.update_one({"id": session_id}, {"$set": {"status": "expired"}})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has expired. Time limit exceeded.",
        )

    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot chat with tutor on a {session.status} session.",
        )

    # Message limit check: Cap each session at 20 tutor messages
    cur_count = session.learn_messages_count
    if cur_count >= 20:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tutor message limit of 20 reached for this session.",
        )

    # Validate question_id
    question = get_question_by_id(payload.question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid question ID '{payload.question_id}'.",
        )

    # Call tutor chat (max 6 messages from history)
    reply, source = await tutor_chat(
        prompt=question.prompt,
        reference_answer=question.reference_answer,
        history=payload.messages[-6:] if payload.messages else [],
        student_message=payload.message,
    )

    new_count = cur_count + 1
    await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"learn_messages_count": new_count}},
    )

    return TutorChatResponse(
        reply=reply,
        source=source,
        messages_count=new_count,
    )


@router.post("/sessions/{session_id}/learned", response_model=MarkLearnedResponse)
async def mark_question_learned(
    session_id: str,
    payload: MarkLearnedRequest,
    device_id: str = Depends(require_device_id),
):
    """Mark a question as learned during a session."""
    try:
        db = get_database()
        doc = await db.sessions.find_one({"id": session_id})
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )

    if doc is None or doc.get("device_id") != device_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    session = Session(**{k: v for k, v in doc.items() if k != "_id"})

    # Validate that question was asked in this session
    if payload.question_id not in session.asked_question_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Question '{payload.question_id}' was not asked in this session.",
        )

    # Idempotent addition
    updated_learned = list(dict.fromkeys(session.learned_question_ids + [payload.question_id]))
    await db.sessions.update_one(
        {"id": session_id},
        {"$addToSet": {"learned_question_ids": payload.question_id}},
    )

    return MarkLearnedResponse(
        status="ok",
        learned_question_ids=updated_learned,
    )
