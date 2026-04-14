import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.instructor import Instructor
from app.services import stripe_service
from app.services.auth_service import get_current_instructor

logger = logging.getLogger(__name__)

router = APIRouter()

# Frontend origin used for success/cancel/return URLs — set FRONTEND_URL in .env for production
from app.config import settings as _settings
_FRONTEND = _settings.FRONTEND_URL


class CheckoutResponse(BaseModel):
    url: str


@router.post("/create-checkout-session", response_model=CheckoutResponse)
async def create_checkout_session(
    current: Instructor = Depends(get_current_instructor),
) -> CheckoutResponse:
    if current.plan == "pro":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already on Pro plan",
        )
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_PRO_PRICE_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payments not configured",
        )
    try:
        url = stripe_service.create_checkout_session(
            instructor_id=str(current.id),
            instructor_email=current.email,
            stripe_customer_id=current.stripe_customer_id,
            success_url=f"{_FRONTEND}/billing?success=1",
            cancel_url=f"{_FRONTEND}/billing?cancelled=1",
        )
        return CheckoutResponse(url=url)
    except Exception as e:
        logger.error("Stripe checkout session error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create checkout session",
        )


@router.get("/portal", response_model=CheckoutResponse)
async def customer_portal(
    current: Instructor = Depends(get_current_instructor),
) -> CheckoutResponse:
    if not current.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Please upgrade first.",
        )
    try:
        url = stripe_service.create_portal_session(
            stripe_customer_id=current.stripe_customer_id,
            return_url=f"{_FRONTEND}/billing",
        )
        return CheckoutResponse(url=url)
    except Exception as e:
        logger.error("Stripe portal session error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to open billing portal",
        )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Stripe fires events here when subscriptions change.
    Verify signature before trusting any event data — never trust the client.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.warning("Webhook received but STRIPE_WEBHOOK_SECRET not configured — ignoring")
        return {"received": False}

    try:
        event = stripe_service.parse_webhook_event(payload, sig_header)
    except Exception as e:
        logger.warning("Webhook signature verification failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    event_type = event["type"]
    logger.info("Stripe webhook received: %s", event_type)

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        instructor_id = session.get("metadata", {}).get("instructor_id")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        if instructor_id:
            await _upgrade_instructor(db, instructor_id, customer_id, subscription_id)

    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        if customer_id:
            await _downgrade_by_customer(db, customer_id)

    return {"received": True}


async def _upgrade_instructor(
    db: AsyncSession,
    instructor_id: str,
    customer_id: str | None,
    subscription_id: str | None,
) -> None:
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    instructor = result.scalar_one_or_none()
    if not instructor:
        logger.warning("Webhook: instructor %s not found", instructor_id)
        return
    instructor.plan = "pro"
    if customer_id:
        instructor.stripe_customer_id = customer_id
    if subscription_id:
        instructor.stripe_subscription_id = subscription_id
    await db.commit()
    logger.info("Upgraded instructor %s to Pro", instructor_id)


async def _downgrade_by_customer(db: AsyncSession, customer_id: str) -> None:
    result = await db.execute(
        select(Instructor).where(Instructor.stripe_customer_id == customer_id)
    )
    instructor = result.scalar_one_or_none()
    if not instructor:
        logger.warning("Webhook: no instructor with customer_id %s", customer_id)
        return
    instructor.plan = "free"
    instructor.stripe_subscription_id = None
    await db.commit()
    logger.info("Downgraded instructor %s to Free", instructor.id)
