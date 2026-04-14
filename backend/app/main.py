import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.limiter import limiter
from app.routers import auth, students, lessons, dashboard, reminders, push, billing
from app import scheduler as reminder_scheduler

# Route app.* loggers to stderr alongside uvicorn output
logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    reminder_scheduler.start()
    yield
    reminder_scheduler.stop()


app = FastAPI(title="DriveCoach API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.config import settings as _settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(students.router, prefix="/students", tags=["students"])
app.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(reminders.router, prefix="/reminders", tags=["reminders"])
app.include_router(push.router, prefix="/push", tags=["push"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
