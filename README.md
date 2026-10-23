<p align="center"><img src="frontend/public/brand/caselink-mark.png" width="120" alt="CaseLink logo" /></p>

# CaseLink

**One institution • Connected grievances • Every bureau**
Cross-bureau monitoring of institution-related complaint cases for AICTE — SIH26264 prototype.

CaseLink links every complaint to the institution it is about. The platform anchors every complaint to the institution's **AICTE Permanent ID**, so officials see every case across PGRC, RB and other bureaus in one place, get alerts when bureaus may be handling the same issue, and keep a tamper-evident record of every decision.

> All data in this prototype is synthetic. Bureau list, categories and deadlines are sample configuration (`backend/src/config/domain.js`).

## What's built

| Feature | Status |
|---|---|
| JWT authentication (httpOnly cookie), roles, bureau scoping, account lockout | ✅ |
| **Institution 360** — all cases for a Permanent ID, bureau lanes, unified timeline, category breakdown | ✅ |
| **Cross-Bureau Overlap Engine** — exact (case ref / hashed complainant), rule (same category in window), multilingual semantic layer | ✅ |
| Evidence cards with link / request coordination / dismiss (reason required, never auto-merge) | ✅ |
| Case registration, status workflow, notes, deadlines (per-category SLA), overdue flags | ✅ |
| Hash-chained, append-only **audit trail** with verification | ✅ |
| Complainant masking outside the owning bureau | ✅ |
| **ClosureGuard** — record institution response + evidence, concern-by-concern checklist with highlighted spans, missing-evidence and amount-mismatch flags, officer override and accept / request-more decision; cases can only be resolved through it | ✅ |
| **Promise Ledger** — every promise in an institution's reply ("refund within 30 days") becomes a tracked entry (action · amount · deadline · condition). Officers can *resolve on promise*; on the deadline the complainant gets a one-tap check-in (Yes / Partly / No) and a "No" reopens the case, raises priority and escalates. Each institution gets a **Promise Kept Rate** across bureaus (shown to the Approval Bureau). Copy-paste replies sent to several complainants are flagged | ✅ |
| **Escalation chain** — reminder at 80% of the deadline, then bureau head when overdue, senior reviewer after 7 more days; runs every 5 minutes, configurable in `domain.js` | ✅ |
| **Notifications** — in-app bell for overlaps, coordination requests, reminders, escalations and institution replies; email too when `SMTP_URL` is set | ✅ |
| **Institution Watchlist** — flags unusual complaint volume per institution and category against its own history (a trend, never a finding of wrongdoing) | ✅ |
| **Institution portal** — institution accounts see only their own cases (complainant hidden, no ClosureGuard checklist) and submit responses; AICTE officers still decide | ✅ |
| **Import adapter** — CSV/JSON upload with row-by-row validation, duplicate-reference skipping and overlap detection on every imported case | ✅ |
| **Page tours** — every page has its own short spotlight tour, opened the first time you visit that page after signing in; *Tour this page* replays it; one switch turns automatic tours off; separate tours for the institution portal | ✅ |
| **Evaluation harness** — 501 labelled synthetic cases; precision/recall per overlap layer and ClosureGuard accuracy (`ai-service/eval`) | ✅ |
| Live CPGRAMS / AICTE system integration | ⛔ needs authorised API access — the import adapter is the integration point until then |
| SMS notifications | ⛔ needs an SMS gateway account; the notification service has one place to add it |

## Architecture

```
frontend/   React 18 + Vite + Tailwind + Framer Motion      :5173  (proxies /api)
backend/    Node 20 + Express + Mongoose (MongoDB) + JWT     :4000
ai-service/ Python + FastAPI — multilingual similarity       :8001
```

```
Browser ──cookie──▶ Express API ──▶ MongoDB
                        │
                        └──(complaint text only)──▶ FastAPI AI service
```

- The **exact** and **rule** layers run inside the API, so overlap detection keeps working if the AI service is down; the UI says when the semantic layer did not run, and a case can be re-scanned later.
- The AI service is **stateless** and never receives complainant identity. It has two engines:
  - `hybrid` — `paraphrase-multilingual-MiniLM-L12-v2` sentence embeddings combined with the bilingual lexicon (install `requirements-ml.txt`). The lexicon covers romanized Hindi ("fees wapas nahi"), which the embedding model handles poorly — see the evaluation.
  - `lexicon` — dependency-free fallback: bilingual (English / Hindi / Hinglish) concept TF-IDF. Used automatically when sentence-transformers is not installed.
  Both return the shared concepts shown on evidence cards.

## Setup

**Prerequisites:** Node.js 20+, Python 3.10+. MongoDB is optional for development.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

With `MONGO_URI` empty, the API runs a **local MongoDB automatically** and stores its data in `backend/.data/` (kept across restarts; seeded with synthetic data the first time). The first run downloads a MongoDB binary (~600 MB on Windows, cached afterwards). Development secrets are generated once into `backend/.data/dev-secrets.json`.

- Start over with fresh demo data: stop the API, delete `backend/.data/`, start again.
- Throwaway database re-seeded on every start: `DEV_DB_PATH=memory`.
- Real MongoDB: set `MONGO_URI=mongodb://127.0.0.1:27017/caselink` and run `npm run seed` once.

### 2. AI service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt          # lexicon engine only, light
pip install -r requirements-ml.txt       # optional: multilingual transformer (~700 MB incl. model)
uvicorn app.main:app --port 8001
```

Run tests with `pytest`.

Start the AI service **before or together with** the backend so seeded overlaps include the semantic layer (the seeder waits up to 25 s for it).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Demo accounts

All seeded accounts use the password in `SEED_PASSWORD` (`backend/.env.example`). The login page lists them in development.

| Email | Role |
|---|---|
| `pgrc.officer@caselink.local` | PGRC officer |
| `rb.officer@caselink.local` | RB officer |
| `ab.officer@caselink.local` | AB officer |
| `pgrc.head@caselink.local` | PGRC bureau head |
| `reviewer@caselink.local` | Senior reviewer (all bureaus, audit verify) |
| `admin@caselink.local` | Administrator (import, manual escalation run) |
| `sunrise.portal@caselink.local` | Institution portal — Sunrise Institute of Technology |

## 3-minute demo script

1. Sign in as **PGRC officer** → *Institution 360* → **Sunrise Institute of Technology** (`1-2468013579`). Show PGRC, RB and AB cases on one screen and the cross-bureau alert banner.
2. *Cases → Register case* → **Fill demo complaint (Hindi)** → submit. The overlap check links the Hindi complaint to the English PGRC refund case and the RB proceeding (semantic + rule layers), with shared concepts like *fee, refund, admission*.
3. On the RB evidence card choose **Request coordination**, give a reason. The RB case moves to *In coordination* and both histories record it.
4. Open the PGRC case *Fee refund not processed…* → **ClosureGuard → Record institution response → Demo: partial reply**. The checklist shows the refund as *partially addressed* (part only promised, no payment proof), the accounts-office concern as *not addressed*, and an amount mismatch (Rs 85,000 vs Rs 40,000). Choose **Request more from institution**.
5. Record **Demo: complete reply** (with UTR evidence) → all concerns addressed → **Accept & resolve**.
6. Sign in as **Senior reviewer** → *Watchlist* shows Sunrise's fee-refund trend (4 in 60 days vs < 1 usual) → *Audit trail* → chain verified; every step above is listed.
7. **Promise Ledger** (the 30-second moment): on *Fee refund not processed…* record **Demo: promise reply** ("refund of Rs 85,000 … within 30 days after approval of the management"). ClosureGuard lists the promise and flags it as a **template reply** (same text sent to 2 other complainants in PGRC and RB). Choose **Resolve on promise** → in the case's Promise ledger click **Fast-forward to deadline** → **Open complainant check-in** → tap **No**. The case reopens as urgent and escalates, and Sunrise's Promise Kept Rate drops from 80% to 67% (Institution 360 → Promises, and the Promise Ledger page).
8. Optional: sign in as **Institution portal** → reply to a case marked *Your reply needed* → sign in as **PGRC bureau head** → the bell shows "Institution responded" with the ClosureGuard summary. *Import cases* → **CSV template** shows the import format.

## How ClosureGuard works

1. The complaint is split into **concerns** — sentences or clauses with a grievance cue (*not, pending, refusing, नहीं…*) and a known topic (fee, refund, documents, ragging…). Background sentences are skipped.
2. Each concern is matched to the response sentence that best answers it (semantic engine + shared bilingual concepts). "No response" concerns only match sentences about replying or communicating.
3. Status: **addressed** (completed action, evidence present where expected) · **partial** (only promised, disputed, vague, or action claimed without the expected evidence) · **not addressed**.
4. **Inconsistencies**: amount mismatch between complaint and response; no evidence attached.
5. The officer can override any item, then **accepts** (case → resolved; accepting with open items needs a ≥30-character justification) or **requests more** (case → awaiting institution). `PATCH /status` cannot set *resolved* directly.

It is rule- and embedding-based, so it is explainable and runs offline, but it will miss concerns phrased in unusual ways. An LLM extraction step is a natural next upgrade; the officer decision step stays either way.

## Evaluation

```bash
cd ai-service
python -m eval.run_eval --engine lexicon
python -m eval.run_eval --engine transformer     # hybrid engine; needs requirements-ml.txt
```

Reports are written to `ai-service/eval/reports/`. Latest results on **501 synthetic cases** (48 institutions, English / Hindi / Hinglish, 2,543 same-institution pairs, 573 truly related) and 160 ClosureGuard pairs:

| | Lexicon engine | Hybrid engine |
|---|---|---|
| Semantic layer precision / recall | 0.87 / 0.91 | 0.83 / 0.91 |
| Combined overlap detection precision / recall | 0.79 / 1.00 | 0.77 / 1.00 |
| Semantic Recall@5 | 0.99 | 0.99 |
| ClosureGuard main-concern accuracy | 0.97 | 0.99 |
| ClosureGuard gap detection F1 | 1.00 | 1.00 |

**These are optimistic upper bounds, not field results.** The complaints are generated from templates written by the same team that built the matcher. The evaluation was still useful: its first runs exposed real bugs that are now fixed (missing evidence never flagged; caution-deposit concerns mislabelled; the embedding model alone found only 12–15% of Hinglish matches, which led to the hybrid engine). On this template data the hybrid engine adds no recall over the lexicon; its value should show on freely worded real complaints, which is unproven until officers label real cases. The rule layer has perfect recall by construction and most of the false positives (two different issues in the same category).

## How the Promise Ledger works

1. **Extract.** `ai-service/app/promises.py` finds commitments in the reply: future-tense actions and stalling phrases ("under consideration of the management"), with the action, amount, deadline ("within 30 days", "by 30 Nov", "15 दिनों में") and any condition ("after approval of …"). It quotes the institution's own words.
2. **Resolve on promise.** The officer ticks which promises to track and confirms each check date (no deadline given → 30 days). The case becomes *Resolved on promise*.
3. **Check on the deadline.** The scheduler sends the complainant a single-use link (prototype: logged to the console; *Fast-forward* triggers it in demos). The page shows no personal data.
4. **Answer.** Yes → kept (the case becomes *Resolved* once all its promises are kept). Partly → reopened. No → reopened, priority raised, escalated to the bureau head, institution notified, the broken promise attached as evidence. No answer within 7 days → *unconfirmed* (not scored).
5. **Score.** Promise Kept Rate = (kept + ½ partly kept) ÷ confirmed outcomes, per institution, across all bureaus.
6. **Copy-paste replies.** Word 3-gram overlap (numbers, dates and case references normalised) against the institution's replies to other complainants; flagged when ≥2 others match. Deliberately literal, not semantic, so two genuine refunds in different words are not called a template.

## API overview

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` · GET `/api/auth/me` | cookie session |
| GET | `/api/meta` | bureaus, categories, statuses, transitions |
| GET | `/api/dashboard/summary` | totals, hotspots, AI status |
| GET | `/api/institutions?q=` · `/api/institutions/:permanentId` | Institution 360 |
| GET/POST | `/api/cases` · GET `/api/cases/:id` | create runs overlap detection |
| PATCH | `/api/cases/:id/status` | validated transitions, note required |
| POST | `/api/cases/:id/notes` · `/api/cases/:id/rescan` | |
| POST | `/api/cases/:id/responses` | record institution response; runs ClosureGuard |
| POST | `/api/cases/:id/responses/:rid/review` · `/decision` | re-run review · `accept` / `request_more` + reason + overrides |
| GET | `/api/overlaps?status=&crossBureau=&mine=` · `/api/overlaps/stats` | |
| POST | `/api/overlaps/:id/decision` | `link` / `coordinate` / `dismiss` + reason |
| GET | `/api/audit` · `/api/audit/verify` | senior reviewer / admin (bureau head: own bureau) |
| GET · POST | `/api/notifications` · `/api/notifications/read` | own notifications |
| GET | `/api/watchlist` | senior reviewer / admin / bureau head |
| POST | `/api/import/cases` | `{ rows, dryRun }` — admin, bureau head (own bureau) |
| POST | `/api/escalations/run` | admin; also runs on a schedule |
| GET | `/api/promises?filter=open\|due_soon\|awaiting\|kept\|broken\|all` | ledger entries, stats, rates per institution |
| POST | `/api/promises/:id/fast-forward` | demo only (non-production or `DEMO_CONTROLS=true`) |
| GET · POST | `/api/checkin/:token` | **public**, single-use complainant check-in (Yes / Partly / No) |
| GET · POST | `/api/portal/summary` · `/api/portal/cases[/:id]` · `/api/portal/cases/:id/responses` | institution accounts only |
| GET | AI `:8001/health` · POST `:8001/similarity` · POST `:8001/closure-check` | internal |

## Quality checks

| Check | Command | What it covers |
|---|---|---|
| API tests | `cd backend && npm test` | 28 HTTP-level tests on an in-memory MongoDB with a fake AI service: auth, lockout, session revocation, role and bureau access, masking, validation, overlap detection, manual-resolve guard, the full Promise Ledger flow (extract → resolve on promise → fast-forward → check-in "No" → reopen + escalate + rate 80% → 67%), single-use check-in links, audit-chain tamper detection, concurrent audit writes, cron/demo-reset secrets, import dry run, copy-paste detection |
| AI tests | `cd ai-service && pytest` | ClosureGuard concerns, evidence, promises (English / Hindi / dates / conditions / stalls), future tense vs completed actions |
| Lint | `npm run lint` in `backend/` and `frontend/` | ESLint (recommended + React + hooks rules), zero warnings |
| Evaluation | `cd ai-service && python -m eval.run_eval` | Precision / recall on 501 labelled synthetic cases |
| CI | `.github/workflows/ci.yml` | Runs all of the above on every push and pull request |

## Deployment (free: Vercel + MongoDB Atlas, no Docker)

Everything runs as **one Vercel project on one URL**, on free tiers:

| Part | Where | Notes |
|---|---|---|
| Web app (React) | Vercel static hosting | Built from `frontend/` |
| API (Express) | Vercel Node function `api/index.js` | Serves `/api/*`; reuses the database connection between requests |
| AI service (FastAPI) | Vercel Python function `api/ai.py` | Serves `/ai/*` with the lightweight bilingual lexicon engine |
| Database | MongoDB Atlas free cluster (M0) | |
| Scheduled jobs | Vercel Cron, once a day | `/api/cron/tick` runs escalations and promise check-ins |

Everything is configured in `vercel.json`. The web app, the API and the AI service share one origin, so cookies stay first-party and you don't need to set up CORS.

### Step by step

1. **Database (MongoDB Atlas, free)**
   - Create an M0 cluster and a database user.
   - Under *Network Access*, allow `0.0.0.0/0`. Vercel functions don't have fixed IP addresses.
   - Copy the connection string and add the database name: `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/caselink?retryWrites=true&w=majority`.
2. **Push the code to GitHub.** Keep the repository layout as it is: `vercel.json`, `api/`, `backend/`, `frontend/`, `ai-service/` and the root `requirements.txt` must all be at the root.
3. **Import the repository in Vercel** (*Add New → Project*):
   - Leave *Root Directory* at the repository root.
   - Framework preset: *Other*. The build settings come from `vercel.json`.
4. **Add the environment variables** listed below (*Settings → Environment Variables*). Generate each secret with:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
5. **Deploy, then open the production URL.**
   - With `DEMO_MODE=true`, the first request seeds the empty database with synthetic data (it takes a few seconds).
   - After that, the login page lists the demo accounts.
6. **Optional: reset the demo before judging.** This wipes the data and re-seeds it:
   ```bash
   curl -X POST https://<your-app>.vercel.app/api/demo/reset -H "x-demo-token: <DEMO_RESET_TOKEN>"
   ```

### Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | no | not needed: Vercel deployments run as `production` automatically |
| `MONGO_URI` | yes | the Atlas connection string |
| `JWT_SECRET` | yes | ≥ 32 random characters |
| `IDENTITY_PEPPER` | yes | ≥ 32 random characters. **Never change it after go-live**: duplicate-complainant matching depends on it |
| `AI_SERVICE_KEY` | recommended | ≥ 32 random characters. Both functions read this one variable, so the AI endpoint isn't public |
| `CRON_SECRET` | recommended | ≥ 16 random characters. Vercel Cron sends it automatically, so only the cron job can call `/api/cron/tick` |
| `DEMO_MODE` | demo only | `true`: seeds the demo data, shows the demo accounts and turns on the demo buttons. **Never use it with real data** |
| `SEED_PASSWORD` | demo only | password for the demo accounts (default `CaseLink@2026`) |
| `DEMO_RESET_TOKEN` | demo only | enables `POST /api/demo/reset` |
| `SMTP_URL`, `MAIL_FROM` | optional | email notifications. Brevo and Gmail SMTP both have free plans |
| `APP_URL`, `CLIENT_ORIGIN`, `AI_SERVICE_URL` | no | worked out automatically from the Vercel production domain. Set them only for a custom domain (`AI_SERVICE_URL` = `https://<domain>/ai`) |

In production the API **refuses to start** if `MONGO_URI`, `JWT_SECRET` or `IDENTITY_PEPPER` is missing or too weak. It also seeds data only when `DEMO_MODE` is on.

### What changes on the free tier

- **AI engine:** the serverless AI uses the bilingual lexicon engine. It covers English, Hindi and Hinglish, and its scores are in the *Evaluation* section. The multilingual transformer (`hybrid`) needs a long-running server with about 1.5 GB of RAM, so it runs only locally.
- **Scheduler:** Vercel Hobby runs cron jobs once a day. Escalations and promise check-ins therefore run daily, not every 5 minutes. In the demo, the **fast-forward** button on a promise triggers its check-in instantly.
- **Cold starts:** the first request after a period of no traffic takes a second or two.
- **Rate limits** are counted separately in each function instance. That's fine for a demo. For real traffic, put them in a shared store.

### Check it locally first

```bash
cd backend && npm test && npm run lint
cd frontend && npm run lint && npm run build
cd ai-service && pytest -q
```

### Before using real grievance data

- Turn `DEMO_MODE` off and create real accounts (or integrate AICTE SSO).
- Restrict the Atlas network access list, and enable backups and encryption at rest.
- Set `SMTP_URL` (or an SMS gateway) so complainants actually receive their check-in links. The prototype only logs them.
- Review [SECURITY.md](SECURITY.md) → *Known gaps before production*.

## Design system

Warm **ember & paper** palette (`frontend/tailwind.config.js`):

| Token | Hex | Use |
|---|---|---|
| `ember-500` | `#F26C1F` | primary actions, highlights |
| `ember-600` | `#DB540E` | gradients, RB identity |
| `ember-50` | `#FFF6EE` | soft surfaces |
| `paper` | `#FFFBF6` | page background |
| `ink` | `#231B16` | text |
| `teal-500` | `#00939E` | PGRC identity, coordination |
| `plum-500` | `#7A5A9A` | AB identity |
| `sage / honey / rosewood` | — | reserved status: resolved / waiting / overdue |

Logo: `frontend/public/brand/` — `caselink-mark.png` (icon used in the app and favicons) and `caselink-logo-original.webp` (full logo as supplied). The app sets the wordmark as live text: "Case" in ink, "Link" in ember.

Fonts: Plus Jakarta Sans, Noto Sans Devanagari (Hindi), JetBrains Mono (IDs). Icons: Lucide. Motion: Framer Motion (respects *reduce motion*).

## Security

See [SECURITY.md](SECURITY.md) and the in-app *Data & security* page.
