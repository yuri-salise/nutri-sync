# NutriSync-RAG

An activity-synchronized nutritional retrieval-augmented generation and geolocation workout tracking platform.  
**Live URL:** https://nutrisync.trycloudflare.com *(or local: http://localhost:8080)*  
**API docs:** https://nutrisync.trycloudflare.com/api/docs *(or local: http://localhost:8080/api/docs)*  
**Team:** Salise, Yuri D. (Solo Developer - Full-Stack Architecture, RAG & Geolocation Integration, DevOps, QA Testing, and Documentation)  
**Section:** BSIT 4A  
**Adviser/Instructor:** Rinante M. Buntod  

---

## Features (by role)

### Athlete / Member (`athlete`)
- **Interactive Dashboard:** Live activity-synced calorie & macronutrient rings, progressive overload trends, and quick workout logging.
- **Strength & PR Logger:** Record workout splits, exercises, sets, reps, and weights with automated Personal Record (PR) detection.
- **Custom Exercise Catalog:** Search global exercises and submit custom movements with targeted muscle groups and MET values.
- **GPS Road & Trail Run Tracker:** Record runs via Browser Geolocation, render live interactive route polylines on Leaflet OpenStreetMap, and compute distance, pace, elevation gain, and burned calories.
- **RAG Food Macro Scanner:** Estimate calories, protein, carbs, and fats from natural language meal descriptions or food pictures grounded in DOST-FNRI and USDA nutritional tables via `pgvector` semantic retrieval.
- **Activity-Synced Dynamic Macro Targets:** Automatically scale daily caloric, carbohydrate, and protein allowances based on actual energy expenditure from logged gym sets and GPS runs.
- **Community Feed:** Share workout splits, verified PRs, and run routes with fellow athletes.

### Coach / Administrator (`admin`)
- **Exercise Moderation:** Review and approve or reject athlete-submitted custom exercises.
- **PR Verification:** Audit and certify athlete Personal Record claims for official club leaderboards.
- **Nutrition Knowledge Base Management:** Explore indexed DOST-FNRI and USDA food items, view 384-dimensional vector embeddings, and re-index datasets.
- **RAG Traceability & Auditing:** Inspect full RAG inference logs, cosine similarity scores, prompt payloads, latency metrics, and fallback occurrences (Requirement T4).

---

## Architecture

NutriSync-RAG implements a decoupled, containerized multi-tier architecture fronted by a Caddy reverse proxy:

```
[ Browser (Mobile / Desktop) ]
             |
             v  (HTTPS / Port 8080)
   [ Caddy Reverse Proxy ]
      |                 \
      | /                \ /api/*
      v                   v
[ React 18 + Vite ]     [ Python FastAPI REST API ]
  (Static Nginx)          |              \
                          |               \ (Embeddings / Fallback)
                          v                v
                 [ PostgreSQL 17 + pgvector ]
                     (Persistent Volume)
```

---

## Tech Stack

- **Client Application:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Leaflet.js, Lucide Icons, Chart.js.
- **Backend REST API:** Python 3.10+, FastAPI, SQLAlchemy 2.0 (Async), Alembic, Pydantic v2.
- **Database & Vector Store:** PostgreSQL 17 with `pgvector` extension (384-dim embeddings via `all-MiniLM-L6-v2`).
- **Reverse Proxy & Routing:** Caddy 2.
- **Testing & Quality:** Pytest, HTTPX, Coverage.py, Ruff, ESLint, Playwright.
- **Containerization & CI/CD:** Docker Engine, Docker Compose, GitHub Actions, Cloudflare Tunnel.

---

## Run Locally

### Prerequisites
- Docker Engine & Docker Compose (or Python 3.10+ and Node.js 20+)

### 1-Command Startup (Recommended)
```bash
# 1. Clone repository
git clone https://github.com/<owner>/itsd85-final-bsit4a-salise.git
cd nutri-sync

# 2. Copy environment template
cp .env.example .env

# 3. Start full multi-container stack
docker compose up -d --build

# 4. Ingest and seed USDA/FNRI nutrition knowledge base
docker compose exec api python -m app.scripts.seed_nutrition
docker compose exec api python -m app.scripts.seed_demo_data
```

Access the application:
- **Web Client:** http://localhost:8080
- **REST API Docs (Swagger UI):** http://localhost:8080/api/docs
- **Health Check:** http://localhost:8080/api/health

---

## Test

```bash
# Run backend API tests with coverage report (target >= 60%)
docker compose exec api pytest --cov=app --cov-report=term-missing

# Run backend linter
docker compose exec api ruff check .

# Run frontend tests
cd frontend && npm test:run
```

---

## Deployment

- **CI/CD Pipeline:** Fully automated GitHub Actions workflow (`.github/workflows/ci-cd.yml`) executing backend linting, pytest suite with pgvector service container, frontend linting, and production builds on pull requests.
- **Production Trigger:** Automatic zero-downtime deployment on push to `main` via self-hosted runner.
- **Public Domain & HTTPS:** Cloudflare Tunnel securely bridges local/server port 8080 to an external HTTPS endpoint without exposing firewall ports.

---

## Demo Accounts

All sample passwords follow the standard evaluation pattern: `Password123!`

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Athlete** | `athlete@nutrisync.com` | `Password123!` | Dashboard, workout logging, GPS runs, RAG nutrition scanner, community feed. |
| **Coach / Admin** | `admin@nutrisync.com` | `Password123!` | Exercise moderation, PR verification, RAG inference logs, knowledge base audit. |

---

## Documentation

- [D1: System Documentation (Technical Manual)](docs/01-system-documentation/README.md)
- [D2: User Manual](docs/02-user-manual/README.md)
- [D3: OpenAPI 3 Specification](docs/03-api/openapi.yaml)
- [D4: IEEE Research Paper](docs/04-paper/README.md)

---

## License and Credits

- **License:** Released under the MIT License.
- **Credits & Datasets:**
  - DOST-FNRI (Department of Science and Technology – Food and Nutrition Research Institute) Philippine Food Composition Tables.
  - USDA FoodData Central (Public Domain / CC0).
  - Model weights: `sentence-transformers/all-MiniLM-L6-v2` (Apache-2.0).
  - OpenStreetMap & Leaflet.js contributors (ODbL / BSD-2-Clause).
