# Internship Tracker

Polls Greenhouse and Lever job boards for tracked companies, stores postings and
their descriptions in Supabase, and ranks internships two ways using sentence
embeddings: titles against target roles (in the app), and full job descriptions
against a resume (from the command line).

**Live:** [frontend](https://internship-tracker-bety.vercel.app) ·
[API](https://internship-tracker-nddw.onrender.com/companies)

Currently tracking 63 companies and ~11,800 open postings, of which ~250 are
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

Tests (no network or database access, and the model isn't loaded):

```bash
pip install -r requirements-dev.txt
python -m pytest
```

## Resume matching

Ranks open internships by how well their **descriptions** match a resume:

```bash
python -m backend.match_resume path/to/resume.pdf --top 20   # .pdf or .txt
```

```
0.669  Data Engineer Intern @ Coinbase
       https://www.coinbase.com/careers/positions/...
0.653  Quantitative Developer Intern @ Point72
       https://boards.greenhouse.io/point72/jobs/...
```

How it works:

1. **Descriptions are collected by the poller.** Greenhouse's `?content=true`
   and Lever's `descriptionPlain` + `lists` are cleaned to plain text by
   `backend/text.py`, which also drops company boilerplate (Greenhouse's
   `content-intro`, `content-conclusion` and pay-transparency sections). Each
   description is stored with a sha256 `description_hash`, and the poller only
   rewrites descriptions whose hash changed.
2. **Chunk.** The resume and each description are split into ~150-word chunks.
   MiniLM reads only 256 tokens and silently ignores the rest, and the median
   description is ~550 words.
3. **Embed and pool.** All chunks are encoded in one batch. A document's vector
   is the mean of its chunk vectors, renormalized to unit length.
4. **Score.** Cosine similarity between the resume vector and each posting's
   vector, highest first.

Everything is computed live, which takes ~13s for ~250 internships. Nothing about the resume
is stored.

Limitations:

- **Live embedding doesn't scale to all postings.** Covering ~11.8k full-time
  roles would mean precomputing description embeddings offline and ranking in
  Postgres with pgvector.
- **Whole-document similarity picks up a company's theme, not just the role.** A
  data/ML resume ranks a Databricks *Product Management* internship near the
  top. Blending in the title score, or comparing best-matching chunks instead
  of means, would sharpen it.
- **Scores fall in a narrow band** (~0.55–0.67 at the top), so they're only
  meaningful as a ranking.
- **Scanned PDFs have no extractable text.** Use a `.txt` copy.

## API

| Method | Route | Returns |
|---|---|---|
| GET | `/companies` | every company with `status='active'` |
| POST | `/companies` | verifies a name against Greenhouse then Lever, inserts on a hit. `{message, source}`, or 404 if on neither |
| GET | `/internships?kind=internship&limit=50` | open postings of one kind (`internship` or `fulltime`), newest first |
| GET | `/postings` | **all** open postings — ~11.8k rows, ~5MB. Unused by the frontend |
| POST | `/targets?kind=internship&limit=200` | `{targets: string[]}` → postings scored by title similarity, descending |
| GET | `/applications` | tracked postings with status, notes, `applied_at`, and the posting embedded, most recently updated first |
| PUT | `/applications/<posting_id>` | `{status, notes?, applied_at?}` → tracks or updates. Status is `saved`, `applied`, `interviewing`, `offer` or `rejected`. `applied_at` is set to today the first time status leaves `saved`. Omitted fields are kept, `null` clears. 201 on create, 404 for an unknown posting |
| DELETE | `/applications/<posting_id>` | stops tracking. 204, or 404 if not tracked |

There's no auth: the application routes act as the single row in `users`
(see `_current_user_id` in `api.py`), so anyone with the API URL can read and
change them.

## Layout

```
backend/
  api.py                 Flask routes
  poller.py              board polling, upserts, closure detection
  db.py                  every Supabase query
  models.py              pydantic request bodies
  scoring.py             MiniLM embeddings + cosine similarity (titles)
  match_resume.py        CLI: resume vs. job descriptions
  text.py                description HTML -> plain text, hashing (no heavy imports)
  titles.py              is a title an internship? (no heavy imports)
  boards.py              Greenhouse/Lever API calls
tests/                   pytest suite; conftest.py fakes Supabase and the model
scripts/
  add_companies.py       one-off seeding
  prefetch_model.py      build-time model download
db/
  schema.sql             current schema
  migrations/            ordered migrations

frontend/src/
  App.tsx                tab state, composes features
  features/              FindRoles, Applications, AddCompanies
  hooks/                 useInternshipSearch, useApplications, useCompanies — state lives here
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

