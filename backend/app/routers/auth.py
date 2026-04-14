from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models.instructor import Instructor
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.instructor import InstructorResponse
from app.services.auth_service import (
    create_access_token,
    generate_refresh_token,
    get_current_instructor,
    hash_password,
    rotate_refresh_token,
    store_refresh_token,
    verify_password,
)


router = APIRouter()

_REFRESH_COOKIE = "refresh_token"
_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=False,  # Switch to True in production (HTTPS only)
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
        path="/auth",
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(Instructor).where(Instructor.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    instructor = Instructor(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
        phone=body.phone,
    )
    db.add(instructor)
    await db.flush()

    plain, hashed = generate_refresh_token()
    await store_refresh_token(db, instructor.id, hashed)

    _set_refresh_cookie(response, plain)
    return TokenResponse(access_token=create_access_token(instructor.id))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(Instructor).where(Instructor.email == body.email))
    instructor = result.scalar_one_or_none()

    # Constant-time check: verify even on miss to avoid timing attacks
    if not instructor or not verify_password(body.password, instructor.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    plain, hashed = generate_refresh_token()
    await store_refresh_token(db, instructor.id, hashed)

    _set_refresh_cookie(response, plain)
    return TokenResponse(access_token=create_access_token(instructor.id))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    plain = request.cookies.get(_REFRESH_COOKIE)
    if not plain:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    new_plain, instructor_id = await rotate_refresh_token(db, plain)
    _set_refresh_cookie(response, new_plain)
    return TokenResponse(access_token=create_access_token(instructor_id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    _current: Instructor = Depends(get_current_instructor),
) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, path="/auth")


@router.get("/me", response_model=InstructorResponse)
async def me(current: Instructor = Depends(get_current_instructor)) -> Instructor:
    return current
