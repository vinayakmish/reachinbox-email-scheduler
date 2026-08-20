# ReachInbox Email Scheduler

A production-quality full-stack email scheduling service built for the ReachInbox Software Development Intern Assignment.

## Architecture Overview

```mermaid
graph TD
    FE[React Frontend<br/>Vite + Tailwind] -->|REST API + Cookies| BE[Express Backend<br/>TypeScript]
    BE -->|Passport.js| G[Google OAuth 2.0]
    BE -->|Prisma ORM| PG[(PostgreSQL<br/>Persistent state)]
    BE -->|Enqueue delayed jobs| BQ[BullMQ Queue]
    BQ -->|AOF-persisted| RD[(Redis)]
    W[BullMQ Worker<br/>Configurable concurrency] -->|Dequeue jobs| BQ
    W -->|Atomic status claim| PG
    W -->|Rate limit check| RD
    W -->|Nodemailer| SMTP[Ethereal SMTP]
    W -->|Update status| PG
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, TypeScript, Express.js |
| Database | PostgreSQL 16 (via Prisma ORM) |
| Queue | BullMQ 5 |
| Cache/Queue Store | Redis 7 (AOF persistence) |
| Email | Nodemailer + Ethereal SMTP |
| Auth | Passport.js + Google OAuth 2.0 |
| Sessions | express-session + PostgreSQL store |
| Logging | Pino |
| Testing | Jest + Supertest |
| Infrastructure | Docker Compose |

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── config/          # Redis, Prisma, app config
│   │   ├── controllers/     # HTTP handlers
│   │   ├── middleware/      # Auth, error handling, upload
│   │   ├── queues/          # BullMQ queue setup
│   │   ├── routes/          # Express routers
│   │   ├── services/        # Business logic
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Logger, CSV parser
│   │   └── workers/         # BullMQ worker
│   ├── prisma/
│   │   └── schema.prisma
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # AuthContext
│   │   ├── hooks/           # useSenders, useEmailJobs
│   │   ├── pages/           # LoginPage, DashboardPage
│   │   ├── services/        # API client (axios)
│   │   └── types/           # TypeScript interfaces
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox

# Redis
REDIS_URL=redis://localhost:6379

# Session (generate a long random string)
SESSION_SECRET=your-very-long-random-session-secret-here

# Google OAuth (see setup below)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Frontend URL for redirects and CORS
FRONTEND_URL=http://localhost:5173

# Server
PORT=3001
NODE_ENV=development

# Worker Configuration
WORKER_CONCURRENCY=5          # Number of concurrent job workers
MIN_EMAIL_DELAY_MS=2000       # Minimum delay between emails (BullMQ limiter)
MAX_EMAILS_PER_HOUR_PER_SENDER=200  # Hourly rate limit per sender

# Ethereal SMTP (leave blank to auto-create)
ETHEREAL_USER=
ETHEREAL_PASS=
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Set Application type to **Web application**
6. Add **Authorized redirect URIs**:
   - `http://localhost:3001/api/auth/google/callback` (development)
7. Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (frontend)
   - `http://localhost:3001` (backend)
8. Copy `Client ID` and `Client Secret` to `backend/.env`
9. Also configure the OAuth consent screen with your app name and email

## Ethereal SMTP Setup

Ethereal is automatically configured — no account needed!

When the backend starts, if `ETHEREAL_USER`/`ETHEREAL_PASS` are not set, it automatically creates a free Ethereal test account via `nodemailer.createTestAccount()`.

Sent email previews are logged to the console with a preview URL like:
```
https://ethereal.email/message/WaQKMgahfVnxQ7jG...
```

To use a persistent account, set `ETHEREAL_USER` and `ETHEREAL_PASS` from https://ethereal.email.

## Quick Start

### 1. Start Infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d
```

### 2. Set Up Backend

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env with your Google OAuth credentials

# Install dependencies
npm install

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Start backend (dev mode)
npm run dev
```

### 3. Set Up Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start frontend (dev mode)
npm run dev
```

### 4. Open the App

Navigate to http://localhost:5173 and sign in with Google.

## API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | OAuth callback handler |
| GET | `/api/auth/me` | Get current authenticated user |
| POST | `/api/auth/logout` | Logout and clear session |

### Senders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/senders` | List senders for current user |
| POST | `/api/senders` | Create sender (auto-creates Ethereal account) |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns` | Create + schedule campaign (multipart) |
| GET | `/api/campaigns` | List campaigns |
| GET | `/api/campaigns/:id` | Get campaign details |
| POST | `/api/campaigns/:id/cancel` | Cancel campaign |

### Emails

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/emails/scheduled` | List scheduled/pending emails (paginated) |
| GET | `/api/emails/sent` | List sent/failed emails (paginated) |
| GET | `/api/emails/:id` | Get single email details |

### Campaign Creation (POST /api/campaigns)

Request type: `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| subject | string | Email subject |
| body | string | Email body (HTML supported) |
| recipientsFile | file | CSV or TXT file with email addresses |
| startTime | ISO string | When to send the first email |
| delayBetweenEmails | number | Milliseconds between each email |
| hourlyLimit | number | Max emails per hour per sender |
| senderId | string | ID of the sender to use |

## BullMQ Architecture

### Why BullMQ (not cron)?

**BullMQ with delayed jobs** is fundamentally different from cron schedulers:

- **Cron** triggers at fixed time intervals and requires an in-memory process. If the server restarts, pending sends are lost.
- **BullMQ delayed jobs** are stored in Redis with their target execution time. If the server restarts, the jobs remain in Redis and are automatically processed when the worker reconnects.

No `node-cron`, `cron`, `setInterval`, or `setTimeout` schedulers are used anywhere in this codebase.

### Job Flow

```
POST /api/campaigns
  │
  ├── Create EmailCampaign in PostgreSQL
  │
  ├── Create EmailJob records (batch of 500)
  │   └── idempotencyKey = campaign:{id}:recipient:{email}:index:{n}
  │
  └── Enqueue BullMQ delayed job per email
      └── delay = max(0, scheduledAt - now)
          └── jobId = email-job-{emailJobId} (stable, prevents duplicates)

BullMQ Worker (when delay expires):
  │
  ├── Atomic claim: UPDATE WHERE status IN ('PENDING','RESCHEDULED') → 'PROCESSING'
  │   └── 0 rows updated → already claimed → skip (idempotency)
  │
  ├── Rate limit check (Redis INCR)
  │   └── Over limit → DECR + reschedule to next hour window + new delayed job
  │
  ├── Send via Ethereal SMTP (nodemailer)
  │
  ├── Success → mark SENT + increment campaign.sentCount
  │
  └── Failure → mark FAILED + BullMQ retries with exponential backoff
```

## Worker Concurrency

Configure via environment variable:
```env
WORKER_CONCURRENCY=5
```

The BullMQ worker uses this to process up to `N` jobs simultaneously.

Additionally, the `MIN_EMAIL_DELAY_MS` creates a rate limiter:
```typescript
limiter: {
  max: config.worker.concurrency,
  duration: config.worker.minEmailDelayMs,
}
```

This ensures the minimum delay between email sends is respected across concurrent workers.

## Hourly Rate Limiting

Rate limiting is **Redis-backed and distributed-safe**, working correctly with multiple worker instances.

### Implementation

```typescript
// Key format: rate_limit:{senderId}:{hourWindow}
// hourWindow = Math.floor(Date.now() / 3_600_000)

// Atomic increment
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 7200); // 2hr TTL

if (count > maxPerHour) {
  await redis.decr(key);                  // Roll back
  rescheduleToNextHourWindow();           // Delay job to next window
}
```

### Behavior with 1000 emails + limit 200

- `t=10:00` → 200 emails sent (limit reached for window 10:00–11:00)
- Remaining 800 emails rescheduled to window 11:00
- At `t=11:00` → next 200 sent, and so on
- Jobs preserve PostgreSQL state throughout — no data loss on restart

## Idempotency Strategy

Every email has a **unique idempotency key** enforced at the database level:

```
idempotencyKey = campaign:{campaignId}:recipient:{email}:index:{n}
```

This has a `@unique` Prisma constraint (database-level unique index).

### Concurrency-safe claiming

Before sending, the worker atomically transitions the job status:

```sql
UPDATE EmailJob
SET status = 'PROCESSING'
WHERE id = {emailJobId}
AND status IN ('PENDING', 'RESCHEDULED')
```

If this returns `0 rows updated`, another worker already claimed it — skip immediately. This prevents race conditions between workers, retries, and restarts.

### Status lifecycle

```
PENDING → PROCESSING → SENT
                     → FAILED (BullMQ retries with backoff)
PENDING → RESCHEDULED (rate limit) → PENDING (new delayed job)
```

## Restart Persistence

### How it works

1. **Redis AOF persistence** — Redis is configured with `--appendonly yes --appendfsync everysec`
2. BullMQ delayed jobs are stored in Redis sorted sets by their execution timestamp
3. On server restart, BullMQ worker reconnects to Redis and processes any due jobs
4. PostgreSQL is the source of truth for email status
5. On restart, if a job in Redis has a corresponding `PROCESSING` email in PostgreSQL (crashed mid-send), it will be retried

### Configuration in docker-compose.yml

```yaml
redis:
  command: redis-server --appendonly yes --appendfsync everysec
  volumes:
    - redis_data:/data  # Persisted across container restarts
```

## Database Migrations

```bash
# Initial migration
npx prisma migrate dev --name init

# Deploy migrations (production)
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate

# View DB in browser
npx prisma studio
```

## Testing

```bash
cd backend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test file
npx jest tests/csvParser.test.ts
```

### Test coverage

- ✅ CSV parsing + email validation
- ✅ Duplicate email removal
- ✅ Campaign scheduling logic (delay intervals, idempotency keys)
- ✅ Rate limiter (Redis-backed, limit enforcement, count correctness)
- ✅ Authentication middleware (401 on unauthenticated requests)
- ✅ 1000-email scheduling correctness

> **Note**: Rate limiter tests require Redis to be running (`docker compose up -d redis`)

## Security

- **Helmet** — HTTP security headers
- **CORS** — Restricted to frontend origin only
- **HTTP-only cookies** — Session cannot be accessed by JavaScript
- **Secure sessions** — PostgreSQL-backed, `sameSite: lax` in development
- **Upload limits** — 5MB max file size
- **Input validation** — Zod schemas on all endpoints
- **No secrets in frontend** — OAuth handled entirely server-side
- **`.gitignore`** — `.env` files excluded

## Design Decisions & Trade-offs

### BullMQ stable job IDs
Each email job uses `jobId: email-job-{emailJobId}`. If the same job is accidentally enqueued twice (e.g., during a retry), BullMQ deduplicates by job ID, providing an extra layer of idempotency at the queue level.

### Session vs JWT
PostgreSQL-backed sessions are used instead of JWTs because:
- Sessions can be invalidated server-side (logout works immediately)
- No token refresh complexity
- More secure for this use case

### Ethereal auto-provisioning
If no Ethereal credentials are configured, the system auto-creates a test account on first send. The account is cached in memory for the server lifetime. For production, configure `ETHEREAL_USER`/`ETHEREAL_PASS`.

### Batch DB inserts
When creating campaigns with 1000+ recipients, email jobs are inserted in chunks of 500 using Prisma's `createMany` for efficiency. BullMQ jobs are enqueued in batches of 100 to avoid Redis overload.

### Rate limit jitter
When rescheduling due to rate limits, a small random jitter (0–5000ms) is added to avoid the "thundering herd" problem where all rescheduled jobs fire simultaneously at the next hour boundary.
