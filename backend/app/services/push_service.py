import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def send_push(subscription_info: dict, title: str, body: str) -> tuple[bool, str | None]:
    """Send a web push notification. Returns (success, error_message)."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return False, "VAPID keys not configured"

    try:
        from pywebpush import webpush, WebPushException  # lazy import

        webpush(
            subscription_info=subscription_info,
            data=json.dumps({"title": title, "body": body}),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
            ttl=3600,
        )
        return True, None
    except Exception as e:
        logger.error(f"Push error: {e}")
        return False, str(e)
