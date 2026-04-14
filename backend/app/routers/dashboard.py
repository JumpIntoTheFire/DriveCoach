from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.instructor import Instructor
from app.models.lesson import Lesson
from app.models.student import Student
from app.services.auth_service import get_current_instructor


router = APIRouter()


@router.get("/metrics")
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Monday of current week
    week_start = today_start - timedelta(days=today_start.weekday())
    week_end = week_start + timedelta(days=7)

    total_students = await db.scalar(
        select(func.count()).select_from(Student).where(
            Student.instructor_id == current.id,
            Student.is_active == True,  # noqa: E712
        )
    )

    lessons_today = await db.scalar(
        select(func.count()).select_from(Lesson).where(
            Lesson.instructor_id == current.id,
            Lesson.start_time >= today_start,
            Lesson.start_time < today_end,
            Lesson.status != "cancelled",
        )
    )

    week_earnings = await db.scalar(
        select(func.coalesce(func.sum(Lesson.price), 0)).where(
            Lesson.instructor_id == current.id,
            Lesson.start_time >= week_start,
            Lesson.start_time < week_end,
            Lesson.status == "completed",
        )
    )

    return {
        "total_students": total_students or 0,
        "lessons_today": lessons_today or 0,
        "week_earnings": float(week_earnings or 0),
    }
