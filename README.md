# Internship Tracker

Polls Greenhouse and Lever job boards for tracked companies, stores postings in
Supabase, and ranks internships against target roles using sentence embeddings.

**Live:** [frontend](https://internship-tracker-bety.vercel.app) ·
[API](https://internship-tracker-nddw.onrender.com/companies)

Currently tracking 63 companies and ~10,200 open postings, of which ~120 are
internships.

## Architecture

Three independently deployed pieces:

```
Vercel          React + TypeScript SPA          frontend/
  │ VITE_API_URL
  ▼
Render          Flask API + MiniLM scoring       backend/api.py, backend/scoring.py
  │
  ▼
Supabase        Postgres                         db/schema.sql
  ▲
  │
GitHub Actions  poller, every 30 min             backend/poller.py
```

The poller and the API are separate entry points against the same database. The
poller deliberately does **not** import `backend.scoring` — see
[Why two requirements files](#why-two-requirements-files).

## Local development

Backend:

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m backend.api    # http://127.0.0.1:5000
```

Frontend:

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

`.env` in the repo root, for the backend:

```
SUPABASE_URL=...
SUPABASE_KEY=...
```

The frontend needs no config locally — it falls back to `http://127.0.0.1:5000`.

Run the poller by hand:

```bash
python -m backend.poller
```

## API

| Method | Route | Returns |
|---|---|---|
| GET | `/companies` | every company with `status='active'` |
| POST | `/companies` | verifies a name against Greenhouse then Lever, inserts on a hit. `{message, source}`, or 404 if on neither |
| GET | `/internships?limit=50` | internship-titled open postings, newest first |
| GET | `/postings` | **all** open postings — ~10k rows, ~5MB. Unused by the frontend |
| POST | `/targets` | `{targets: string[]}` → postings scored by cosine similarity, descending |

## Layout

```
backend/
  api.py                 Flask routes
  poller.py              board polling, upserts, closure detection
  db.py                  every Supabase query
  scoring.py             MiniLM embeddings + cosine similarity
  titles.py              is a title an internship? (no heavy imports)
  boards.py              Greenhouse/Lever API calls
scripts/
  add_companies.py       one-off seeding
  prefetch_model.py      build-time model download
db/
  schema.sql             current schema
  migrations/            ordered migrations

frontend/src/
  App.tsx                tab state, composes features
  features/              FindRoles, AddCompanies
  hooks/                 useInternshipSearch, useCompanies — state lives here
  components/            presentational only
  api/client.ts          transport: base URL, ApiError, request<T>
  api/index.ts           the four endpoint functions
  types.ts               API shapes
```

`npm run typecheck && npm run lint && npm run build` before pushing —
**`vite build` does not typecheck**, so a type error will build and deploy fine.

## Deployment

**Vercel** (frontend). Root Directory must be `frontend`; leave every command
override off. Set `VITE_API_URL` to the Render URL. Vite inlines it at *build*
time, so changing it requires a redeploy, not a restart.

**Render** (API). 512MB free tier is enough — measured ~200MB peak.

- Build: `pip install -r requirements.txt && python -m scripts.prefetch_model`
- Start: `gunicorn backend.api:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120`
- Env: `SUPABASE_URL`, `SUPABASE_KEY`

`--workers 1` matters: each worker loads its own copy of the model.
`--timeout 120` matters: `/targets` can exceed gunicorn's 30s default.

**GitHub Actions** (poller). `.github/workflows/poll.yml`, needs the same two
Supabase secrets. Free on public repos. Note GitHub disables scheduled workflows
after 60 days of repo inactivity.

