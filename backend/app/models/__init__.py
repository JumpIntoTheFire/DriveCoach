# Import all models here so Alembic can discover them via Base.metadata
from app.models.instructor import Instructor
from app.models.student import Student
from app.models.lesson import Lesson
from app.models.refresh_token import RefreshToken
from app.models.reminder_log import ReminderLog
from app.models.push_subscription import PushSubscription

__all__ = ["Instructor", "Student", "Lesson", "RefreshToken", "ReminderLog", "PushSubscription"]
