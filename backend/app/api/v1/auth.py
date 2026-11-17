import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    TokenPayload,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    require_roles,
    verify_password,
)
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_count, _unit = settings.LOGIN_RATE_LIMIT.split("/")
LOGIN_MAX_ATTEMPTS = int(_count)
LOGIN_WINDOW_SECONDS = {"second": 1, "minute": 60, "hour": 3600}[_unit.strip()]

# shortcut: in-process memory, one API container only; move to Redis if the API scales out.
# Keyed by email, not IP: behind Caddy + the tunnel every request shares one proxy IP.
_login_attempts: dict[str, deque[float]] = defaultdict(deque)


def _check_login_rate(email: str) -> None:
    now = time.monotonic()
    attempts = _login_attempts[email.lower()]
    while attempts and now - attempts[0] > LOGIN_WINDOW_SECONDS:
        attempts.popleft()
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        retry_after = int(LOGIN_WINDOW_SECONDS - (now - attempts[0])) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            headers={"Retry-After": str(retry_after)},
            detail={
                "error": {
                    "code": "TOO_MANY_REQUESTS",
                    "message": f"Too many login attempts. Try again in {retry_after} seconds.",
                    "details": [],
                }
            },
        )
    attempts.append(now)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    existing_user = res.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "DUPLICATE_RESOURCE",
                    "message": f"Email address '{payload.email}' is already registered.",
                    "details": [{"field": "email", "message": "Email already registered."}],
                }
            },
        )

    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        role="athlete",  # public sign-up is always athlete; admins are created by seeding
        weight_kg=payload.weight_kg,
        base_kcal_goal=payload.base_kcal_goal,
        protein_goal_g=payload.protein_goal_g,
        carbs_goal_g=payload.carbs_goal_g,
        fat_goal_g=payload.fat_goal_g,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    response.headers["Location"] = f"{settings.API_V1_PREFIX}/auth/me"
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates credentials and returns JWT Bearer access and refresh tokens.",
)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    _check_login_rate(payload.email)
    stmt = select(User).where(User.email == payload.email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "INVALID_CREDENTIALS",
                    "message": "Invalid email or password.",
                    "details": [],
                }
            },
        )

    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id, role=user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_current_user_profile(
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": "User account does not exist.",
                    "details": [],
                }
            },
        )
    return user


@router.patch("/me", response_model=UserResponse, summary="Update current user goals or weight")
async def update_current_user_profile(
    payload: UserUpdateRequest,
    token_payload: TokenPayload = Depends(require_roles(["athlete", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    user_id = int(token_payload.sub)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": "User account not found.",
                    "details": [],
                }
            },
        )

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, val)

    await db.commit()
    await db.refresh(user)
    return user
