import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings

logger = logging.getLogger(__name__)

_UK_TZ = ZoneInfo("Europe/London")


def _local_time(start_time: datetime) -> str:
    """Format a UTC datetime as a UK local time string, e.g. '10:00 AM'."""
    local = start_time.astimezone(_UK_TZ)
    return local.strftime("%-I:%M %p")


def _local_datetime(start_time: datetime) -> str:
    """Format a UTC datetime as a UK date+time string, e.g. 'Monday 12 April at 10:00 AM'."""
    local = start_time.astimezone(_UK_TZ)
    return local.strftime("%A %-d %B at %-I:%M %p")


def build_sms(
    student_name: str,
    start_time: datetime,
    duration_minutes: int,
    location: str | None,
    reminder_type: str,
) -> str:
    loc = f" at {location}" if location else ""

    if reminder_type == "24h":
        return (
            f"Hi {student_name}, your driving lesson is tomorrow at {_local_time(start_time)}"
            f" ({duration_minutes} mins){loc}. Reply STOP to opt out."
        )
    if reminder_type == "1h":
        return (
            f"Hi {student_name}, your driving lesson is in 1 hour at {_local_time(start_time)}{loc}. See you soon!"
        )
    # manual
    return f"Hi {student_name}, reminder: your driving lesson is on {_local_datetime(start_time)}{loc}."


def send_sms(to: str, body: str) -> tuple[bool, str | None]:
    """Send an SMS via Twilio. Returns (success, error_message)."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio not configured — SMS skipped")
        return False, "Twilio not configured"

    try:
        from twilio.rest import Client  # imported lazily so missing package doesn't break startup

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(body=body, from_=settings.TWILIO_FROM_NUMBER, to=to)
        logger.info(f"SMS sent to {to}")
        return True, None
    except Exception as e:
        logger.error(f"Twilio error sending to {to}: {e}")
        return False, str(e)
