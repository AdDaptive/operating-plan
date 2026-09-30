# AdDaptive OS

An internal operating-software MVP: objectives, key results, and tasks, with
individual accounts and a daily status digest (email and/or Slack) for
task owners and their managers.

## What's here

- **Accounts, admin-invited only** — email + password, one account per
  person. There's no public signup: an admin invites someone from the Team
  page, they get an emailed link to `/activate` to set their own password,
  and only then can they sign in at `/login` (`src/lib/auth.ts`,
  `src/app/api/admin/invite`, `src/app/activate`). The first admin is
  bootstrapped automatically (see `src/lib/db.ts`'s schema migration) --
  whichever account was created first (e.g. by the seed script below)
  automatically becomes an admin so they can invite everyone else.
- **Objectives → Key Results → Tasks** — each task has an owner, a due
  date, a status, and optional Details/Notes; each key result has its own
  owner and due date, and its status is derived automatically (worst
  status among its tasks wins); each objective's overall progress is the
  average of its key results' status-derived progress (`src/lib/rollup.ts`,
  `src/lib/status.ts`).
- **Color-coded status + due dates** — Not Started / On Track / At Risk /
  Done, with overdue due dates shown in red (`src/lib/status.ts`).
- **Daily status digest (email + Slack)** — once a day, everyone who has
  something worth knowing about gets a message: their own overdue /
  due-today / due-in-the-next-3-days / at-risk tasks, and — if they manage
  anyone — a short rollup of their direct reports' overdue or flagged items
  (`src/lib/digest.ts`). It sends over whichever channel(s) you've
  configured:
  - **Email**, via any SMTP server — set `SMTP_HOST`, `SMTP_USER`, and
    `SMTP_PASS` (and optionally `SMTP_PORT`, `SMTP_SECURE`, `DIGEST_FROM_EMAIL`)
    — see `src/lib/notifiers/email.ts`. Works with Amazon SES, SendGrid,
    Postmark, Mailgun, or any SMTP relay.
  - **Slack**, via a Slack app's bot token — set `SLACK_BOT_TOKEN` — see
    `src/lib/notifiers/slack.ts` and "Setting up Slack" below.

  With neither env var set, it still runs and logs what it *would* have
  sent to the console, which is useful for checking the digest's content
  without actually emailing/Slacking anyone. Trigger it two ways:
  - The **"Send daily digest now"** button on any task board (calls
    `POST /api/digest/run`).
  - The scheduled `GET /api/digest/run` hit by the Coolify cron task
    at 13:00 UTC — see "Deploying" below.

  Sends are logged per person/per channel/per day in the `digest_logs`
  table so triggering it more than once in a day (the button, then the
  cron) doesn't double-send.

### Setting up Slack

1. Go to <https://api.slack.com/apps> → "Create New App" → "From scratch."
   Name it (e.g. "AdDaptive OS") and pick your workspace.
2. Under **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, add:
   - `users:read.email` (find a Slack account from someone's AdDaptive OS
     email address — no separate "Slack user ID" field needed anywhere in
     this app)
   - `im:write` (open a DM with them)
   - `chat:write` (post the digest)
3. Still on **OAuth & Permissions**, click **Install to Workspace** and
   approve it.
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`) shown at the top
   of that page into your `SLACK_BOT_TOKEN` environment variable.

That's it — no channel or webhook to configure. Each digest is a direct
message from the app's bot to that person, found by matching the email
address already in your `users` table.

### Setting up email (SMTP)

The digest emailer works with any SMTP provider. Set these environment variables:

| Variable | Required | Notes |
|---|---|---|
| `SMTP_HOST` | Yes | e.g. `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_USER` | Yes | SMTP username |
| `SMTP_PASS` | Yes | SMTP password |
| `SMTP_PORT` | No | Defaults to `587` (STARTTLS). Use `465` for SSL. |
| `SMTP_SECURE` | No | Set to `"true"` when using port 465 (SSL). |
| `DIGEST_FROM_EMAIL` | No | e.g. `"AdDaptive OS <status@yourcompany.com>"`. Defaults to `AdDaptive OS <$SMTP_USER>`. Must be a verified sender on your provider. |

**Amazon SES:**
1. In the SES console, verify your sending domain (or at minimum the From address).
2. Go to **SMTP Settings** → **Create SMTP credentials** — this gives you an SMTP
   username and password (these are separate from your IAM access keys).
3. Use `email-smtp.<your-region>.amazonaws.com` as `SMTP_HOST`, port `587`.

**Other providers** (SendGrid, Postmark, Mailgun, etc.) work the same way —
just use the SMTP host and credentials from their dashboards.

## Database: Postgres

All data access goes through one file, `src/lib/db.ts`, as plain async
functions (`listUsers`, `createTask`, etc.) — nothing else in the app talks
to the database directly. It connects to Postgres via `DATABASE_URL` and
creates its own tables on first run (`CREATE TABLE IF NOT EXISTS`), so there
are no separate migration files to run.

This works with **any** Postgres — local for development, or hosted (RDS,
Neon, Supabase, Railway, etc.) for production. Just point `DATABASE_URL`
at it.

## Running it locally

```bash
# 1. Have a Postgres reachable, e.g. locally:
createdb addaptive_os

# 2. Create a .env file:
echo "DATABASE_URL=postgres://localhost/addaptive_os" > .env
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "NEXTAUTH_URL=http://localhost:3000" >> .env

npm install
npm run seed      # creates tables + a demo workspace
npm run dev        # http://localhost:3000
```

Demo login: **mmahoney@addaptive.com** / **password123**
(also seeded: jlee@, achen@, pnair@, sortiz@addaptive.com, all with the
same password — jlee is the manager the others report to, so you can see
the digest reach both an owner and their manager).

`npm run build && npm run start` runs it in production mode.

## Deploying to Coolify (with AWS RDS)

This app ships with a `Dockerfile` using Next.js standalone output — build
it once, run the image anywhere.

### 1. Create the application in Coolify

New Resource → Application → GitHub → select this repo and branch.
Coolify auto-detects the `Dockerfile`. Set port **3000**.

### 2. Environment variables

Set these in the Coolify app's Environment Variables tab:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@rds-host:5432/dbname?sslmode=require` |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Your domain, e.g. `https://os.yourcompany.com` |
| `CRON_SECRET` | Yes | `openssl rand -base64 32` — secures the digest endpoint |
| `SMTP_HOST` | Optional | For email digests, e.g. `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_USER` | Optional | SMTP username |
| `SMTP_PASS` | Optional | SMTP password |
| `SMTP_PORT` | Optional | Defaults to `587` |
| `SMTP_SECURE` | Optional | `"true"` for SSL/port 465 |
| `DIGEST_FROM_EMAIL` | Optional | e.g. `"AdDaptive OS <status@yourcompany.com>"` |
| `SLACK_BOT_TOKEN` | Optional | For Slack DM digests |

**RDS note:** RDS requires SSL. The app enables SSL automatically for any
non-localhost connection string. If you hit certificate validation errors,
append `?sslmode=no-verify` to the connection string.

### 3. Domain and SSL

Assign your domain under the app's Domains tab. Coolify provisions a
Let's Encrypt certificate automatically via Traefik. Make sure `NEXTAUTH_URL`
matches the domain exactly.

### 4. Database initialisation

The schema (all tables) is created automatically on the first request — no
migration step needed.

**To bootstrap the first admin user**, run the seed script from your local
machine against the RDS database:

```bash
DATABASE_URL="postgresql://user:pass@rds-host:5432/dbname?sslmode=require" npm run seed
```

Login with **mmahoney@addaptive.com** / **password123**, then change the
password and delete demo users/data you don't want. Whichever account exists
first in the database is automatically granted admin, so you could also
insert a user directly via psql if you'd prefer no demo data.

### 5. Cron job (daily digest)

In Coolify: app → **Scheduled Tasks** tab. Add:

- **Schedule:** `0 13 * * *` (1 PM UTC daily)
- **Command:** `sh -c 'wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/digest/run'`

This calls the same endpoint the button on the task board calls, just on a
schedule. Sends are idempotent — triggering it more than once in a day
won't double-send anyone.

### 6. Health check

The app exposes `GET /api/health` → `{ "status": "ok" }`. Configure
Coolify's built-in health check (app → Health Check tab) to use this
endpoint — Coolify polls it from outside the container and uses it to decide
when a new deployment is ready to receive traffic.

### Testing the Docker build locally before pushing

```bash
docker build -t addaptive-op .

docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="any-string" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e CRON_SECRET="test" \
  addaptive-op
```

Then open `http://localhost:3000`. If it loads, the image is correct and
Coolify will build it the same way.

## Project layout

```
src/
  app/
    login/, activate/            — auth pages (no signup/ -- accounts are admin-invited)
    forgot-password/, reset-password/
    (app)/layout.tsx              — shared sidebar shell for signed-in pages
    (app)/objectives/             — objectives grid (rollup view)
    (app)/board/[objectiveId]/    — task board for one objective
    (app)/key-results/            — every key result across every objective, with its tasks
    (app)/team/                   — directory + workload per person
    (app)/reports/                — org-wide status + progress overview
    api/
      health/                     — GET /api/health → { status: "ok" } (Docker healthcheck)
      digest/run/                 — GET (cron) + POST (manual) digest trigger
      admin/invite/               — admin-only user invitation
      auth/, objectives/, key-results/, tasks/, users/
  components/                     — modals, task rows, status pill/select, etc.
  lib/
    db.ts                         — the whole data layer (Postgres via `pg`)
    auth.ts                       — NextAuth credentials config
    digest.ts                     — builds + sends the daily digest
    notifiers/email.ts            — SMTP email sending (nodemailer)
    notifiers/slack.ts            — Slack DM sending (Slack Web API)
    rollup.ts, status.ts, avatar.ts
scripts/
  seed.ts                         — demo data (run against any DATABASE_URL)
  send-digest.ts                  — CLI entry point for `npm run digest`
Dockerfile                        — multi-stage build, standalone Next.js output
```

## What's intentionally left as an MVP

- Key result status is derived from its tasks (`computeKeyResultStatus` in
  `src/lib/rollup.ts`), not set manually: worst status wins, in the order
  At Risk > Not Started > On Track > Done, and a key result with no tasks
  defaults to Not Started. That status is mapped to a percentage via
  `STATUS_PROGRESS` in `src/lib/status.ts` for progress bars/rollup. Both
  are deliberate, adjustable conventions.
