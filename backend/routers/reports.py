from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from lib.auth import require_device_id
from lib.db import get_database
from lib.models import (
    Report,
    ReportListItem,
    ReportDetailResponse,
    Session,
    Turn,
    Question,
)
from lib.questions import get_question_by_id

router = APIRouter(tags=["reports"])


@router.get("/reports", response_model=List[ReportListItem])
async def list_reports(
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        cursor = db.reports.find({"device_id": device_id}).sort("created_at", -1)
        reports_docs = await cursor.to_list(length=100)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )

    result: List[ReportListItem] = []
    for r in reports_docs:
        # Count turns for this session
        turns_count = await db.turns.count_documents({"session_id": r["session_id"]})
        result.append(
            ReportListItem(
                id=r.get("id", r["session_id"]),
                session_id=r["session_id"],
                topic=r.get("topic", "DSA"),
                mode=r.get("mode", "viva"),
                overall=r.get("overall"),
                created_at=r["created_at"],
                duration_seconds=r.get("duration_seconds", 1200),
                turns_count=turns_count,
            )
        )
    return result


@router.get("/reports/{report_id}", response_model=ReportDetailResponse)
async def get_report_detail(
    report_id: str,
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        # Look up by id or session_id
        doc = await db.reports.find_one({
            "$or": [{"id": report_id}, {"session_id": report_id}],
            "device_id": device_id,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    report = Report(**{k: v for k, v in doc.items() if k != "_id"})

    # Fetch corresponding session
    session_doc = await db.sessions.find_one({"id": report.session_id, "device_id": device_id})
    if not session_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated session not found.",
        )
    session = Session(**{k: v for k, v in session_doc.items() if k != "_id"})

    # Fetch turns
    cursor = db.turns.find({"session_id": report.session_id, "device_id": device_id}).sort("created_at", 1)
    turns_docs = await cursor.to_list(length=100)
    turns = [Turn(**{k: v for k, v in t.items() if k != "_id"}) for t in turns_docs]

    # Resolve questions
    questions_map = {}
    for t in turns:
        q = get_question_by_id(t.question_id)
        if q and q.id not in questions_map:
            questions_map[q.id] = q
    for qid in session.asked_question_ids:
        if qid not in questions_map:
            q = get_question_by_id(qid)
            if q:
                questions_map[qid] = q

    return ReportDetailResponse(
        report=report,
        session=session,
        turns=turns,
        questions=list(questions_map.values()),
    )


@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str,
    device_id: str = Depends(require_device_id),
):
    try:
        db = get_database()
        doc = await db.reports.find_one({
            "$or": [{"id": report_id}, {"session_id": report_id}],
            "device_id": device_id,
        })
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    session_id = doc["session_id"]

    # Cascade delete: report, session, and all turns
    await db.reports.delete_one({"session_id": session_id, "device_id": device_id})
    await db.sessions.delete_one({"id": session_id, "device_id": device_id})
    del_turns = await db.turns.delete_many({"session_id": session_id, "device_id": device_id})

    return {
        "status": "ok",
        "deleted_report_id": report_id,
        "deleted_session_id": session_id,
        "deleted_turns_count": del_turns.deleted_count,
    }
