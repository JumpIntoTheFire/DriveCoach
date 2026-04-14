import logging

from app.config import settings

logger = logging.getLogger(__name__)

FREE_STUDENT_LIMIT = 5
FREE_SMS_MONTHLY_LIMIT = 30


def _client():
    """Return a configured Stripe module. Lazy import so missing key doesn't break startup."""
    import stripe as _stripe
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    _stripe.api_key = settings.STRIPE_SECRET_KEY
    return _stripe


def create_checkout_session(
    instructor_id: str,
    instructor_email: str,
    stripe_customer_id: str | None,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout Session for the Pro plan. Returns the session URL."""
    stripe = _client()

    # Reuse existing customer or let Stripe create one
    kwargs: dict = {
        "mode": "subscription",
        "line_items": [{"price": settings.STRIPE_PRO_PRICE_ID, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"instructor_id": instructor_id},
        "subscription_data": {"metadata": {"instructor_id": instructor_id}},
    }
    if stripe_customer_id:
        kwargs["customer"] = stripe_customer_id
    else:
        kwargs["customer_email"] = instructor_email

    session = stripe.checkout.Session.create(**kwargs)
    return session.url


def create_portal_session(stripe_customer_id: str, return_url: str) -> str:
    """Create a Stripe Customer Portal session. Returns the portal URL."""
    stripe = _client()
    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=return_url,
    )
    return session.url


def parse_webhook_event(payload: bytes, sig_header: str):
    """Verify Stripe webhook signature and return the event object."""
    import stripe as _stripe
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")
    # construct_event raises SignatureVerificationError on bad signature
    return _stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
