from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from lib.auth import require_device_id
from lib.db import get_database
from lib.questions import get_topics
from lib.models import ProgressResponse, TopicProgress

router = APIRouter(tags=["progress"])


@router.get("/progress", response_model=ProgressResponse)
async def get_progress(device_id: str = Depends(require_device_id)):
    """Returns mastery score and weekly 4-week performance per topic for the device."""
    try:
        db = get_database()
        all_topics = get_topics()

        # 1. Fetch all mastery docs for this device
        cursor = db.mastery.find({"device_id": device_id})
        mastery_docs = await cursor.to_list(length=100)
        mastery_map = {doc["topic"].lower(): float(doc.get("score", 50.0)) for doc in mastery_docs}

        # 2. 4 weeks boundaries for weekly activity & mastery heatmap
        now = datetime.now(timezone.utc)
        week_cutoffs = [
            (now - timedelta(days=28), now - timedelta(days=21)),  # Week 1 (oldest)
            (now - timedelta(days=21), now - timedelta(days=14)),  # Week 2
            (now - timedelta(days=14), now - timedelta(days=7)),   # Week 3
            (now - timedelta(days=7), now),                        # Week 4 (current)
        ]

        # Fetch past reports for this device
        rep_cursor = db.reports.find({"device_id": device_id})
        reports = await rep_cursor.to_list(length=200)

        topic_progresses = []
        for t in all_topics:
            t_lower = t.lower()
            cur_mastery = mastery_map.get(t_lower, 50.0)

            # Reports for this topic
            t_reports = [r for r in reports if r.get("topic", "").lower() == t_lower]
            practice_count = len(t_reports)

            # Weekly averages
            weekly = []
            for w_start, w_end in week_cutoffs:
                w_reps = [
                    r for r in t_reports
                    if w_start <= r.get("created_at", now) < w_end
                ]
                if w_reps:
                    w_avg = sum(r.get("overall", 0) for r in w_reps) / len(w_reps)
                    weekly.append(round(float(w_avg), 1))
                else:
                    weekly.append(0.0)

            topic_progresses.append(
                TopicProgress(
                    topic=t,
                    mastery_score=cur_mastery,
                    weekly_scores=weekly,
                    practice_count=practice_count,
                )
            )

        # Least practised topic
        least_practiced = min(topic_progresses, key=lambda x: (x.practice_count, x.mastery_score)).topic
        # Weakest topic
        weakest = min(topic_progresses, key=lambda x: x.mastery_score).topic

        return ProgressResponse(
            topics=topic_progresses,
            least_practiced_topic=least_practiced,
            weakest_topic=weakest,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database unavailable: {type(exc).__name__}",
        )
