# AdDaptive OS

An internal operating-software MVP: objectives, key results, and tasks, with
individual accounts and a daily status digest (email and/or Slack) for
task owners and their managers.

## What's here

- **Accounts** — email + password, one account per person (`src/lib/auth.ts`,
  `/signup`, `/login`).
- **Objectives → Key Results → Tasks** — each task has an owner and belongs
  to a key result; each key result has its own due date and a manually-set
  status; each objective's overall progress is the average of its key
  results' status-derived progress (`src/lib/rollup.ts`, `src/lib/status.ts`).
- **Color-coded status + due dates** — Not Started / On Track / At Risk /
  Off Track / Done, with overdue due dates shown in red
  (`src/lib/status.ts`).
- **Daily status digest (email + Slack)** — once a day, everyone who has
  something worth knowing about gets a message: their own overdue /
  due-today / due-in-the-next-3-days / at-risk-or-off-track tasks, and — if
  they manage anyone — a short rollup of their direct reports' overdue or
  flagged items (`src/lib/digest.ts`). It sends over whichever channel(s)
  you've configured:
  - **Email**, via [Resend](https://resend.com) — set `RESEND_API_KEY`
    (and optionally `DIGEST_FROM_EMAIL`) — see `src/lib/notifiers/email.ts`.
  - **Slack**, via a Slack app's bot token — set `SLACK_BOT_TOKEN` — see
    `src/lib/notifiers/slack.ts` and "Setting up Slack" below.

  With neither env var set, it still runs and logs what it *would* have
  sent to the console, which is useful for checking the digest's content
  without actually emailing/Slacking anyone. Trigger it two ways:
  - The **"Send daily digest now"** button on any task board (calls
    `POST /api/digest/run`).
  - `npm run digest`, or the scheduled `GET /api/digest/run` (see
    `vercel.json`), meant to run once a day.

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

### Setting up email (Resend)

1. Sign up at <https://resend.com> (free tier is fine to start).
2. Copy an API key from the dashboard into `RESEND_API_KEY`.
3. By default, sends go from Resend's shared `onboarding@resend.dev`
   address, which **only delivers to the email you signed up to Resend
   with** — fine for testing solo, not for emailing a whole team. To email
   everyone, verify your own sending domain in Resend (Domains → Add
   Domain, then a few DNS records), then set `DIGEST_FROM_EMAIL` to an
   address on that domain, e.g. `"AdDaptive OS <status@yourcompany.com>"`.

## Database: Postgres

All data access goes through one file, `src/lib/db.ts`, as plain async
functions (`listUsers`, `createTask`, etc.) — nothing else in the app talks
to the database directly. It connects to Postgres via `DATABASE_URL` and
creates its own tables on first run (`CREATE TABLE IF NOT EXISTS`), so there
are no separate migration files to run.

This works with **any** Postgres: a local Postgres for development, or a
hosted one for deploying — Netlify Database (Netlify's built-in managed
Postgres, zero-config), Neon, Supabase, Railway, RDS, whatever you already
use. Just point `DATABASE_URL` at it.

(Earlier version note: this briefly ran on Node's built-in `node:sqlite`
with a local file, because the sandbox it was first built in blocked
network access to `binaries.prisma.sh`. That doesn't deploy anywhere with
serverless functions — no persistent disk between invocations — so it's
been swapped for Postgres, which does.)

## Running it locally

```bash
# 1. Have a Postgres reachable, e.g. locally:
createdb addaptive_os

# 2. Set DATABASE_URL in .env (see .env for the local default)

npm install
npm run seed      # creates tables + a demo workspace
npm run dev        # http://localhost:3000
```

Demo login: **mmahoney@addaptive.com** / **password123**
(also seeded: jlee@, achen@, pnair@, sortiz@addaptive.com, all with the
same password — jlee is the manager the others report to, so you can see
the digest reach both an owner and their manager).

`npm run build && npm run start` runs it in production mode.

## Deploying — this app isn't tied to Netlify

Nothing in the code depends on Netlify specifically — it's a plain Next.js
app that talks to Postgres over `DATABASE_URL`. `netlify.toml` is just a
config file; a host that doesn't use it simply ignores it. So if you're out
of Netlify credits and don't want to upgrade, any of the options below work
with zero code changes.

### Option A: Vercel (recommended free option)

Vercel is built by the team that makes Next.js, so it needs the least
configuration of any host, and its free "Hobby" tier (no credit card
charge, no upgrade needed) comfortably covers an app like this.

1. Push this code to a GitHub (or GitLab/Bitbucket) repo if it isn't
   already there.
2. At vercel.com, "Add New… → Project" and import that repo. It
   auto-detects Next.js — you don't need to change any build settings.
3. Before the first deploy (or right after, then redeploy), add these
   under Project Settings → Environment Variables:
   - `DATABASE_URL` — see the free Postgres options below
   - `NEXTAUTH_SECRET` — a long random string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` — your deployed URL, e.g. `https://your-app.vercel.app`
   - `RESEND_API_KEY` and/or `SLACK_BOT_TOKEN` — for the daily digest (see
     "Setting up Slack" / "Setting up email" above); skip either you don't
     want to use
4. Deploy. Then run the seed script once **against that database** from
   your own machine: `DATABASE_URL="<the deployed connection string>" npm
   run seed`. (Or skip it and just sign up for real accounts at `/signup`.)
5. For the daily digest on a schedule, Vercel's free tier supports
   **Vercel Cron Jobs** (1 included free) — already configured in
   `vercel.json`, hitting `GET /api/digest/run` once a day at 13:00 UTC.
   Just add a `CRON_SECRET` environment variable (any long random string)
   — the route checks for it so random visitors can't trigger sends, and
   Vercel automatically sends it as a bearer token to your cron jobs.

Free Postgres to pair with it (either works fine with `db.ts` as-is, since
it turns on SSL automatically for any non-localhost connection string):

- **Neon** — serverless Postgres, generous free tier, no credit card
  required. Copy its connection string straight into `DATABASE_URL`.
- **Supabase** — also has a free Postgres tier, same idea.

### Option B: Render

Render's free tier can run this too (a free Web Service + free Postgres
for 90 days, or pair it with Neon for a Postgres that doesn't expire). The
free web service spins down after inactivity, so the first request after a
quiet period is slow (~30s cold start) — fine for internal/demo use, less
fine if you need it always-instant.

1. New → Web Service, connect the repo, build command `npm run build`,
   start command `npm run start`.
2. Add the same environment variables as above (`DATABASE_URL`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `RESEND_API_KEY`/`SLACK_BOT_TOKEN`
   for the digest).
3. Seed and schedule the digest the same way as Option A (Render has cron
   jobs too, as a separate free-tier service type).

### Deploying to Netlify (if you come back to it later)

1. Push this to a GitHub/GitLab/Bitbucket repo and create a new Netlify
   site from it (or use the Netlify CLI: `netlify deploy`). Netlify
   auto-detects Next.js and uses the `@netlify/plugin-nextjs` runtime
   (already declared in `netlify.toml`) — App Router, API routes, and SSR
   all work as Netlify Functions/Edge Functions.
2. Get a Postgres database. Easiest: in the Netlify dashboard, add
   **Netlify Database** to the site (Postgres, provisioned for you, sets
   `DATABASE_URL` automatically). Or bring your own — Neon, Supabase,
   Railway — and set `DATABASE_URL` yourself.
3. In Site configuration → Environment variables, set:
   - `DATABASE_URL` (skip if Netlify Database set it for you)
   - `NEXTAUTH_SECRET` — a long random string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` — your site's URL, e.g. `https://your-site.netlify.app`
   - `RESEND_API_KEY` and/or `SLACK_BOT_TOKEN` — for the daily digest
4. Deploy. Then run the seed script once **against that database** to
   create its tables and demo data — easiest from your own machine:
   `DATABASE_URL="<the deployed connection string>" npm run seed`.
   (Or skip seeding and just sign up for real accounts at `/signup`.)
5. For the daily digest in production, add a Netlify Scheduled Function
   that calls `runDailyDigest()` from `src/lib/digest.ts` (or hits
   `POST /api/digest/run` on a cron), since nothing calls it automatically
   on Netlify yet — see "Not yet built" below.

## Project layout

```
src/
  app/
    login/, signup/              — auth pages
    (app)/layout.tsx              — shared sidebar shell for signed-in pages
    (app)/objectives/             — objectives grid (rollup view)
    (app)/board/[objectiveId]/    — task board for one objective
    (app)/key-results/            — every key result across every objective, with its tasks
    (app)/team/                   — directory + workload per person
    (app)/reports/                — org-wide status + progress overview
    api/                          — REST-ish routes the client calls
  components/                     — modals, task rows, status pill/select, etc.
  lib/
    db.ts                         — the whole data layer (Postgres via `pg`)
    auth.ts                       — NextAuth credentials config
    digest.ts                     — builds + sends the daily digest
    notifiers/email.ts            — Resend email sending
    notifiers/slack.ts            — Slack DM sending (Slack Web API)
    rollup.ts, status.ts, avatar.ts
scripts/
  seed.ts                         — demo data (run against any DATABASE_URL)
  send-digest.ts                  — CLI entry point for `npm run digest`
netlify.toml                      — Netlify build + Next.js runtime config
vercel.json                       — Vercel Cron Job config (daily digest sweep)
```

## What's intentionally left as an MVP

- No password reset flow, no team/org management UI beyond the read-only
  Team page.
- No "edit objective" screen (only "New objective"), so an objective
  created before a schema change may need re-creating to pick up new
  fields.
- Key result progress is driven by a manually-set status, mapped to a
  percentage via `STATUS_PROGRESS` in `src/lib/status.ts` — a deliberate,
  easily-adjustable convention rather than an automatic roll-up from task
  completion, since that mapping is genuinely a product decision worth
  choosing rather than guessing.
