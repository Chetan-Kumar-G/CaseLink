# Security notes — CaseLink prototype

This is a hackathon prototype running on **synthetic data**. The controls below are implemented; the gaps at the end must be closed before any real use.

## Implemented

| Area | Control | Where |
|---|---|---|
| Passwords | bcrypt (cost 12), never returned by the API | `backend/src/models/User.js` |
| Sessions | HS256 JWT in an `httpOnly`, `SameSite=Strict` cookie (`Secure` in production); Bearer header also accepted for API clients | `backend/src/middleware/auth.js` |
| Revocation | Sign-out bumps `tokenVersion`, invalidating every session of that user | `routes/auth.js` |
| Brute force | Sign-in rate limit (20 / 15 min / IP) + account lock for 15 min after 5 failures | `routes/auth.js`, `models/User.js` |
| Authorisation | Role + bureau checks on the server for every route (officer, bureau head, senior reviewer, admin) | `services/access.js` |
| Data minimisation | Complainant name masked and contact hidden outside the owning bureau; duplicates matched on a keyed HMAC of email/phone | `services/access.js`, `utils/text.js` |
| Input validation | zod schemas on every write; regex inputs escaped; JSON body limit 64 KB | `routes/*.js` |
| Headers / CORS | Helmet defaults; CORS restricted to `CLIENT_ORIGIN`; `x-powered-by` disabled | `app.js` |
| Audit | Append-only, SHA-256 hash-chained log; updates/deletes blocked at the model layer; `/api/audit/verify` recomputes the chain | `models/AuditLog.js`, `services/audit.js` |
| AI service | Receives complaint text only (no identity); optional shared key via `x-service-key`; request size limits | `ai-service/app/main.py` |
| Institution portal | `institution` accounts are blocked from every staff route; portal routes return only that institution's cases, never complainant identity or the ClosureGuard checklist | `app.js`, `routes/portal.js` |
| Imports | Admin / bureau head only; bureau heads limited to their bureau; every row validated with the same schema as manual entry; 2 MB / 500-row limit | `routes/import.js` |
| Notifications | Sent only to users resolved server-side by role and bureau; failures never block the workflow; email only when `SMTP_URL` is configured | `services/notify.js` |
| Complainant check-in | Public route reachable only with an unguessable single-use token (24 random bytes); rate-limited; shows the institution, promised action and date — no personal data; expires after 7 days; answer recorded once | `routes/checkin.js` |
| Demo controls | *Fast-forward* exists only outside production unless `DEMO_CONTROLS=true` | `routes/promises.js` |
| Secrets | `JWT_SECRET` / `IDENTITY_PEPPER` required (≥32 chars) in production; in development they are generated once into `backend/.data/dev-secrets.json` (git-ignored); seeding refused in production | `config/env.js`, `seed/seed.js` |

## Known gaps before production

- Integrate AICTE's identity provider (SSO / MFA) instead of local passwords.
- Hash chain proves tampering but does not prevent a DB admin from rewriting the whole chain — anchor the head hash externally (e.g. periodic signed export).
- Data retention schedule and DPDP Act 2023 compliance review.
- Encryption at rest for MongoDB, TLS everywhere, secrets in a vault.
- Dependency and container scanning in CI; penetration test.

## Reporting

Report issues privately to the project team rather than opening a public issue.
