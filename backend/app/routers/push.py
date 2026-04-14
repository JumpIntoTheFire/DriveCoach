from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.instructor import Instructor
from app.models.push_subscription import PushSubscription
from app.services.auth_service import get_current_instructor

router = APIRouter()


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": str, "auth": str}


@router.get("/vapid-public-key")
async def get_vapid_public_key() -> dict:
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications not configured",
        )
    return {"vapid_public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    body: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> dict:
    """Register a push subscription endpoint for the current instructor."""
    existing = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    )
    if existing:
        return {"message": "Already subscribed"}

    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")
    if not p256dh or not auth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing p256dh or auth key",
        )

    db.add(
        PushSubscription(
            instructor_id=current.id,
            endpoint=body.endpoint,
            p256dh=p256dh,
            auth=auth,
        )
    )
    await db.commit()
    return {"message": "Subscribed"}


@router.delete("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    body: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current: Instructor = Depends(get_current_instructor),
) -> None:
    """Remove a push subscription."""
    sub = await db.scalar(
        select(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint,
            PushSubscription.instructor_id == current.id,
        )
    )
    if sub:
        await db.delete(sub)
        await db.commit()
