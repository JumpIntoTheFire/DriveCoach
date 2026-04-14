# Changelog — DriveCoach

All changes to this project are recorded here.
Format: `HH:MM DD/MM/YYYY — [type] description`

Types: `init` · `feat` · `fix` · `refactor` · `test` · `security` · `docs` · `chore`

---

## Unreleased

_Changes staged but not yet in a named release._

---

## Phase 1 — Foundation

### 12:00 11/04/2026 — init: project created
- Initialised DriveCoach project
- Created `CLAUDE.md` with full roadmap, tech stack rationale, security rules, and coding conventions
- Created `CHANGELOG.md`
- Tech stack decided: React PWA + FastAPI + PostgreSQL + Twilio + Stripe

### 11:00 12/04/2026 — feat: Phase 4 Freemium & Payments complete
- **Backend — Stripe service** (`app/services/stripe_service.py`)
  - `create_checkout_session()` — creates a Stripe Checkout Session for the Pro plan; reuses existing Stripe Customer if present
  - `create_portal_session()` — opens Stripe Customer Portal for subscription management/cancellation
  - `parse_webhook_event()` — verifies webhook signature via `stripe.Webhook.construct_event()` before trusting any event
  - Constants: `FREE_STUDENT_LIMIT = 5`, `FREE_SMS_MONTHLY_LIMIT = 30`
- **Backend — Billing router** (`app/routers/billing.py`)
  - `POST /billing/create-checkout-session` — redirects to Stripe Checkout; returns session URL
  - `GET /billing/portal` — returns Stripe Customer Portal URL for existing subscribers
  - `POST /billing/webhook` — handles `checkout.session.completed` (upgrade → pro) and `customer.subscription.deleted` (downgrade → free); updates `plan`, `stripe_customer_id`, `stripe_subscription_id` on the instructor record
- **Backend — Free tier limits enforced**
  - `POST /students`: returns `403 free_limit_students` when free-plan instructor has ≥5 active students
  - `POST /reminders/lessons/{id}/remind`: returns `403 free_limit_sms` when free-plan instructor has ≥30 sent SMS in the current calendar month
  - Scheduler (`check_reminders`): only sends automated reminders for `plan = 'pro'` instructors
- **Frontend — Billing page** (`/billing`)
  - Free vs Pro plan comparison table with feature list
  - "Upgrade to Pro" button → Stripe Checkout redirect
  - "Manage subscription" link → Stripe Customer Portal
  - Success/cancelled flash banners on return from Stripe
- **Frontend — Dashboard**: plan badge (amber for free, blue for pro) with inline "Upgrade" button
- **Frontend — Students page**: "Add student" button disabled at 5-student limit; upgrade banner shown when limit is hit or when 403 is returned from the API
- **Frontend — App.tsx**: added `/billing` route

### 12:00 12/04/2026 — feat: Phase 3 Reminders complete
- **Backend — Scheduler** (`app/scheduler.py`)
  - `APScheduler AsyncIOScheduler` runs every 15 minutes inside FastAPI lifespan
  - Sends 24h and 1h automated reminders with ±15-minute windows around target times
  - Duplicate prevention via `reminder_log` table — skips if already sent for that lesson/type/channel
  - Supports SMS (Twilio) and push (Web Push API / pywebpush) channels per student preference
- **Backend — Reminder router** (`POST /reminders/lessons/{id}/remind`)
  - Manual one-off reminder endpoint; respects `reminder_preference` on the student
  - Logs all attempts (sent/failed + error message) to `reminder_log`
  - Returns `{ sms: {...}, push: {...} }` result per channel
- **Backend — Push router** (`GET /push/vapid-public-key`, `POST /push/subscribe`, `DELETE /push/unsubscribe`)
  - VAPID public key endpoint for frontend subscription setup
  - Subscribe/unsubscribe endpoints storing endpoint + p256dh + auth per instructor
- **Backend — Alembic migration** (`002a0000`)
  - Adds `reminder_preference` column (sms/push/both/none) to `students` table
  - Creates `push_subscriptions` table (instructor_id, endpoint, p256dh, auth)
  - Creates `reminder_log` table (lesson_id, student_id, instructor_id, type, channel, status, error)
- **Frontend — Service worker** (`public/sw.js`)
  - Handles `push` events: `showNotification` with title/body from server
  - Handles `notificationclick`: focuses existing tab or opens new window at `/`
- **Frontend — Reminders API** (`src/api/reminders.ts`)
  - `sendManualReminder(lessonId)` — POST to `/reminders/lessons/{id}/remind`
  - `getVapidPublicKey()`, `subscribeToPush()`, `unsubscribeFromPush()` for push setup
- **Frontend — usePush hook** (`src/hooks/usePush.ts`)
  - `supported`, `subscribed`, `loading` state; `enable()` / `disable()` actions
  - Registers service worker, fetches VAPID key, calls browser push API, POSTs to backend
- **Frontend — Students page**: `reminder_preference` select field in add/edit modal
- **Frontend — Student detail page**: "Remind" button on each upcoming lesson row
- **Frontend — Calendar page**: "Remind" button on edit booking modal for upcoming lessons

### 22:20 11/04/2026 — feat: Phase 2 Bookings & Calendar complete
- **Backend — Lessons CRUD** (`GET/POST /lessons`, `GET/PUT/DELETE /lessons/{id}`)
  - Statuses: `upcoming`, `completed`, `cancelled`, `rescheduled`
  - `GET /lessons?student_id=` filter for student detail view
  - Joins `students` table to include `student_name` in every response
  - Student ownership enforced on create/update (student must belong to current instructor)
  - Hard delete (driving lesson records are immutable once removed)
- **Backend — Dashboard metrics** (`GET /dashboard/metrics`)
  - `total_students`: count of active students
  - `lessons_today`: non-cancelled lessons with start_time within today (UTC)
  - `week_earnings`: sum of completed lesson prices for Mon–Sun of the current week
- **Frontend — Calendar page** (`/calendar`)
  - `react-big-calendar` with date-fns localizer, Monday week start (en-GB locale)
  - Click empty slot → new booking modal with date/time pre-filled
  - Click event → edit modal with all fields + status selector + delete button
  - Events colour-coded by status (blue/green/grey/amber)
- **Frontend — Student detail page** (`/students/:id`)
  - Shows student info + summary stats (total lessons, completed, £ earned)
  - Full lesson history sorted newest first with status badges
- **Frontend — Dashboard metrics row**: students count, today's lessons, week earnings
- **Frontend — Calendar now active** on Dashboard nav grid (previously greyed out)
- **Frontend — Students list** now has a "View" link per student

### 14:00 11/04/2026 — feat: Phase 1 Foundation complete
- `docker-compose.yml` — frontend (React, port 3000), backend (FastAPI, port 8000), postgres:16, pgAdmin:8
- `.env.example` — all required env vars documented; `.gitignore` — secrets and build artefacts excluded
- **Backend — FastAPI skeleton**
  - `GET /api/health` health check
  - `app/config.py` — pydantic-settings loads all env vars; fails loudly on missing values
  - `app/database.py` — async SQLAlchemy engine + `get_db` dependency with auto commit/rollback
- **Backend — Database schema (4 tables)**
  - `instructors` — email, bcrypt password_hash, name, phone, plan (free/pro), Stripe columns
  - `students` — instructor_id FK, name, phone, email, notes, is_active (soft delete)
  - `lessons` — instructor_id + student_id FK, start_time, duration_minutes, location, price, status
  - `refresh_tokens` — instructor_id FK, token_hash (SHA-256), expires_at, used_at (rotation tracking)
- **Backend — Alembic initial migration** (`001a0000`) creates all 4 tables with correct indexes
- **Backend — JWT auth** (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`)
  - Access tokens: HS256 JWT, 30-minute expiry, in JSON response body
  - Refresh tokens: opaque random token, SHA-256 hashed in DB, 7-day expiry, httpOnly cookie at `/auth`
  - Token rotation on every refresh — old token marked `used_at`, new one issued
- **Backend — Students CRUD** (`GET/POST /students`, `GET/PUT/DELETE /students/{id}`)
  - All routes require valid JWT; queries always filter by `instructor_id = current_user.id`
  - Delete is a soft delete (sets `is_active = False`) to preserve lesson history
- **Frontend — React PWA scaffolded with Vite + TypeScript (strict mode)**
  - Tailwind CSS for styling; `postcss.config.js` and `tailwind.config.js` configured
  - PWA `manifest.json` — standalone display, blue theme colour
- **Frontend — Auth layer**
  - `AuthContext` — login/register/logout, session rehydration from localStorage on mount
  - `ProtectedRoute` — wraps all authenticated routes; redirects to `/login` if unauthenticated
  - axios client with request interceptor (attaches Bearer token) and response interceptor (silent refresh on 401 with request queuing)
- **Frontend — Pages**
  - `Login.tsx` — tabbed sign-in / create-account form with inline validation and error display
  - `Dashboard.tsx` — welcome screen with nav cards (Students active, Calendar/Reminders/Earnings greyed out for Phase 2+)
  - `Students.tsx` — full CRUD: list, add modal, edit modal, delete confirmation dialog; react-query for data, react-hook-form for forms

---

_Future entries will be added here as development progresses. Copy the format below:_

```
### HH:MM DD/MM/YYYY — [type]: short description
- Bullet describing what changed
- Why it changed if non-obvious
- Any follow-up tasks created
```
