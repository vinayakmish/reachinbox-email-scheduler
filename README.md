# ReachInbox Email Scheduler

A production-oriented full-stack email scheduling service built for the ReachInbox Software Development Intern Assignment.

## Architecture Overview

```mermaid
graph TD
    FE[React Frontend<br/>Vite + Tailwind CSS] -->|REST API + Session Cookie| BE[Express Backend<br/>TypeScript]
    BE -->|Passport.js Strategy| G[Google OAuth 2.0]
    BE -->|Prisma ORM| PG[(PostgreSQL<br/>Persistent state & ACID transactions)]
    BE -->|Enqueue delayed jobs| BQ[BullMQ Queue]
    BQ -->|AOF-persisted| RD[(Redis 7 / 5+)]
    W[BullMQ Worker<br/>Configurable concurrency] -->|Dequeue scheduled jobs| BQ
    W -->|Atomic status claim| PG
    W -->|Atomic Lua rate check| RD
    W -->|Nodemailer SMTP| SMTP[Ethereal SMTP]
    W -->|Transaction update SENT/FAILED| PG
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| Backend | Node.js, TypeScript, Express.js |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Queue Engine | BullMQ 5 |
| In-Memory Data Store | Redis (with AOF persistence `--appendonly yes --appendfsync everysec`) |
| Email Transport | Nodemailer + Ethereal SMTP (auto-provisioned sandbox) |
| Authentication | Passport.js + Google OAuth 2.0 |
| Session Store | `connect-pg-simple` (PostgreSQL `user_sessions`) |
| Structured Logging | Pino + Pino Pretty |
| Validation | Zod |
| Testing | Jest + Supertest + ts-jest (27 automated tests) |
| Containerization | Docker & Docker Compose |

---

## Features Implemented

### Backend
* **Google OAuth authentication**: Secure login flow using Passport.js and Google OAuth 2.0 with HTTP-only session cookies.
* **PostgreSQL persistence**: Relational database storing Users, Senders, EmailCampaigns, and EmailJobs.
* **BullMQ delayed email scheduling**: True queue-based delayed scheduling without in-memory `setTimeout`, `setInterval`, or `node-cron`.
* **Redis-backed queue**: Durable job queue with persistent storage across service restarts.
* **Configurable worker concurrency**: Configured via `WORKER_CONCURRENCY` to process jobs concurrently.
* **Configurable minimum email delay**: Enforced via `MIN_EMAIL_DELAY_MS` to prevent server burst hammering.
* **Redis-backed per-sender hourly rate limiting**: Atomic single-roundtrip Lua script enforcing strict per-sender hourly quotas without concurrency race conditions.
* **Multiple sender support**: Users can configure and dispatch campaigns across distinct sender accounts independently.
* **CSV/TXT recipient parsing**: Fast stream parsing supporting comma/newline/semicolon delimited email lists.
* **Email validation**: Strict RFC-compliant regex validation filtering malformed addresses.
* **Duplicate recipient removal**: Deduplicates recipient emails case-insensitively within uploaded campaigns.
* **Idempotent job processing**: Deterministic database unique constraint `idempotencyKey` + atomic `updateMany` job claiming.
* **Ethereal SMTP delivery**: Safe sandbox test delivery generating instant web preview URLs.
* **Rate-limit rescheduling**: Automatic job rescheduling to the start of the next UTC hour window with jitter.
* **Restart-safe delayed jobs**: Delayed jobs persist in Redis sorted sets and resume dispatching on worker reconnect.
* **Failed email tracking**: Captures SMTP error messages and tracks `failedCount` on campaign metrics.
* **Campaign management**: Full lifecycle management (Schedule, List, View, Cancel).
* **API validation**: Strict schema validation via Zod on all incoming HTTP payloads.
* **Structured logging**: Pino structured JSON logging in production and colorized output in development.

### Frontend
* **Google login**: Clean authentication gateway with OAuth redirect.
* **User profile/avatar**: Displays user profile avatar, name, and email in header.
* **Logout**: Server-side session invalidation and cookie cleanup.
* **Dashboard**: Centralized dashboard with summary metrics cards (Total Senders, Scheduled, Sent, Failed).
* **Scheduled Emails**: Paginated list of queued emails with recipient, subject, scheduled time, and status.
* **Sent Emails**: Paginated audit log of delivered emails with sent timestamps and error details.
* **Compose New Email**: Modal form for creating and scheduling campaigns.
* **CSV/TXT upload**: Drag-and-drop file upload with format validation.
* **Recipient count**: Real-time client-side preview of valid recipient email counts.
* **Start-time scheduling**: Localized date-time picker for target campaign dispatch.
* **Delay configuration**: Configurable inter-email delay (ms) per campaign.
* **Hourly limit configuration**: Configurable sender limit per campaign.
* **Sender selection**: Dropdown selector with automatic default synchronization.
* **Loading states**: Non-blocking spinner components across actions.
* **Empty states**: Informative placeholders when no senders or emails exist.
* **Error handling**: Toast notifications and field-level validation feedback.
* **Automatic UI updates**: 10-second polling synchronization keeping table statuses fresh without manual reload.

---

## Architecture & System Design

### 1. Scheduling Architecture (BullMQ Delayed Jobs)
Unlike `node-cron` or `setInterval` which rely on vulnerable in-memory clocks, this system schedules emails as **BullMQ Delayed Jobs** in Redis.
- When a campaign is submitted, each recipient is calculated a precise execution time:
  $$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delayBetweenEmails})$$
- The delay offset $\max(0, \text{scheduledAt}_i - \text{now})$ is registered with BullMQ.
- Redis places the job into a sorted set keyed by timestamp. When the timestamp arrives, BullMQ transitions the job to active and feeds it to available workers.

### 2. Redis & PostgreSQL Persistence on Restart
- **Redis AOF Persistence**: Redis is configured with `--appendonly yes --appendfsync everysec`. All delayed jobs in the queue survive worker/server reboots.
- **PostgreSQL Source of Truth**: All campaign metadata, recipient states (`PENDING`, `PROCESSING`, `RESCHEDULED`, `SENT`, `FAILED`), and sender credentials reside in PostgreSQL.
- **Restart Scenario**: If the backend/worker restarts while 500 emails are delayed for tomorrow, zero state is lost. When the worker restarts, it connects to Redis and continues listening for job triggers.

### 3. Distributed Rate Limiting via Redis Lua Script
To prevent race conditions across multiple worker processes or backend instances, rate limiting uses an **atomic Redis Lua script**:
```lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = tonumber(redis.call('get', key) or '0')

if current >= limit then
  return {0, current}
end

local new_count = redis.call('incr', key)
if new_count == 1 then
  redis.call('expire', key, ttl)
end

return {1, new_count}
```
- Key format: `rate_limit:{senderId}:{hourWindow}` where `hourWindow = Math.floor(Date.now() / 3_600_000)` (UTC Epoch Hour).
- If the sender has capacity, the reservation is confirmed in a single atomic transaction.
- If the sender is at capacity, the job is **never dropped**; it transitions to `RESCHEDULED` and is enqueued as a delayed job for the next UTC hour window plus random jitter (0–5000ms) to avoid thundering herds.

### 4. Idempotency & Distributed Systems Trade-offs
Each email job is guarded by three layers of deduplication:
1. **Database Unique Constraint**: `idempotencyKey = campaign:{campaignId}:recipient:{email}:index:{n}` with `@unique` constraint in PostgreSQL.
2. **Stable BullMQ Job IDs**: `jobId: email-job-{emailJobId}` prevents duplicate enqueuing at the queue layer.
3. **Atomic Status Claim**:
   ```sql
   UPDATE "EmailJob"
   SET status = 'PROCESSING', attempts = attempts + 1
   WHERE id = :emailJobId AND status IN ('PENDING', 'RESCHEDULED');
   ```
   If 0 rows are updated, another worker thread has claimed the job, preventing concurrent duplicate dispatch.

#### ⚠️ The Distributed SMTP/DB Failure Window:
Because SMTP is an external side effect across an uncoordinated network boundary, PostgreSQL cannot perform a Two-Phase Commit (2PC) with third-party mail servers. If a worker process crashes immediately after SMTP ACK but prior to PostgreSQL updating status to `SENT`, BullMQ retry logic will re-process the job upon recovery. The architecture minimizes this window by executing the DB update in an immediate transaction directly following SMTP resolution.

### 5. 1000+ Scalability & Batch Processing
- Recipient files are parsed in memory using an $O(N)$ Set dedup algorithm.
- Database records are chunked in batches of 500 using Prisma `createMany`.
- BullMQ delayed jobs are enqueued in chunks of 100 to prevent Redis socket buffer saturation.

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox

# Redis
REDIS_URL=redis://localhost:6379

# Session Secret (random 32+ character string)
SESSION_SECRET=dev-super-secret-session-key-change-in-production-32chars

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server & Worker Configuration
PORT=3001
NODE_ENV=development
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200

# Ethereal SMTP (Leave blank to auto-generate test account)
ETHEREAL_USER=
ETHEREAL_PASS=
```

---

## Quick Start Guide

### 1. Start Infrastructure via Docker Compose
```bash
docker compose up -d
```
*This starts PostgreSQL 16 on port `5432` and Redis 7 on port `6379` with AOF persistence.*

### 2. Setup & Start Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your Google OAuth credentials

npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### 3. Setup & Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Open your browser at **http://localhost:5173**.

---

## Automated Test Suite

Run the full automated test suite (27 tests across 5 suites):
```bash
cd backend
npm test
```

### Test Suites:
1. `tests/verification.test.ts`: Reviewer requirement verification (rate limiting, concurrency, delay staggering, idempotency, 1000+ scalability, Redis persistence).
2. `tests/rateLimiter.test.ts`: Redis Lua rate limiter atomic unit tests and 10-worker concurrency tests.
3. `tests/campaignService.test.ts`: Campaign creation and delay scheduling interval validation.
4. `tests/csvParser.test.ts`: Email validation, RFC compliance, and CSV/TXT dedup parsing.
5. `tests/auth.test.ts`: Security middleware and 401 unauthorized endpoint guards.

---

## Security

* **No Secrets Committed**: `.env` is ignored by `.gitignore`; only `.env.example` templates are tracked.
* **HTTP-Only Cookies**: Session IDs are stored in HTTP-only, SameSite cookies.
* **Helmet & CORS**: Strict HTTP headers and explicit origin whitelisting (`http://localhost:5173`).
* **File Upload Protections**: Multer memory storage restricted to 5MB and `.csv`/`.txt` MIME types.
* **Zod Sanitization**: All endpoint bodies are parsed and validated against strict schemas.
