import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.instructor import Instructor
from app.models.lesson import Lesson
from app.models.push_subscription import PushSubscription
from app.models.reminder_log import ReminderLog
from app.models.student import Student
from app.services import push_service, twilio_service

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

# Each reminder window is ±15 minutes around the target lead time
_WINDOWS = [
    (timedelta(hours=23, minutes=45), timedelta(hours=24, minutes=15), "24h"),
    (timedelta(minutes=45), timedelta(hours=1, minutes=15), "1h"),
]


async def _already_sent(db, lesson_id, reminder_type: str, channel: str) -> bool:
    result = await db.scalar(
        select(ReminderLog).where(
            ReminderLog.lesson_id == lesson_id,
            ReminderLog.reminder_type == reminder_type,
            ReminderLog.channel == channel,
            ReminderLog.status == "sent",
        )
    )
    return result is not None


async def _log(db, lesson: Lesson, student: Student, instructor: Instructor, reminder_type: str, channel: str, success: bool, error: str | None) -> None:
    db.add(ReminderLog(
        lesson_id=lesson.id,
        student_id=student.id,
        instructor_id=instructor.id,
        reminder_type=reminder_type,
        channel=channel,
        status="sent" if success else "failed",
        error_message=error,
    ))


async def _process_lesson(
    db,
    lesson: Lesson,
    student: Student,
    instructor: Instructor,
    reminder_type: str,
) -> None:
    wants_sms = student.reminder_preference in ("sms", "both")
    wants_push = student.reminder_preference in ("push", "both")

    if wants_sms and student.phone:
        if not await _already_sent(db, lesson.id, reminder_type, "sms"):
            msg = twilio_service.build_sms(
                student.name, lesson.start_time, lesson.duration_minutes, lesson.location, reminder_type
            )
            ok, err = twilio_service.send_sms(student.phone, msg)
            await _log(db, lesson, student, instructor, reminder_type, "sms", ok, err)

    if wants_push:
        subs_result = await db.execute(
            select(PushSubscription).where(PushSubscription.instructor_id == instructor.id)
        )
        for sub in subs_result.scalars().all():
            if not await _already_sent(db, lesson.id, reminder_type, "push"):
                msg = twilio_service.build_sms(
                    student.name, lesson.start_time, lesson.duration_minutes, lesson.location, reminder_type
                )
                ok, err = push_service.send_push(
                    {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                    "DriveCoach Reminder",
                    msg,
                )
                await _log(db, lesson, student, instructor, reminder_type, "push", ok, err)


async def check_reminders() -> None:
    """Called every 15 minutes. Queries lessons due for 24h or 1h reminders."""
    now = datetime.now(timezone.utc)
    logger.info("Scheduler: checking reminders at %s", now.isoformat())

    async with AsyncSessionLocal() as db:
        for offset_start, offset_end, reminder_type in _WINDOWS:
            window_start = now + offset_start
            window_end = now + offset_end

            result = await db.execute(
                select(Lesson, Student, Instructor)
                .join(Student, Student.id == Lesson.student_id)
                .join(Instructor, Instructor.id == Lesson.instructor_id)
                .where(
                    Lesson.start_time >= window_start,
                    Lesson.start_time < window_end,
                    Lesson.status == "upcoming",
                    Student.reminder_preference != "none",
                    # Automated reminders are a Pro feature
                    Instructor.plan == "pro",
                )
            )
            for lesson, student, instructor in result.all():
                try:
                    await _process_lesson(db, lesson, student, instructor, reminder_type)
                except Exception as e:
                    logger.error("Error processing %s reminder for lesson %s: %s", reminder_type, lesson.id, e)

        await db.commit()


def start() -> None:
    if not scheduler.running:
        scheduler.add_job(check_reminders, "interval", minutes=15, id="check_reminders", replace_existing=True)
        scheduler.start()
        logger.info("Scheduler started — reminder checks every 15 minutes")


def stop() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
