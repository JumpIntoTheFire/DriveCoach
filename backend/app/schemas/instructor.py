import uuid

from pydantic import BaseModel


class InstructorResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: str | None
    plan: str

    model_config = {"from_attributes": True}
