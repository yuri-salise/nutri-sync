# Chapter 3 (draft): Requirements traceability and self-assessment

Every technical requirement from the ITSD 85 guidelines (section 3), with its status and where the evidence is. "Met" means a test or a running check shows it. "Partly" and "Not met" are stated plainly.

Status date: 2026-11-18. Live address: the public HTTPS URL in the main README.

## Client application (F)

| ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| F1 | Separate SPA that uses only the REST API | Met | React app in `frontend/`; all calls go through `frontend/src/services/api.ts`; no database access from the browser. |
| F2 | At least 8 screens including login, dashboard, list views with search/filter/pagination, create/edit forms, a detail view | Met | 10 screens: Login, Register, Dashboard, Workout logger, Activity recorder, Activity detail, Meal scanner, Nutrition log, Community feed, Coach dashboard. Filter and infinite paging: community feed. Search: exercise picker, coach knowledge-base explorer. Forms: workout/routine editor, nutrition log, activity save. Detail view: `/record/:id` (test: `ActivityDetail.test.tsx`, e2e `workflow.spec.ts`). |
| F3 | Client-side validation, server errors shown | Partly | Required/typed fields and a confirm-password check on registration; server errors appear in alert regions on login, register, scanner, activities and feed. Not every form has custom validation messages. |
| F4 | Works at 360 px and on desktop | Met | Playwright test `layout.spec.ts` checks login and six signed-in pages at 360 px for sideways scrolling. It found and fixed one overflow on the community page. |
| F5 | Role-based UI | Met | Coach menu hidden for athletes and the coach URL redirects (`auth.spec.ts`); server enforces roles (B4). |
| F6 | Basic accessibility | Partly | Labels are now linked to fields on login, register and the manual meal form; errors use `role="alert"`; test `Login.test.tsx`. **Not audited:** keyboard navigation on every page, colour contrast ratios. |

## Backend REST API (B)

| ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| B1 | RESTful API | Met | 43 operations under `/api/v1`, listed in [generated/endpoints.md](generated/endpoints.md). |
| B2 | Full CRUD on at least 2 resources, 4 related entities | Met | CRUD: workout sessions, workout routines, exercises, activities, nutrition logs, posts. 13 tables. |
| B3 | Hashed passwords and tokens | Met | bcrypt (`app/core/security.py`), JWT HS256, 60-minute access token. |
| B4 | Roles enforced on the server | Met | Roles `athlete` and `admin`, checked in each endpoint; tests `test_exercises.py`, `test_community.py`, `test_workouts.py`, `test_auth.py::test_register_cannot_self_assign_admin`. |
| B5 | Server validation, consistent errors | Met | Pydantic schemas; one JSON error shape `{"error": {"code", "message"}}` from the global handlers in `app/main.py`. |
| B6 | Pagination, filtering, sorting | Partly | `page` and `limit` on all list endpoints; search and sort on exercises (`q`, `sort`); filters on the feed and activities. Not every list supports every option. |
| B7 | OpenAPI at /api/docs | Met | `/api/docs`, `/api/openapi.json`; [openapi.yaml](../03-api/openapi.yaml) regenerated from the app. |
| B8 | GET /api/health | Met | Returns status, version (commit ID in production) and database state; test `test_health.py`; the deploy checks the commit ID. |
| B9 | Request and error logging | Met | Request middleware logs method, path, status, duration, client IP; no bodies, passwords or tokens. |

## Database (D)

| ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| D1 | Relational DB with keys and constraints | Met | PostgreSQL 17; primary and foreign keys, unique and check constraints; [data dictionary](generated/data-dictionary.md). |
| D2 | Migrations and seed script | Met | Alembic `001` to `005`; `seed_nutrition.py` (foods) and `seed_demo_data.py` (demo accounts, sample data). A fresh database was migrated from scratch on 2026-11-18. |
| D3 | Credentials from environment | Met | `compose.yaml` reads `DB_*` from `.env`; the deploy copies a secrets file kept only on the server. |
| D4 | Documented and tested backup and restore | Met | `deploy/backup.sh`, `deploy/restore.sh`; restore test recorded in [chapter 7](07-deployment-and-operations.md#restore-test-record). |

## Quality and security (Q)

| ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| Q1 | API tests for each endpoint (success and a failure), coverage ≥ 60% | Partly | 45 backend tests, **78% line coverage** (CI fails below 60%). Some modules are lightly covered (workout sessions 46%, nutrition logs 46%), so not every endpoint has a failure-case test yet. |
| Q2 | Frontend test for login and one main workflow | Met | Vitest `Login.test.tsx`; Playwright login and scan workflow. |
| Q3 | Linting in CI | Met | `ruff` (backend) and ESLint (frontend) in `.github/workflows/ci-cd.yml`. |
| Q4 | OWASP protections, CORS, login rate limit | Partly | ORM with bound parameters; React escapes output; CORS limited to `FRONTEND_ORIGIN`; per-user filtering in each endpoint; login limit 5/min per email (tested). **Limits:** the rate limit is held in memory, per process, per email; it resets on restart and is not per IP. Row-level security policies exist in migration 002 but are **not effective in production**: the app connects as the database's own superuser, which bypasses them (checked on the live database), and only the community endpoints set the context they need. No formal OWASP review was done. |
| Q5 | No secrets, `.env.example` complete | Met | `.env` is ignored by git; `.env.example` lists every variable with dummy values; GitGuardian check passes. |

## Deployment (DP)

| ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| DP1 | Docker containers, one `docker compose up -d` | Met | `compose.yaml`: db, api, web, proxy. |
| DP2 | Reverse proxy | Met | Caddy (`deploy/Caddyfile`): `/api/*` to the API, everything else to the web container. |
| DP3 | Public HTTPS URL during evaluation | Met, with a condition | Tailscale Funnel gives public HTTPS. **The site is only reachable while the host PC, WSL and Docker are running.** |
| DP4 | CI on every PR, deploy on merge with a health check | Met | Workflow runs lint and tests on pull requests; push to `main` deploys and checks that `/api/health` shows the new commit ID. |
| DP5 | Branch ruleset on main | **Not met** | No ruleset is configured, and recent work was pushed directly to `main`. Must be enabled in GitHub settings before submission. |
| DP6 | Data persists across redeploys | Met | Named volume `db-data`; the demo accounts survived several redeploys. |

## Technology integration (T)

| ID | Requirement | Status | Evidence |
| :--- | :--- | :--- | :--- |
| T1 | Enabling technology essential to the main workflow | Met | Retrieval-augmented meal scanner (retrieval over FNRI and USDA food tables) and GPS tracking. |
| T2 | Accessed only through the REST API | Met | `POST /api/v1/rag-nutrition-scans`; the browser holds no model or keys. |
| T3 | Runs at no cost; clear behaviour when unavailable | Met | Runs on the server CPU with no paid service and no API key. If the neural embedding model is missing, the matcher uses a deterministic hash embedding and sets `used_fallback`. Photo analysis is not part of `main`. |
| T4 | Each use recorded | Met | `rag_scan_logs`: user, input, retrieved IDs, top score, predicted macros, model version, latency, fallback flag, timestamp. Coach audit page and `GET /rag-nutrition-scans`. |
| T5 | Evaluated with a stated metric and test set | Met, with limits | Three sets of 28, 32 and 33 meals; see [chapter 6](06-testing-and-evaluation.md). Reference values come from the same tables, and no meals were weighed. |
| T6 | Responsible use | Met | Results are labelled machine-generated; `requires_human_confirmation`; the user confirms before saving. Data sources and licenses are credited in the README. |

## Requirement to endpoint to screen to test (main functional features)

| Feature | Endpoints | Screen | Tests |
| :--- | :--- | :--- | :--- |
| Sign up and sign in | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me` | Login, Register | `test_auth.py`, `Login.test.tsx`, `auth.spec.ts` |
| Workout logging and PR detection | `/workout-sessions`, `/workout-routines`, `/exercises` | Workout logger | `test_workouts.py`, `test_routines.py`, `test_exercises.py`, `workoutState.test.ts` |
| PR verification by a coach | `PATCH /workout-sets/{id}/verify` | **No screen yet** (API only) | `test_workouts.py` |
| GPS activities | `/run-activities` | Activity recorder, Activity detail | `test_runs.py`, `runTracker.test.tsx`, `gps.test.ts`, `ActivityDetail.test.tsx`, `workflow.spec.ts` |
| Meal scanner | `POST /rag-nutrition-scans`, `/nutrition-knowledge-items` | Meal scanner | `test_rag_nutrition.py`, `test_meal_parser.py`, `workflow.spec.ts` |
| Food log | `/nutrition-logs` | Nutrition log | `test_rag_nutrition.py` |
| Activity-synced targets | `GET /activity-synced-summary` | Dashboard | `test_rag_nutrition.py::test_activity_synced_summary` |
| Community feed | `/community-feed/...` | Community | `test_community.py`, `dialogs.test.tsx` |
| Scan audit | `GET /rag-nutrition-scans` | Coach dashboard | `test_rag_nutrition.py::test_rag_nutrition_scan_and_audit` |
| Data isolation between users | Per-user filters in each endpoint (row-level security policies exist but are bypassed, see Q4) | all | `test_rls_security.py` (tests the application's isolation behaviour) |
