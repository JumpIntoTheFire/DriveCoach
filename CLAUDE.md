# CLAUDE.md — DriveCoach App

> This file is the single source of truth for Claude Code when working on this project.
> Read it fully before writing any code. Follow these conventions exactly.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack & Why](#tech-stack--why)
3. [Project Structure](#project-structure)
4. [Skills](#skills)
5. [Development Principles](#development-principles)
6. [Roadmap & Phases](#roadmap--phases)
7. [Testing Strategy](#testing-strategy)
8. [Security](#security)
9. [Freemium & Advertising](#freemium--advertising)
10. [Docker Setup](#docker-setup)
11. [Environment Variables](#environment-variables)
12. [Coding Conventions](#coding-conventions)

---

## Project Overview

**DriveCoach** is a Progressive Web App (PWA) for independent driving instructors to:
- Manage student bookings via a calendar
- Send automated SMS/push reminders before lessons
- Track earnings and lesson history
- Offer a free tier for solo instructors, paid tier for multi-student management

Target user: solo driving instructors in the UK, operating from a mobile phone.

---

## Tech Stack & Why

> Each tool has been chosen to match what you already know, minimise new concepts, and keep the stack
> deployable from Docker Desktop with minimal configuration.

### Frontend — React (PWA)
**Why:** You already know React. Built as a PWA so it installs on mobile like a native app without app store
review delays. Uses `vite` for fast builds (faster than Create React App).

**Key libraries:**
- `react-big-calendar` — calendar view for bookings
- `react-hook-form` — simple, performant form handling (no over-engineering with complex state)
- `react-query` (TanStack Query) — server state, caching, and background refetch
- `axios` — HTTP client to talk to FastAPI
- `date-fns` — date formatting/manipulation (lighter than moment.js)

### Backend — FastAPI (Python)
**Why:** You already use it. Async-native, automatic OpenAPI docs at `/docs`, easy to test.
Keeps everything in Python which you know.

**Key libraries:**
- `sqlalchemy` (async) — ORM for database models
- `alembic` — database migrations (tracks schema changes like git does for code)
- `pydantic` — data validation (built into FastAPI)
- `python-jose` + `passlib` — JWT auth tokens and password hashing
- `apscheduler` — scheduled jobs for automatic reminders (runs inside FastAPI)
- `twilio` — SMS sending

### Database — PostgreSQL + pgAdmin
**Why:** You already run this in Docker. Reliable, supports JSON columns, great for scheduling queries.

### Auth — JWT (custom, via FastAPI)
**Why:** Keeps it simple. No third-party auth service to pay for. Instructors log in once on mobile,
token stored in localStorage. Refresh tokens handled server-side.

### SMS — Twilio
**Why:** Industry standard, reliable, pay-per-SMS (no monthly fee on free tier), works in UK.
~£0.04 per SMS. Can swap for a cheaper provider later without changing much code.

### Push Notifications — Web Push API (via `pywebpush`)
**Why:** Free, works with PWA, no Firebase account needed. Falls back to SMS if push fails.

### Payments — Stripe
**Why:** Best documentation, handles UK payments, SCA compliance built in. Free until you take payments.
Webhooks integrate cleanly with FastAPI.

### Containerisation — Docker Compose
**Why:** You already use Docker Desktop. One `docker-compose.yml` spins up frontend, backend,
postgres, and pgAdmin together. Same setup on your machine and any future server.

---

## Project Structure

```
drivecoach/
├── CLAUDE.md               ← this file
├── CHANGELOG.md            ← all changes logged here
├── docker-compose.yml      ← spins up all services
├── .env.example            ← template — copy to .env, never commit .env
│
├── frontend/               ← React PWA
│   ├── public/
│   │   └── manifest.json   ← PWA config (app name, icons, install behaviour)
│   ├── src/
│   │   ├── api/            ← axios instance + all API call functions
│   │   ├── components/     ← reusable UI pieces (Button, Card, Modal...)
│   │   ├── pages/          ← one file per screen (Dashboard, Calendar, Students...)
│   │   ├── hooks/          ← custom React hooks (useStudents, useBookings...)
│   │   ├── context/        ← AuthContext only — keep global state minimal
│   │   └── utils/          ← pure helper functions (formatDate, calcEarnings...)
│   ├── Dockerfile
│   └── vite.config.ts
│
├── backend/                ← FastAPI
│   ├── app/
│   │   ├── main.py         ← FastAPI app entry point, router registration
│   │   ├── config.py       ← settings loaded from .env via pydantic-settings
│   │   ├── database.py     ← async SQLAlchemy engine + session factory
│   │   ├── models/         ← SQLAlchemy ORM models (one file per table)
│   │   ├── schemas/        ← Pydantic request/response schemas
│   │   ├── routers/        ← API route handlers (auth, students, bookings, reminders)
│   │   ├── services/       ← business logic (reminder_service, stripe_service...)
│   │   └── scheduler.py    ← APScheduler jobs for automated reminders
│   ├── alembic/            ← migration files — never edit the DB directly
│   ├── tests/              ← pytest test files
│   ├── requirements.txt
│   └── Dockerfile
│
└── nginx/                  ← reverse proxy in production only
    └── nginx.conf
```

---

## Skills

> These are Claude Code skill files that provide tested patterns for specific tasks.
> Load the relevant skill before working on that area.

```
# When creating or editing React components / UI
@frontend-design  →  /mnt/skills/public/frontend-design/SKILL.md

# When reading uploaded PDF or DOCX files (e.g. user uploads a timetable)
@file-reading     →  /mnt/skills/public/file-reading/SKILL.md

# If generating a PDF export (e.g. lesson invoice)
@pdf              →  /mnt/skills/public/pdf/SKILL.md

# If generating a Word doc (e.g. lesson report)
@docx             →  /mnt/skills/public/docx/SKILL.md
```

---

## Development Principles

These rules prevent over-engineering and keep the codebase learnable:

1. **Solve what exists now.** Don't abstract until you have three concrete uses of the same pattern.
2. **One file per concern.** `students.py` handles students. It does not touch bookings.
3. **No ORM magic.** Write explicit queries. Use `select()` not dynamic relationship tricks.
4. **API first.** Every feature starts with the FastAPI route. Frontend follows.
5. **Plain CSS modules or Tailwind only.** No CSS-in-JS, no styled-components.
6. **Readable over clever.** If a junior dev couldn't read it in 30 seconds, simplify it.
7. **Comment the why, not the what.** `# APScheduler runs in UTC — convert before display` is good.
   `# loop through items` is noise.
8. **Migrations for everything.** Never `ALTER TABLE` manually. Always `alembic revision`.

---

## Roadmap & Phases

### Phase 1 — Foundation (Week 1–2)
> Goal: Running app in Docker, instructor can log in and add a student.

- [ ] `docker-compose.yml` — frontend, backend, postgres, pgAdmin services
- [ ] FastAPI skeleton — health check route at `/api/health`
- [ ] PostgreSQL schema: `instructors`, `students`, `lessons` tables
- [ ] Alembic initial migration
- [ ] JWT auth: `/auth/register`, `/auth/login`, `/auth/refresh`
- [ ] React app scaffolded with Vite
- [ ] Login page + AuthContext
- [ ] Protected route wrapper
- [ ] Add/edit/delete student (basic CRUD)
- [ ] `.env.example` committed, `.env` gitignored

**Done when:** `docker compose up` runs cleanly and an instructor can log in and see a student list.

---

### Phase 2 — Bookings & Calendar (Week 3–4)
> Goal: Instructor can create and view lessons on a calendar.

- [ ] `lessons` CRUD endpoints — create, list, update, delete
- [ ] Lesson statuses: `upcoming`, `completed`, `cancelled`, `rescheduled`
- [ ] React calendar view using `react-big-calendar`
- [ ] Create booking modal (student, date, time, duration, location, price)
- [ ] Day view — list of lessons for today
- [ ] Dashboard metrics: lessons today, week earnings, total students
- [ ] Student detail page — lesson history

**Done when:** Instructor can book a lesson and see it on the calendar.

---

### Phase 3 — Reminders (Week 5–6)
> Goal: Students receive an SMS 24 hours and 1 hour before their lesson automatically.

- [ ] Twilio integration — `twilio_service.py`
- [ ] APScheduler setup in `scheduler.py` — runs every 15 minutes
- [ ] Scheduler queries lessons due for a reminder and calls Twilio
- [ ] `reminder_log` table — tracks what was sent and when (prevents duplicates)
- [ ] Manual "send reminder now" button per lesson in the UI
- [ ] Web Push setup — `pywebpush` + service worker in React PWA
- [ ] Reminder preferences per student (SMS / push / both / none)
- [ ] Instructor notification on lesson cancellation reply (basic: Twilio webhook)

**Done when:** A test lesson triggers an SMS 24h before automatically.

---

### Phase 4 — Freemium & Payments (Week 7–8)
> Goal: App is usable for free up to a limit. Stripe checkout upgrades to Pro.

See [Freemium & Advertising](#freemium--advertising) section for full details.

- [ ] `plan` column on `instructors` table: `free` | `pro`
- [ ] Feature gate middleware — checks plan before allowing certain endpoints
- [ ] Free tier limits enforced: max 5 students, max 30 SMS/month
- [ ] Stripe integration — `stripe_service.py`
- [ ] `/billing/create-checkout-session` endpoint
- [ ] `/billing/webhook` endpoint — upgrades plan on successful payment
- [ ] Upgrade prompt in UI when free limit is hit
- [ ] Stripe Customer Portal link for managing/cancelling subscription
- [ ] Plan badge in app settings

**Done when:** A test Stripe checkout upgrades the account to Pro.

---

### Phase 5 — Testing & Security Hardening (Week 9)
> Goal: Core flows are tested. No obvious security holes.

See [Testing Strategy](#testing-strategy) and [Security](#security) sections.

- [ ] pytest — unit tests for all service functions
- [ ] pytest — integration tests for all API routes (using `httpx` + test DB)
- [ ] React Testing Library — smoke tests for Login, Dashboard, Calendar
- [ ] Rate limiting on auth endpoints (`slowapi`)
- [ ] Input sanitisation audit
- [ ] HTTPS enforced in production nginx config
- [ ] Dependency vulnerability scan (`pip-audit`, `npm audit`)
- [ ] `.env` audit — no secrets in git history

**Done when:** `pytest` and `npm test` both pass with no failures.

---

### Phase 6 — Polish & Launch (Week 10+)
> Goal: Real instructor can use it on their phone.

- [ ] PWA manifest — app name, icons, splash screen
- [ ] Offline fallback page (service worker)
- [ ] Onboarding flow — first-run wizard for new instructors
- [ ] Export lessons as CSV (for tax / admin)
- [ ] Basic earnings report page
- [ ] Error boundaries in React — friendly error messages
- [ ] Loading skeletons on slow connections
- [ ] Mobile responsiveness audit
- [ ] Privacy policy and terms of service pages (required for Stripe)
- [ ] Deploy to a cheap VPS (Hetzner ~€4/month) or Railway

**Done when:** App is live on a real URL and usable from a mobile browser.

---

## Testing Strategy

> Testing is not optional. It prevents regressions and helps you understand the code better.
> We keep it simple — no 100% coverage obsession, just the flows that matter.

### Backend (pytest)

**Unit tests** — test service logic in isolation, no database:
```
backend/tests/
├── test_auth_service.py       ← password hashing, token generation
├── test_reminder_service.py   ← reminder scheduling logic
└── test_stripe_service.py     ← plan upgrade logic
```

**Integration tests** — test full API routes with a real test database:
```
├── test_api_auth.py           ← register, login, refresh
├── test_api_students.py       ← CRUD + plan limits
├── test_api_bookings.py       ← create, list, update, cancel
└── test_api_billing.py        ← Stripe webhook handling
```

Run with: `docker compose exec backend pytest -v`

Use a separate `TEST_DATABASE_URL` in `.env` pointing to a test schema.
Each test creates its own data and rolls back after — no leftover state.

### Frontend (Vitest + React Testing Library)

Focus on critical user journeys, not implementation details:
```
frontend/src/__tests__/
├── Login.test.tsx             ← can log in, shows error on bad password
├── Dashboard.test.tsx         ← metrics render, today's lessons show
└── BookingModal.test.tsx      ← form validation, submits correctly
```

Run with: `docker compose exec frontend npm test`

---

## Security

> These are non-negotiable. Implement in Phase 1 and 5.

### Authentication
- Passwords hashed with **bcrypt** via `passlib` — never store plaintext
- JWT access tokens expire in **30 minutes**
- Refresh tokens expire in **7 days**, stored in `httpOnly` cookie (not localStorage)
- Rotate refresh tokens on every use

### API
- All routes except `/auth/login` and `/auth/register` require a valid JWT
- Rate limiting on auth endpoints: **5 attempts per minute per IP** using `slowapi`
- Validate all input with Pydantic — reject unexpected fields
- Never return raw database errors to the client (wrap in generic messages)

### Database
- Use parameterised queries only — SQLAlchemy does this by default, never use f-strings in queries
- Each instructor can only access their own students/lessons — enforce with `WHERE instructor_id = current_user.id` on every query
- pgAdmin not exposed outside Docker network

### HTTPS & Headers
- In production: HTTPS only via nginx + Let's Encrypt
- Set security headers in nginx: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`

### Secrets
- All secrets in `.env` — never hardcoded
- `.env` in `.gitignore` from day one
- Use `python-decouple` or `pydantic-settings` to load env vars — fail loudly on missing values

### Stripe Webhooks
- Verify webhook signature using `stripe.Webhook.construct_event()` before trusting any event
- Never trust the client to report a successful payment — only the webhook

### Dependencies
- Run `pip-audit` and `npm audit` before each phase milestone
- Pin major versions in `requirements.txt`

---

## Freemium & Advertising

### Freemium Model (recommended)

The goal is to get instructors using the app for free, then convert to paid when they hit limits.

**Free tier:**
- Up to 5 active students
- Up to 30 SMS reminders per month
- Manual reminders only (no automated scheduling)
- Basic calendar view
- 7-day lesson history

**Pro tier (£9.99/month):**
- Unlimited students
- Unlimited SMS (charged at cost, ~£0.04/SMS via Twilio)
- Automated reminders (24h + 1h)
- Full lesson history + CSV export
- Earnings dashboard
- Priority support

### Stripe Implementation

1. Create two Stripe Products in dashboard: `Free` and `Pro Monthly`
2. Store `stripe_customer_id` and `stripe_subscription_id` on the `instructors` table
3. On checkout success, Stripe fires `customer.subscription.created` webhook → set `plan = 'pro'`
4. On cancellation, Stripe fires `customer.subscription.deleted` webhook → set `plan = 'free'`
5. Show upgrade modal when free limit is hit — don't hard block, show a friendly prompt

### Advertising (optional, future)

> Only add this if the freemium model doesn't convert enough users.

- Use **Google AdMob** (via a web banner) or **Carbon Ads** (developer-focused, non-intrusive)
- Show ads only on the free tier — disappear on Pro upgrade
- One banner maximum, never interstitials (they destroy trust)
- Ad revenue is supplemental — the subscription is the primary model

---

## Docker Setup

All services defined in `docker-compose.yml`. Matches your existing setup.

```yaml
# Services:
# - frontend    React PWA on port 3000
# - backend     FastAPI on port 8000
# - db          PostgreSQL on port 5432
# - pgadmin     pgAdmin on port 5050
```

**Commands:**
```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f backend

# Run migrations
docker compose exec backend alembic upgrade head

# Run backend tests
docker compose exec backend pytest -v

# Run frontend tests
docker compose exec frontend npm test

# Stop everything
docker compose down

# Wipe database (careful!)
docker compose down -v
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. Never commit `.env`.

```bash
# App
APP_ENV=development            # development | production
SECRET_KEY=change-me           # openssl rand -hex 32

# Database
DATABASE_URL=postgresql+asyncpg://drivecoach:password@db:5432/drivecoach
TEST_DATABASE_URL=postgresql+asyncpg://drivecoach:password@db:5432/drivecoach_test

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM_NUMBER=+44xxxxxxxxxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
STRIPE_PRO_PRICE_ID=price_xxxx

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Coding Conventions

### Python (backend)
- Style: **PEP 8** — enforced by `ruff` linter
- All async functions use `async def`
- Services return Pydantic schemas, not ORM models
- Errors raised as `HTTPException` with appropriate status codes
- Type hints on all function signatures

### TypeScript (frontend)
- **Strict mode** enabled in `tsconfig.json`
- Components are functional with hooks — no class components
- API calls live in `src/api/` only — never fetch inside components
- One component per file
- Props interfaces named `ComponentNameProps`

### Git
- Branch per phase: `phase-1-foundation`, `phase-2-calendar`, etc.
- Commit messages: `feat: add booking creation endpoint` / `fix: reminder duplicate send`
- Never commit directly to `main` — merge via PR even if solo
- Update `CHANGELOG.md` with every meaningful change
