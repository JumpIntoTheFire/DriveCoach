import uuid
from datetime import datetime

from pydantic import BaseModel

VALID_STATUSES = {"upcoming", "completed", "cancelled", "rescheduled"}


class LessonCreate(BaseModel):
    student_id: uuid.UUID
    start_time: datetime
    duration_minutes: int = 60
    location: str | None = None
    price: float | None = None
    status: str = "upcoming"


class LessonUpdate(BaseModel):
    student_id: uuid.UUID | None = None
    start_time: datetime | None = None
    duration_minutes: int | None = None
    location: str | None = None
    price: float | None = None
    status: str | None = None


class LessonResponse(BaseModel):
    id: uuid.UUID
    instructor_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    start_time: datetime
    duration_minutes: int
    location: str | None
    price: float | None
    status: str
    created_at: datetime
