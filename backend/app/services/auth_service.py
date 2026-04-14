import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.instructor import Instructor
from app.models.refresh_token import RefreshToken


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(instructor_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(instructor_id), "type": "access", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
    """Returns (plain_token, hashed_token). Store only the hash."""
    plain = secrets.token_urlsafe(32)
    return plain, _hash_token(plain)


async def store_refresh_token(
    db: AsyncSession,
    instructor_id: uuid.UUID,
    token_hash: str,
) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    record = RefreshToken(
        instructor_id=instructor_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(record)
    await db.flush()


async def rotate_refresh_token(
    db: AsyncSession,
    plain_token: str,
) -> tuple[str, uuid.UUID]:
    """Validates the old refresh token, marks it used, issues a new one.

    Returns (new_plain_token, instructor_id).
    """
    token_hash = _hash_token(plain_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.used_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Mark old token as consumed — prevents replay
    record.used_at = datetime.now(timezone.utc)
    await db.flush()

    new_plain, new_hash = generate_refresh_token()
    await store_refresh_token(db, record.instructor_id, new_hash)

    return new_plain, record.instructor_id


async def get_current_instructor(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Instructor:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise ValueError("Wrong token type")
        instructor_id = uuid.UUID(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    instructor = result.scalar_one_or_none()
    if not instructor:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Instructor not found")
    return instructor
