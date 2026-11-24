# Chapter 5 (draft): Implementation

## 5.1 Technology stack

| Layer | Choice | Why |
| :--- | :--- | :--- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 3, React Router 6, Leaflet (maps), lucide-react, Plus Jakarta Sans (self-hosted) | Single-page app with fast builds; Leaflet and OpenStreetMap give free maps for GPS tracking. |
| Backend | Python 3.10, FastAPI, Pydantic v2, Uvicorn | Typed request and response models, automatic OpenAPI at `/api/docs`, async I/O. |
| Data access | SQLAlchemy 2 (async) with asyncpg; Alembic migrations | Parameterized queries by default; schema is versioned in the repository. |
| Database | PostgreSQL 17 with the pgvector image | Relational integrity; the vector column stores one embedding per food. SQLite is used only for tests and quick local runs. |
| Security | bcrypt, python-jose (JWT HS256) | Standard password hashing and signed tokens. |
| Proxy | Caddy 2 | One small config file for `/api/*` routing and security headers. |
| Hosting | Docker Compose, GitHub Actions self-hosted runner, Tailscale Funnel | Free public HTTPS on a machine the team owns; no paid cloud. |
| Tests | pytest, pytest-asyncio, pytest-cov; Vitest and Testing Library; Playwright | One tool per level (API, component, browser). |
| Lint | ruff (backend), ESLint (frontend) | Run in CI on every pull request. |

## 5.2 Project structure

```text
backend/app/api/        routers (auth, workouts, exercises, routines, runs, nutrition, community, health)
backend/app/core/       settings, security (bcrypt, JWT), logging
backend/app/db/         models, session, SQLite dev sync
backend/app/schemas/    Pydantic request and response models
backend/app/services/   meal_parser (matcher), rag_service, embedding_service, activity calories, social, routes
backend/app/scripts/    seed_nutrition, seed_demo_data, convert_usda_sr_legacy, evaluate_scanner, export_docs, data/
backend/alembic/        migrations 001 to 005
backend/tests/          API and unit tests
frontend/src/           pages, components, services/api.ts, utils, tests
e2e/                    Playwright browser tests
deploy/                 Caddyfile, backup.sh, restore.sh
docs/                   D1 to D4, diagrams, evaluation
```

## 5.3 Key algorithm: the meal matcher (`backend/app/services/meal_parser.py`)

1. **Split** the text on connectors (`with`, `and`, `on`, `at`, commas, `+`, `&`, Filipino `saka`).
2. **Read the amount and unit** of each item: numbers, number words (`a`, `half`, `dalawang`), and units (`cup`, `g`, `oz`, `slice`, `scoop`, `bowl` and others). Number words must be whole words, so "asparagus" is not read as "a" plus "sparagus".
3. **Find candidate foods** that share at least one word with the item (stemmed, with Filipino synonyms such as `itlog` = egg, `kanin` = rice).
4. **Score** each candidate: 0.8 × word-match score + 0.2 × embedding cosine similarity.
   - Word-match score = 0.75 × recall of query words + 0.25 × precision over the food's core words; preparation words count half.
   - Plus 0.10 when the first part of a USDA name is fully covered by the query ("Apples, raw" over "Strudel, apple").
   - Times 0.85 when the name is an off-form the user did not ask for (powder, peel, juice, oil, liquid and similar), and times 0.85 for a dry or raw staple (pasta, beans, lentils, rice) when the query does not say dry or raw.
5. **Choose the portion** that fits the unit: "1 cup" uses the cup portion; "a banana" uses the medium piece; no amount uses the default serving (a medium piece up to 300 g when one exists; tiny count servings such as "1 grape" are skipped).
6. **Scale** the per-100 g macros by the grams and sum the items.

All numbers come from the food tables. The embedding is a fallback-friendly helper, not the source of any value.

Speed: instead of scoring all 7,894 foods, the matcher builds a word index once and scores only foods that share a word with the item; embedding similarities are computed in one batch. A food with no shared word can score at most 0.2, below every confidence cut-off, so results are identical (checked on 60 meals). Matching takes about 20 ms per scan on the live site once warm.

## 5.4 Data sources and licenses

- **USDA FoodData Central, SR Legacy (April 2018):** public domain. Converted by `convert_usda_sr_legacy.py` (7,793 foods, per-100 g values for energy, protein, carbohydrate, fat, and up to 8 household portions per food).
- **DOST-FNRI Philippine food composition values:** 101 entries in `fnri_food_composition.csv`. **[PEOPLE]** The repository does not record which published table and page each value came from. The team must document the source and check the values against it before submission; until then they should be described as "values entered by the team", not as an official FNRI export.
- **OpenStreetMap and Leaflet:** ODbL and BSD-2-Clause.
- Project code: MIT, see [LICENSE](../../LICENSE).

## 5.5 Coding standards

- Python: `ruff` with rules E, F, W and I (pyflakes, pycodestyle, import order), line length 100, Python 3.10. Code is typed with Pydantic models at the API boundary.
- TypeScript: ESLint 9 with the project configuration; `tsc` strict build in `npm run build`.
- Commit messages use a conventional style (`feat(scope): ...`, `fix(scope): ...`, `docs: ...`).
- No secrets in the repository; every variable is listed in `.env.example`.

## 5.6 Git workflow (what was actually done)

- Feature, fix and docs work was done on branches (`feature/...`, `fix/...`, `docs/...`) and merged by pull request (#6, #7, #8). CI ran on those pull requests.
- Later scanner work was pushed **directly to `main`** by the author. The guidelines require a branch ruleset (pull request and passing checks); **it is not configured yet** (see requirement DP5).
- The author is the only developer; the guidelines ask for review by another member.
