import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.instructor import Instructor
from app.models.lesson import Lesson
from app.models.push_subscription import PushSubscription
from app.models.reminder_log import ReminderLog
from app.models.student import Student
from app.services import push_service, twilio_service
from app.services.auth_service import get_current_instructor
from app.services.stripe_service import FREE_SMS_MONTHLY_LIMIT

router = APIRouter()


async def _log(
    db: AsyncSession,
    lesson: Lesson,
    student: Student,
    instructor: Instructor,
    channel: str,
    success: bool,
    error: str | None,
) -> None:
    db.add(
        ReminderLog(
            lesson_id=lesson.id,
            student_id=student.id,
            instructor_id=instructor.id,
            reminder_type="manual",
            channel=channel,
            status="sent" if success else "failed",
            error_message=error,
        )
    )


@router.post("/lessons/{lesson_id}/remind", status_code=status.HTTP_200_OK)
async def send_manual_reminder(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> dict:
    """Send a manual reminder for a lesson via the student's preferred channel(s)."""
    result = await db.execute(
        select(Lesson, Student)
        .join(Student, Student.id == Lesson.student_id)
        .where(Lesson.id == lesson_id, Lesson.instructor_id == current.id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    lesson, student = row

    sms_result: dict | None = None
    push_result: dict | None = None

    wants_sms = student.reminder_preference in ("sms", "both")
    wants_push = student.reminder_preference in ("push", "both")

    # Free tier: max 30 SMS per calendar month
    if wants_sms and current.plan == "free":
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        sms_count = await db.scalar(
            select(func.count(ReminderLog.id)).where(
                ReminderLog.instructor_id == current.id,
                ReminderLog.channel == "sms",
                ReminderLog.status == "sent",
                ReminderLog.sent_at >= month_start,
            )
        )
        if (sms_count or 0) >= FREE_SMS_MONTHLY_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="free_limit_sms",
            )

    if wants_sms:
        if not student.phone:
            sms_result = {"sent": False, "error": "Student has no phone number"}
        else:
            msg = twilio_service.build_sms(
                student.name,
                lesson.start_time,
                lesson.duration_minutes,
                lesson.location,
                "manual",
            )
            ok, err = twilio_service.send_sms(student.phone, msg)
            await _log(db, lesson, student, current, "sms", ok, err)
            sms_result = {"sent": ok, "error": err}

    if wants_push:
        subs_result = await db.execute(
            select(PushSubscription).where(PushSubscription.instructor_id == current.id)
        )
        subs = subs_result.scalars().all()
        if not subs:
            push_result = {"sent": False, "error": "No push subscriptions registered"}
        else:
            msg = twilio_service.build_sms(
                student.name,
                lesson.start_time,
                lesson.duration_minutes,
                lesson.location,
                "manual",
            )
            sent_any = False
            last_error: str | None = None
            for sub in subs:
                ok, err = push_service.send_push(
                    {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                    "DriveCoach Reminder",
                    msg,
                )
                await _log(db, lesson, student, current, "push", ok, err)
                if ok:
                    sent_any = True
                else:
                    last_error = err
            push_result = {"sent": sent_any, "error": last_error if not sent_any else None}

    await db.commit()

    if student.reminder_preference == "none":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Student has opted out of all reminders",
        )

    return {"sms": sms_result, "push": push_result}
