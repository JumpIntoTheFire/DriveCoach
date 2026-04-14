import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

VALID_REMINDER_PREFS = {"sms", "push", "both", "none"}


class StudentCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    reminder_preference: str = "sms"

    @field_validator("reminder_preference")
    @classmethod
    def validate_reminder_preference(cls, v: str) -> str:
        if v not in VALID_REMINDER_PREFS:
            raise ValueError(f"reminder_preference must be one of: {', '.join(sorted(VALID_REMINDER_PREFS))}")
        return v


class StudentUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    reminder_preference: str | None = None

    @field_validator("reminder_preference")
    @classmethod
    def validate_reminder_preference(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_REMINDER_PREFS:
            raise ValueError(f"reminder_preference must be one of: {', '.join(sorted(VALID_REMINDER_PREFS))}")
        return v


class StudentResponse(BaseModel):
    id: uuid.UUID
    instructor_id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    notes: str | None
    is_active: bool
    reminder_preference: str
    created_at: datetime

    model_config = {"from_attributes": True}
