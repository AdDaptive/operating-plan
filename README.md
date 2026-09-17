# AdDaptive OS

An internal operating-software MVP: objectives, key results, and tasks, with
individual accounts and automated owner/manager reminders.

## What's here

- **Accounts** — email + password, one account per person (`src/lib/auth.ts`,
  `/signup`, `/login`).
- **Objectives → Key Results → Tasks** — each task has an owner and belongs
  to a key result; each key result has a due-ready progress value; each
  objective's overall progress is the average of its key results'
  (`src/lib/rollup.ts`).
- **Color-coded status + due dates** — Not Started / On Track / At Risk /
  Off Track / Done, with overdue due dates shown in red
  (`src/lib/status.ts`).
- **Automated reminders** — a sweep that finds tasks due in 3 days or 1 day
  and logs a reminder to the owner and the owner's manager
  (`src/lib/reminders.ts`). Actually *sending* email is stubbed — it logs to
  the console and records a row in `reminder_logs` — swap in a real
  provider (Resend, SendGrid, Postmark, Microsoft 365 SMTP, etc.) in that
  one file when you're ready. Trigger it two ways:
  - The **"Run reminders now"** button on any task board (calls
    `POST /api/reminders/run`).
  - `npm run reminders`, meant to be run on a schedule (cron, a serverless
    scheduled function, GitHub Actions, etc.) once a day.

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
reminders reach both an owner and their manager).

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
4. Deploy. Then run the seed script once **against that database** from
   your own machine: `DATABASE_URL="<the deployed connection string>" npm
   run seed`. (Or skip it and just sign up for real accounts at `/signup`.)
5. For reminders on a schedule, Vercel's free tier supports **Vercel Cron
   Jobs** (1 included free) — already configured in `vercel.json`, hitting
   `GET /api/reminders/run` once a day at 13:00 UTC. Just add a
   `CRON_SECRET` environment variable (any long random string) — the route
   checks for it so random visitors can't trigger sends, and Vercel
   automatically sends it as a bearer token to your cron jobs.

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
2. Add the same three environment variables as above (`DATABASE_URL`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL`).
3. Seed and schedule reminders the same way as Option A (Render has cron
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
4. Deploy. Then run the seed script once **against that database** to
   create its tables and demo data — easiest from your own machine:
   `DATABASE_URL="<the deployed connection string>" npm run seed`.
   (Or skip seeding and just sign up for real accounts at `/signup`.)
5. For reminders on a schedule in production, add a Netlify Scheduled
   Function that calls `runReminderSweep()` from `src/lib/reminders.ts` (or
   hits `POST /api/reminders/run` on a cron), since nothing calls it
   automatically yet — see "Not yet built" below.

## Other notes for taking this further

- **Real email**: `src/lib/reminders.ts` has one `console.log` to replace
  with a real provider call (Resend, SendGrid, Postmark, Microsoft 365
  SMTP, etc.).
- **SSL**: `db.ts` turns on SSL automatically for any non-localhost
  connection string, which is what Netlify Database/Neon/Supabase expect.

## Project layout

```
src/
  app/
    login/, signup/              — auth pages
    (app)/layout.tsx              — shared sidebar shell for signed-in pages
    (app)/objectives/             — objectives grid (rollup view)
    (app)/board/[objectiveId]/    — task board for one objective
    api/                          — REST-ish routes the client calls
  components/                     — modals, task rows, status pill/select, etc.
  lib/
    db.ts                         — the whole data layer (Postgres via `pg`)
    auth.ts                       — NextAuth credentials config
    reminders.ts                  — the reminder sweep
    rollup.ts, status.ts, avatar.ts
scripts/
  seed.ts                         — demo data (run against any DATABASE_URL)
  send-reminders.ts               — CLI entry point for `npm run reminders`
netlify.toml                      — Netlify build + Next.js runtime config
vercel.json                       — Vercel Cron Job config (daily reminder sweep)
```

## What's intentionally left as an MVP

- Reminders aren't on an automatic schedule yet — trigger manually (button
  or `npm run reminders`) until you wire up a Netlify Scheduled Function or
  similar cron.
- Real email sending for reminders is stubbed (see above).
- No password reset flow, no team/org management UI, no notifications
  beyond the reminder log.
- Key result progress is a simple current/target number you set directly —
  there's no automatic roll-up from task completion percentages, since
  that mapping is genuinely a product decision (does one done task move
  the needle 25%? Only if all 4 tasks are equal-sized?) worth deciding
  deliberately rather than guessing.
