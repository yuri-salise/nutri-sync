# Deploy NutriSync to Vercel + Supabase

One Vercel project serves both parts (see `vercel.json` at the repo root):

- `frontend/` — Vite build, static. Every non-API path falls back to `index.html`.
- `backend/` — FastAPI (`app.main:app`) as a Python function. Gets every `/api/*` request.

Supabase provides Postgres with pgvector. The backend connects to it directly; Supabase's
Data API is not used and is locked down by `deploy/supabase/harden.sql`.

## 1. Supabase

1. Create a project. Pick the region closest to your Vercel function region.
2. **Project Settings → Database → Connection string**. You need two:
   - **Session pooler** (port `5432`): for migrations and seeding from your machine.
   - **Transaction pooler** (port `6543`): for Vercel.
3. From your machine, with `backend/.env` pointing at the **session pooler**:

   ```powershell
   # backend/.env
   DATABASE_URL=postgresql+asyncpg://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres
   DATABASE_URL_SYNC=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres
   ```

   ```powershell
   cd backend
   .\.venv\Scripts\python -m alembic upgrade head
   .\.venv\Scripts\python -m app.scripts.seed_nutrition
   .\.venv\Scripts\python -m app.scripts.seed_demo_data   # optional demo accounts
   ```

   Put `backend/.env` back to SQLite afterwards if you develop locally.
4. Open the **SQL editor** and run `deploy/supabase/harden.sql`. Its last query must return no rows.
5. Optional, stronger: **Project Settings → Data API → disable** the Data API entirely.

## 2. Vercel

1. Import the Git repository as one project. Leave the root directory as the repo root;
   `vercel.json` defines the two services.
2. **Settings → Environment Variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | transaction pooler URL, `postgresql+asyncpg://...:6543/postgres` |
   | `DATABASE_URL_SYNC` | same URL with `postgresql://` |
   | `DB_SERVERLESS` | `true` |
   | `SECRET_KEY` | a new random value, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
   | `APP_ENV` | `production` |
   | `APP_DEBUG` | `false` |
   | `FRONTEND_ORIGIN` | your Vercel URL, e.g. `https://nutrisync.vercel.app` |
   | `USE_OLLAMA_FALLBACK` | `false` |
   | `GEMINI_API_KEY` | meal photo analysis (optional) |
   | `GROQ_API_KEY` | photo fallback (optional) |

3. Deploy. Check `https://<your-app>/api/health`, then sign in.

## Notes

- `DB_SERVERLESS=true` turns off the app-side connection pool and asyncpg's prepared
  statement cache. Supabase's transaction pooler does the pooling instead.
- The login rate limit is stored in the `login_attempts` table, so it holds across function
  instances.
- New migrations: run `alembic upgrade head` against the session pooler, then run
  `harden.sql` again.
- Row-level security: the backend connects as `postgres`, which owns the tables, so the RLS
  policies from migration 002 do not filter its queries (same as the Docker setup, where the
  app user also owns the tables). Access control is enforced in the API code.
