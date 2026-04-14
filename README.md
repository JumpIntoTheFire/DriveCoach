# DriveCoach

> Progressive Web App for independent driving instructors. Bookings, automated SMS/push reminders, earnings tracking, Stripe billing. Built to run from a phone.

## What it solves

Independent driving instructors run their business from their phone between lessons. They need:

- A calendar that handles bookings without friction
- Reminders to students that don't require them to remember to send
- A way to track earnings without spreadsheets
- A tool that works offline, installs without an app store, and doesn't cost £20/month

DriveCoach is that tool.

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite + TypeScript (PWA) | Installs like a native app on mobile; no app store review; fast builds |
| Backend | FastAPI (Python 3.11), async SQLAlchemy | Async-native, automatic OpenAPI docs, easy to test |
| Database | PostgreSQL 16, Alembic migrations | Reliable, supports JSON columns, strong tooling |
| Auth | JWT (python-jose) + bcrypt (passlib) | No third-party auth service, refresh tokens server-rotated |
| Scheduling | APScheduler | Runs inside FastAPI for automated reminder dispatch |
| SMS | Twilio | Reliable UK SMS, pay-per-message, swappable later |
| Push | Web Push API via `pywebpush` | Free, works with PWA, fallback to SMS if push fails |
| Payments | Stripe | UK-compliant, SCA built in, clean webhook integration |
| Infra | Docker Compose | One command to run the full stack locally or on a server |

## Features

- **Calendar view** — `react-big-calendar` for day/week views; create, edit, reschedule lessons
- **Student management** — CRUD with lesson history per student
- **Automated reminders** — SMS 24h + 1h before each lesson (dispatched by APScheduler + Twilio)
- **Web Push reminders** — free alternative to SMS, falls back automatically
- **Freemium model** — free for 5 students / 30 SMS per month; Pro unlocks unlimited
- **Stripe billing** — Customer Portal for managing subscription; webhook-driven plan updates
- **Earnings dashboard** — lessons today, week earnings, total students
- **CSV export** — lessons export for tax / admin
- **Offline fallback** — service worker handles the no-connection case

## Quick start (Docker)

**Prerequisites:** Docker Desktop.

```bash
git clone https://github.com/JumpIntoTheFire/DriveCoach.git
cd DriveCoach

# Copy env template and fill in values
cp .env.example .env

# Start everything
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| **1 — Foundation** | 🔄 In progress | Docker stack, FastAPI skeleton, PostgreSQL schema, JWT auth, basic student CRUD |
| **2 — Bookings & Calendar** | 📋 Planned | Lesson CRUD, calendar view, dashboard metrics |
| **3 — Reminders** | 📋 Planned | Twilio + APScheduler, Web Push, reminder preferences per student |
| **4 — Freemium & Payments** | 📋 Planned | Feature gating, Stripe checkout + webhooks, Customer Portal |
| **5 — Testing & Security Hardening** | 📋 Planned | Full pytest + Vitest coverage, rate limiting, dependency audit, HTTPS |
| **6 — Polish & Launch** | 📋 Planned | PWA manifest, onboarding, earnings report, mobile audit, VPS deploy |

## Security

Designed in from Phase 1, hardened in Phase 5:

- Passwords hashed with **bcrypt**; plaintext never stored
- **JWT access tokens** (30-min expiry) + **refresh tokens** in `httpOnly` cookies (7-day expiry, rotated on use)
- **Rate limiting** on auth endpoints (5/min per IP via `slowapi`)
- **Pydantic validation** on all input — unexpected fields rejected
- **Parameterised queries only** (SQLAlchemy ORM) — no string-formatted SQL
- **Row-level scoping** — every query enforces `WHERE instructor_id = current_user.id`
- **Stripe webhook signature verification** before trusting any event
- All secrets loaded from `.env`; app refuses to start in production without `SECRET_KEY`
- `pip-audit` + `npm audit` run before each phase milestone

## Project structure

```
DriveCoach/
├── frontend/                  React PWA
│   ├── public/
│   │   └── manifest.json      PWA config (name, icons, install behaviour)
│   └── src/
│       ├── api/               axios instance + API call functions
│       ├── components/        reusable UI
│       ├── pages/             one file per screen
│       ├── hooks/             custom React hooks
│       └── context/           AuthContext (minimal global state)
│
├── backend/                   FastAPI
│   └── app/
│       ├── main.py            app entry, router registration
│       ├── config.py          pydantic-settings, loaded from .env
│       ├── database.py        async SQLAlchemy engine + session factory
│       ├── models/            ORM models (one file per table)
│       ├── schemas/           Pydantic request/response schemas
│       ├── routers/           route handlers (auth, students, bookings)
│       ├── services/          business logic (reminder, stripe)
│       └── scheduler.py       APScheduler jobs
│
├── nginx/                     reverse proxy for production
└── docker-compose.yml
```

## Development principles

- **Solve what exists now.** No abstraction until there are three concrete uses.
- **API first.** Every feature starts with the FastAPI route. Frontend follows.
- **No ORM magic.** Explicit queries with `select()`, no dynamic relationship tricks.
- **Migrations for everything.** Never `ALTER TABLE` manually; always `alembic revision`.
- **Readable over clever.** Comment the *why*, not the *what*.

## About

Built by [Jack Tyson](https://github.com/JumpIntoTheFire) — full-stack developer, retained firefighter, boxing coach, writer. Based in the UK.
