/**
 * The whole data layer, backed by Postgres via `pg`.
 *
 * (This started on Node's built-in `node:sqlite` with a local file, because
 * the sandbox this app was first built in blocked network access to
 * binaries.prisma.sh. That's fine for poking at the app locally, but it
 * can't deploy to Netlify or any other serverless host: functions there
 * have no persistent, writable disk between invocations. Postgres works
 * everywhere -- locally, on Netlify Database, Neon, Supabase, Railway,
 * or anywhere else -- so that's what this now talks to. Every other file
 * in the app only calls the functions exported below, so this was a
 * contained swap.)
 */
import { Pool } from "pg";
import crypto from "node:crypto";
import { computeKeyResultStatus } from "@/lib/rollup";

export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_TRACK" | "AT_RISK" | "DONE";

/**
 * Eisenhower-style urgency/importance classification, set (optionally) at
 * task creation and editable afterward like every other task field. Null
 * for a task nobody has classified -- there is deliberately no fourth
 * "not urgent / not important" option, matching what was asked for.
 */
export type TaskPriority = "URGENT_IMPORTANT" | "URGENT_NOT_IMPORTANT" | "IMPORTANT_NOT_URGENT";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  /** Null for an invited-but-not-yet-activated account -- they can't sign in until they set one via /activate. */
  passwordHash: string | null;
  managerId: string | null;
  /** Admins can invite new accounts (see createInvitedUser) and set isAdmin on invite. */
  isAdmin: boolean;
  /** Set while an invite is pending; cleared once the person sets their password. */
  inviteToken: string | null;
  inviteTokenExpiresAt: string | null;
  createdAt: string;
};

export type ObjectiveRow = {
  id: string;
  title: string;
  team: string | null;
  dueDate: string | null;
  createdAt: string;
};

export type KeyResultRow = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  ownerId: string | null;
  objectiveId: string;
  createdAt: string;
};

export type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  ownerId: string;
  /** Optional second owner ("delegate to a sub-owner") -- the task shows up under this
   * person's tasks (Home dashboard, daily digest) exactly like it does for `ownerId`. */
  subOwnerId: string | null;
  /** Eisenhower urgency/importance classification -- see TaskPriority. Null = unclassified. */
  priority: TaskPriority | null;
  keyResultId: string;
  /** Longer description of what the task actually involves. */
  description: string | null;
  /** Freeform status updates the owner keeps for themselves/others -- distinct from `description`. */
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReminderLogRow = {
  id: string;
  taskId: string;
  recipientRole: string;
  recipientEmail: string;
  daysBeforeDue: number;
  sentAt: string;
};

export type DigestLogRow = {
  id: string;
  recipientEmail: string;
  channel: string;
  sentAt: string;
};

/**
 * The task fields this app tracks a change history for -- deliberately
 * just these five (status, due date, sub-owner, details, notes), matching
 * exactly what was asked for. Title, owner, priority, and which key
 * result a task belongs to are NOT tracked here.
 */
export type TaskActivityField = "status" | "dueDate" | "subOwnerId" | "description" | "notes";

export type TaskActivityRow = {
  id: string;
  taskId: string;
  field: TaskActivityField;
  oldValue: string | null;
  newValue: string | null;
  /** Who made the change (the signed-in session user's id). Null for a system-driven update with no actor. */
  changedById: string | null;
  changedAt: string;
};

const globalForDb = globalThis as unknown as {
  __addaptivePool?: Pool;
  __addaptiveSchemaReady?: Promise<void>;
};

function createPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a Postgres database (Netlify Database, Neon, Supabase, Railway, or a local Postgres) -- see the README."
    );
  }
  const isRemote = !raw.includes("localhost") && !raw.includes("127.0.0.1");
  // pg-connection-string v2 treats sslmode=require as verify-full, which
  // rejects Amazon RDS certs (signed by Amazon's own CA, not in Node's bundle).
  // We strip sslmode from the URL and set ssl explicitly: this still enforces
  // an encrypted connection but skips certificate chain verification.
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  return new Pool({
    connectionString: url.toString(),
    // false for localhost, encrypted-but-no-cert-verify for remote (RDS etc.)
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });
}

/**
 * Lazy on purpose: creating the pool eagerly at module load would make
 * `DATABASE_URL` required just to *import* this file. Next.js loads every
 * route module to analyze it during `next build` -- including ones that
 * never run a query at build time -- so an eager, throwing constructor here
 * would fail the build on any host where `DATABASE_URL` isn't set as a
 * build-time variable (Netlify included). Deferring creation until the
 * first real query means the build only needs `DATABASE_URL` at runtime.
 */
function getPool(): Pool {
  if (!globalForDb.__addaptivePool) {
    globalForDb.__addaptivePool = createPool();
  }
  return globalForDb.__addaptivePool;
}

async function ensureSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT,
      "managerId" TEXT REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS objectives (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      team TEXT,
      "dueDate" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS key_results (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      "dueDate" TEXT,
      "ownerId" TEXT REFERENCES users(id),
      "objectiveId" TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED',
      "dueDate" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL REFERENCES users(id),
      "subOwnerId" TEXT REFERENCES users(id),
      priority TEXT,
      "keyResultId" TEXT NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
      description TEXT,
      notes TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_logs (
      id TEXT PRIMARY KEY,
      "taskId" TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      "recipientRole" TEXT NOT NULL,
      "recipientEmail" TEXT NOT NULL,
      "daysBeforeDue" INTEGER NOT NULL,
      "sentAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digest_logs (
      id TEXT PRIMARY KEY,
      "recipientEmail" TEXT NOT NULL,
      channel TEXT NOT NULL,
      "sentAt" TEXT NOT NULL
    );

    -- Movement/change log: one row per tracked field that actually changed
    -- value on a task edit (status, dueDate, subOwnerId, description,
    -- notes -- see TRACKED_ACTIVITY_FIELDS below). Cascades away with its
    -- task, same as reminder_logs.
    CREATE TABLE IF NOT EXISTS task_activity (
      id TEXT PRIMARY KEY,
      "taskId" TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      "oldValue" TEXT,
      "newValue" TEXT,
      "changedById" TEXT REFERENCES users(id),
      "changedAt" TEXT NOT NULL
    );

    -- "Create Meeting Agenda" snapshots of who's attending and when -- the
    -- actual agenda content (which key results/tasks show up) is always
    -- computed live from current data when the page is viewed or the email
    -- is sent (see buildMeetingAgendaSections in src/lib/meetingAgenda.ts),
    -- not frozen here; this row only remembers the attendee list and date
    -- so the emailed link keeps working. No FK on the ids inside
    -- "attendeeIds" (Postgres arrays can't reference a column) -- a stale
    -- id is simply skipped wherever attendees are looked back up.
    CREATE TABLE IF NOT EXISTS meeting_agendas (
      id TEXT PRIMARY KEY,
      "meetingDate" TEXT NOT NULL,
      "attendeeIds" TEXT[] NOT NULL,
      "createdById" TEXT REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TEXT NOT NULL
    );

    -- Migration from the original quarter / current-target-unit schema to
    -- due dates on objectives and a manual status + due date on key
    -- results. IF NOT EXISTS / IF EXISTS make this safe to run every time,
    -- including against a database that already has the new schema.
    ALTER TABLE objectives ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
    ALTER TABLE objectives DROP COLUMN IF EXISTS quarter;

    ALTER TABLE key_results ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'NOT_STARTED';
    ALTER TABLE key_results ADD COLUMN IF NOT EXISTS "dueDate" TEXT;
    ALTER TABLE key_results DROP COLUMN IF EXISTS unit;
    ALTER TABLE key_results DROP COLUMN IF EXISTS "targetValue";
    ALTER TABLE key_results DROP COLUMN IF EXISTS "currentValue";

    -- Key results get an owner too (nullable -- existing key results
    -- predate this and won't have one until someone sets it).
    ALTER TABLE key_results ADD COLUMN IF NOT EXISTS "ownerId" TEXT REFERENCES users(id);

    -- Tasks get a longer description plus a separate freeform notes field
    -- the owner uses for their own status updates. Both nullable/additive.
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;

    -- Delegate-to-a-sub-owner (a second, optional owner the task also shows
    -- up under) and an optional Eisenhower urgency/importance classification.
    -- Both nullable/additive -- existing tasks simply have neither set.
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "subOwnerId" TEXT REFERENCES users(id);
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT;

    -- "Off Track" was removed as a status option. Re-map any existing rows
    -- (tasks, and the vestigial key_results.status column) to At Risk, the
    -- next most severe remaining active status. A plain UPDATE with no
    -- matching rows is a safe no-op on every later startup.
    UPDATE tasks SET status = 'AT_RISK' WHERE status = 'OFF_TRACK';
    UPDATE key_results SET status = 'AT_RISK' WHERE status = 'OFF_TRACK';

    -- Restricted, admin-invited accounts: a person can't sign in until
    -- passwordHash is set, so it has to allow NULL (existing rows already
    -- have one and are unaffected). isAdmin gates who can invite new
    -- accounts; inviteToken/inviteTokenExpiresAt back the /activate flow
    -- (cleared once a password is set -- see setUserPassword below). Also
    -- reused for "forgot password": regenerateInviteToken issues a fresh
    -- one for an already-active account exactly the same way, and
    -- setUserPassword doesn't care whether this is a first-time claim or
    -- a reset -- it just sets the password and clears the token either way.
    ALTER TABLE users ALTER COLUMN "passwordHash" DROP NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "inviteTokenExpiresAt" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS users_invite_token_idx ON users ("inviteToken") WHERE "inviteToken" IS NOT NULL;

    -- Bootstrap admin access: always grant it to the account that asked
    -- for this feature, and as a fallback (e.g. on a fresh/seeded
    -- database that never had that exact email) make sure there's always
    -- at least one admin -- the earliest-created account -- so nobody
    -- can ever end up with zero people able to invite anyone else.
    UPDATE users SET "isAdmin" = TRUE WHERE email = 'mmahoney@addaptive.com';
    UPDATE users SET "isAdmin" = TRUE
      WHERE id = (SELECT id FROM users ORDER BY "createdAt" ASC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM users WHERE "isAdmin" = TRUE);
  `);
}

function schemaReady(): Promise<void> {
  if (!globalForDb.__addaptiveSchemaReady) {
    globalForDb.__addaptiveSchemaReady = ensureSchema();
  }
  return globalForDb.__addaptiveSchemaReady;
}

/** Every query routes through here so the schema is guaranteed to exist first. */
async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  await schemaReady();
  const result = await getPool().query(text, params as unknown[]);
  return result.rows as T[];
}

async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Call once when a standalone script (seed, reminders) is done, so the process can exit. */
export async function closePool(): Promise<void> {
  if (globalForDb.__addaptivePool) {
    await globalForDb.__addaptivePool.end();
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * `{ ...existing, ...patch }` overwrites a field with `undefined` whenever
 * `patch` explicitly carries that key set to `undefined` (which every PATCH
 * route does, since it destructures all possible body fields whether or not
 * the caller sent them). This merges instead, keeping `existing`'s value for
 * any patch field that is `undefined`.
 */
function mergeDefined<T extends object>(existing: T, patch: Partial<T>): T {
  const next = { ...existing };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) {
      next[key] = value as T[keyof T];
    }
  }
  return next;
}

// ---------- Users ----------

export async function listUsers(): Promise<UserRow[]> {
  return query<UserRow>('SELECT * FROM users ORDER BY name ASC');
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
}

async function insertUser(data: {
  name: string;
  email: string;
  passwordHash: string | null;
  managerId?: string | null;
  isAdmin?: boolean;
  inviteToken?: string | null;
  inviteTokenExpiresAt?: string | null;
}): Promise<UserRow> {
  const row: UserRow = {
    id: newId("user"),
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    managerId: data.managerId ?? null,
    isAdmin: data.isAdmin ?? false,
    inviteToken: data.inviteToken ?? null,
    inviteTokenExpiresAt: data.inviteTokenExpiresAt ?? null,
    createdAt: nowIso(),
  };
  await query(
    `INSERT INTO users
      (id, name, email, "passwordHash", "managerId", "isAdmin", "inviteToken", "inviteTokenExpiresAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      row.id,
      row.name,
      row.email,
      row.passwordHash,
      row.managerId,
      row.isAdmin,
      row.inviteToken,
      row.inviteTokenExpiresAt,
      row.createdAt,
    ]
  );
  return row;
}

/** Direct-password account creation -- used by the seed script (and previously /api/signup, now removed). */
export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  managerId?: string | null;
  isAdmin?: boolean;
}): Promise<UserRow> {
  return insertUser(data);
}

const INVITE_TOKEN_TTL_DAYS = 7;

function inviteTokenExpiry(): string {
  return new Date(Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Admin-only account creation (see POST /api/admin/invite): no password
 * yet -- the account sits pending until the invited person opens their
 * /activate link and sets one. This is how "only allow those I say are
 * ok" is enforced now that public /signup is gone: an account can only
 * come into existence via this function, called by an existing admin.
 */
export async function createInvitedUser(data: {
  name: string;
  email: string;
  managerId?: string | null;
  isAdmin?: boolean;
}): Promise<UserRow> {
  return insertUser({
    ...data,
    passwordHash: null,
    inviteToken: crypto.randomBytes(32).toString("hex"),
    inviteTokenExpiresAt: inviteTokenExpiry(),
  });
}

export async function getUserByInviteToken(token: string): Promise<UserRow | undefined> {
  return queryOne<UserRow>('SELECT * FROM users WHERE "inviteToken" = $1', [token]);
}

/**
 * Sets a person's password and clears their pending token -- used both to
 * claim a first-time invite (POST /api/set-password from /activate) and
 * to complete a "forgot password" reset (same route, from /reset-password).
 * Both flows end up here because the two are mechanically identical: a
 * valid, unexpired token authorizes setting a new password, regardless of
 * whether the account already had one.
 */
export async function setUserPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    'UPDATE users SET "passwordHash" = $1, "inviteToken" = NULL, "inviteTokenExpiresAt" = NULL WHERE id = $2',
    [passwordHash, userId]
  );
}

/** Issues a fresh invite token/expiry for the "Resend invite" action on a still-pending account. */
export async function regenerateInviteToken(
  userId: string
): Promise<{ inviteToken: string; inviteTokenExpiresAt: string }> {
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenExpiresAt = inviteTokenExpiry();
  await query('UPDATE users SET "inviteToken" = $1, "inviteTokenExpiresAt" = $2 WHERE id = $3', [
    inviteToken,
    inviteTokenExpiresAt,
    userId,
  ]);
  return { inviteToken, inviteTokenExpiresAt };
}

// ---------- Objectives ----------

export async function listObjectives(): Promise<ObjectiveRow[]> {
  return query<ObjectiveRow>('SELECT * FROM objectives ORDER BY "createdAt" ASC');
}

export async function getObjectiveById(id: string): Promise<ObjectiveRow | undefined> {
  return queryOne<ObjectiveRow>('SELECT * FROM objectives WHERE id = $1', [id]);
}

export async function createObjective(data: {
  title: string;
  team?: string | null;
  dueDate?: string | null;
}): Promise<ObjectiveRow> {
  const row: ObjectiveRow = {
    id: newId("obj"),
    title: data.title,
    team: data.team ?? null,
    dueDate: data.dueDate ?? null,
    createdAt: nowIso(),
  };
  await query(
    'INSERT INTO objectives (id, title, team, "dueDate", "createdAt") VALUES ($1, $2, $3, $4, $5)',
    [row.id, row.title, row.team, row.dueDate, row.createdAt]
  );
  return row;
}

export async function updateObjective(
  id: string,
  patch: Partial<Pick<ObjectiveRow, "title" | "team" | "dueDate">>
): Promise<ObjectiveRow | undefined> {
  const existing = await getObjectiveById(id);
  if (!existing) return undefined;
  const next = mergeDefined<ObjectiveRow>(existing, patch);
  await query('UPDATE objectives SET title = $1, team = $2, "dueDate" = $3 WHERE id = $4', [
    next.title,
    next.team,
    next.dueDate,
    id,
  ]);
  return next;
}

export async function deleteObjective(id: string): Promise<void> {
  await query('DELETE FROM objectives WHERE id = $1', [id]);
}

// ---------- Key results ----------

export async function listKeyResultsByObjective(objectiveId: string): Promise<KeyResultRow[]> {
  return query<KeyResultRow>(
    'SELECT * FROM key_results WHERE "objectiveId" = $1 ORDER BY "createdAt" ASC',
    [objectiveId]
  );
}

export async function getKeyResultById(id: string): Promise<KeyResultRow | undefined> {
  return queryOne<KeyResultRow>('SELECT * FROM key_results WHERE id = $1', [id]);
}

export async function createKeyResult(data: {
  title: string;
  dueDate?: string | null;
  ownerId?: string | null;
  objectiveId: string;
}): Promise<KeyResultRow> {
  const row: KeyResultRow = {
    id: newId("kr"),
    title: data.title,
    // Vestigial: a key result's real status is derived from its tasks
    // (computeKeyResultStatus) and overridden whenever it's read via
    // getObjectivesFull/getObjectiveFull. This column is never consulted
    // for that, so what's stored here doesn't matter -- kept only because
    // the column is still NOT NULL.
    status: "NOT_STARTED",
    dueDate: data.dueDate ?? null,
    ownerId: data.ownerId ?? null,
    objectiveId: data.objectiveId,
    createdAt: nowIso(),
  };
  await query(
    'INSERT INTO key_results (id, title, status, "dueDate", "ownerId", "objectiveId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [row.id, row.title, row.status, row.dueDate, row.ownerId, row.objectiveId, row.createdAt]
  );
  return row;
}

export async function updateKeyResult(
  id: string,
  patch: Partial<Pick<KeyResultRow, "title" | "dueDate" | "ownerId">>
): Promise<KeyResultRow | undefined> {
  const existing = await getKeyResultById(id);
  if (!existing) return undefined;
  const next = mergeDefined<KeyResultRow>(existing, patch);
  await query(
    'UPDATE key_results SET title = $1, "dueDate" = $2, "ownerId" = $3 WHERE id = $4',
    [next.title, next.dueDate, next.ownerId, id]
  );
  return next;
}

export async function deleteKeyResult(id: string): Promise<void> {
  await query('DELETE FROM key_results WHERE id = $1', [id]);
}

// ---------- Tasks ----------

export async function createTask(data: {
  title: string;
  status?: TaskStatus;
  dueDate: string;
  ownerId: string;
  keyResultId: string;
  description?: string | null;
  notes?: string | null;
  /** Optional second owner ("delegate to a sub-owner"). */
  subOwnerId?: string | null;
  /** Optional Eisenhower urgency/importance classification. */
  priority?: TaskPriority | null;
}): Promise<TaskRow> {
  const now = nowIso();
  const row: TaskRow = {
    id: newId("task"),
    title: data.title,
    status: data.status || "NOT_STARTED",
    dueDate: new Date(data.dueDate).toISOString(),
    ownerId: data.ownerId,
    subOwnerId: data.subOwnerId ?? null,
    priority: data.priority ?? null,
    keyResultId: data.keyResultId,
    description: data.description ?? null,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await query(
    'INSERT INTO tasks (id, title, status, "dueDate", "ownerId", "subOwnerId", priority, "keyResultId", description, notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
    [row.id, row.title, row.status, row.dueDate, row.ownerId, row.subOwnerId, row.priority, row.keyResultId, row.description, row.notes, row.createdAt, row.updatedAt]
  );
  return row;
}

export async function getTaskById(id: string): Promise<TaskRow | undefined> {
  return queryOne<TaskRow>('SELECT * FROM tasks WHERE id = $1', [id]);
}

/** The five fields updateTask diffs on every edit and logs to task_activity when they actually change. */
const TRACKED_ACTIVITY_FIELDS: TaskActivityField[] = ["status", "dueDate", "subOwnerId", "description", "notes"];

async function logTaskFieldChange(
  taskId: string,
  field: TaskActivityField,
  oldValue: string | null,
  newValue: string | null,
  changedById: string | null,
  changedAt: string
): Promise<void> {
  await query(
    'INSERT INTO task_activity (id, "taskId", field, "oldValue", "newValue", "changedById", "changedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [newId("act"), taskId, field, oldValue, newValue, changedById, changedAt]
  );
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<
      TaskRow,
      | "title"
      | "status"
      | "dueDate"
      | "ownerId"
      | "subOwnerId"
      | "priority"
      | "keyResultId"
      | "description"
      | "notes"
    >
  >,
  /** Who made this edit (the signed-in session user's id), for the movement log below. Null/omitted for a system-driven update with no actor. */
  changedById?: string | null
): Promise<TaskRow | undefined> {
  const existing = await getTaskById(id);
  if (!existing) return undefined;
  const merged = mergeDefined<TaskRow>(existing, patch);
  const next = {
    ...merged,
    dueDate: patch.dueDate ? new Date(patch.dueDate).toISOString() : existing.dueDate,
    updatedAt: nowIso(),
  };
  await query(
    'UPDATE tasks SET title = $1, status = $2, "dueDate" = $3, "ownerId" = $4, "subOwnerId" = $5, priority = $6, "keyResultId" = $7, description = $8, notes = $9, "updatedAt" = $10 WHERE id = $11',
    [
      next.title,
      next.status,
      next.dueDate,
      next.ownerId,
      next.subOwnerId,
      next.priority,
      next.keyResultId,
      next.description,
      next.notes,
      next.updatedAt,
      id,
    ]
  );

  // Movement log: one row per tracked field whose value actually changed
  // (comparing the final written value against what was there before --
  // not just "was this field present in the patch," since saving the form
  // with no real change to a field shouldn't create a no-op log entry).
  for (const field of TRACKED_ACTIVITY_FIELDS) {
    if (existing[field] !== next[field]) {
      await logTaskFieldChange(id, field, existing[field], next[field], changedById ?? null, next.updatedAt);
    }
  }

  return next;
}

export async function deleteTask(id: string): Promise<void> {
  await query('DELETE FROM tasks WHERE id = $1', [id]);
}

// ---------- Reminder logs ----------

export async function findReminderSentToday(
  taskId: string,
  daysBeforeDue: number
): Promise<ReminderLogRow | undefined> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return queryOne<ReminderLogRow>(
    'SELECT * FROM reminder_logs WHERE "taskId" = $1 AND "daysBeforeDue" = $2 AND "sentAt" >= $3 ORDER BY "sentAt" DESC LIMIT 1',
    [taskId, daysBeforeDue, startOfToday.toISOString()]
  );
}

export async function createReminderLog(data: {
  taskId: string;
  recipientRole: string;
  recipientEmail: string;
  daysBeforeDue: number;
}): Promise<ReminderLogRow> {
  const row: ReminderLogRow = {
    id: newId("rem"),
    taskId: data.taskId,
    recipientRole: data.recipientRole,
    recipientEmail: data.recipientEmail,
    daysBeforeDue: data.daysBeforeDue,
    sentAt: nowIso(),
  };
  await query(
    'INSERT INTO reminder_logs (id, "taskId", "recipientRole", "recipientEmail", "daysBeforeDue", "sentAt") VALUES ($1, $2, $3, $4, $5, $6)',
    [row.id, row.taskId, row.recipientRole, row.recipientEmail, row.daysBeforeDue, row.sentAt]
  );
  return row;
}

// ---------- Digest logs ----------

/** Has this recipient already gotten a digest on this channel today? Keeps
 * the daily sweep idempotent if it's triggered more than once (manual
 * button + cron both firing, a retried cron invocation, etc). */
export async function findDigestSentToday(
  recipientEmail: string,
  channel: string
): Promise<DigestLogRow | undefined> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return queryOne<DigestLogRow>(
    'SELECT * FROM digest_logs WHERE "recipientEmail" = $1 AND channel = $2 AND "sentAt" >= $3 ORDER BY "sentAt" DESC LIMIT 1',
    [recipientEmail, channel, startOfToday.toISOString()]
  );
}

export async function createDigestLog(data: {
  recipientEmail: string;
  channel: string;
}): Promise<DigestLogRow> {
  const row: DigestLogRow = {
    id: newId("dig"),
    recipientEmail: data.recipientEmail,
    channel: data.channel,
    sentAt: nowIso(),
  };
  await query(
    'INSERT INTO digest_logs (id, "recipientEmail", channel, "sentAt") VALUES ($1, $2, $3, $4)',
    [row.id, row.recipientEmail, row.channel, row.sentAt]
  );
  return row;
}

// ---------- Composite reads (the "includes" Prisma would have done) ----------

export type TaskWithOwner = TaskRow & { owner: UserRow; subOwner: UserRow | null };
export type KeyResultWithTasks = KeyResultRow & { owner: UserRow | null; tasks: TaskWithOwner[] };
export type ObjectiveFull = ObjectiveRow & { keyResults: KeyResultWithTasks[] };

export async function getObjectivesFull(): Promise<ObjectiveFull[]> {
  const [objectives, keyResults, tasks, users] = await Promise.all([
    listObjectives(),
    query<KeyResultRow>('SELECT * FROM key_results ORDER BY "createdAt" ASC'),
    query<TaskRow>('SELECT * FROM tasks ORDER BY "dueDate" ASC'),
    listUsers(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  return objectives.map((o) => ({
    ...o,
    keyResults: keyResults
      .filter((kr) => kr.objectiveId === o.id)
      .map((kr) => {
        const krTasks = tasks
          .filter((t) => t.keyResultId === kr.id)
          .map((t) => ({
            ...t,
            owner: userById.get(t.ownerId) as UserRow,
            subOwner: t.subOwnerId ? (userById.get(t.subOwnerId) ?? null) : null,
          }));
        return {
          ...kr,
          status: computeKeyResultStatus(krTasks),
          owner: kr.ownerId ? (userById.get(kr.ownerId) ?? null) : null,
          tasks: krTasks,
        };
      }),
  }));
}

export async function getObjectiveFull(id: string): Promise<ObjectiveFull | null> {
  const objective = await getObjectiveById(id);
  if (!objective) return null;
  const [keyResults, users] = await Promise.all([listKeyResultsByObjective(id), listUsers()]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const krIds = keyResults.map((kr) => kr.id);
  const tasks = krIds.length
    ? await query<TaskRow>(
        `SELECT * FROM tasks WHERE "keyResultId" = ANY($1::text[]) ORDER BY "dueDate" ASC`,
        [krIds]
      )
    : [];

  return {
    ...objective,
    keyResults: keyResults.map((kr) => {
      const krTasks = tasks
        .filter((t) => t.keyResultId === kr.id)
        .map((t) => ({
          ...t,
          owner: userById.get(t.ownerId) as UserRow,
          subOwner: t.subOwnerId ? (userById.get(t.subOwnerId) ?? null) : null,
        }));
      return {
        ...kr,
        status: computeKeyResultStatus(krTasks),
        owner: kr.ownerId ? (userById.get(kr.ownerId) ?? null) : null,
        tasks: krTasks,
      };
    }),
  };
}

export type TaskForReminder = TaskRow & {
  owner: UserRow;
  subOwner: UserRow | null;
  manager: UserRow | null;
  keyResultTitle: string;
  objectiveId: string;
  objectiveTitle: string;
};

/** All not-done tasks, joined with their owner, the owner's manager, and their objective. */
export async function listActiveTasksForReminders(): Promise<TaskForReminder[]> {
  const [tasks, users, keyResults, objectives] = await Promise.all([
    query<TaskRow>("SELECT * FROM tasks WHERE status != 'DONE'"),
    listUsers(),
    query<KeyResultRow>('SELECT * FROM key_results'),
    listObjectives(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const krById = new Map(keyResults.map((kr) => [kr.id, kr]));
  const objById = new Map(objectives.map((o) => [o.id, o]));

  return tasks.map((t) => {
    const owner = userById.get(t.ownerId) as UserRow;
    const subOwner = t.subOwnerId ? (userById.get(t.subOwnerId) ?? null) : null;
    const manager = owner.managerId ? (userById.get(owner.managerId) ?? null) : null;
    const kr = krById.get(t.keyResultId);
    const objective = kr ? objById.get(kr.objectiveId) : undefined;
    return {
      ...t,
      owner,
      subOwner,
      manager,
      keyResultTitle: kr?.title ?? "",
      objectiveId: objective?.id ?? "",
      objectiveTitle: objective?.title ?? "",
    };
  });
}

// ---------- Task activity (movement log) ----------

export type TaskActivityWithUser = TaskActivityRow & { changedBy: UserRow | null };

/** One task's full change history, newest first. */
export async function listTaskActivityForTask(taskId: string): Promise<TaskActivityWithUser[]> {
  const [rows, users] = await Promise.all([
    query<TaskActivityRow>('SELECT * FROM task_activity WHERE "taskId" = $1 ORDER BY "changedAt" DESC', [taskId]),
    listUsers(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, changedBy: r.changedById ? (userById.get(r.changedById) ?? null) : null }));
}

export type TaskActivityFull = TaskActivityRow & {
  changedBy: UserRow | null;
  taskTitle: string;
  keyResultTitle: string;
  objectiveId: string;
  objectiveTitle: string;
};

/** Every task's change history org-wide, newest first, capped at `limit` -- backs the org-wide Activity page. */
export async function listRecentTaskActivity(limit = 200): Promise<TaskActivityFull[]> {
  const [activity, tasks, keyResults, objectives, users] = await Promise.all([
    query<TaskActivityRow>('SELECT * FROM task_activity ORDER BY "changedAt" DESC LIMIT $1', [limit]),
    query<TaskRow>("SELECT * FROM tasks"),
    query<KeyResultRow>("SELECT * FROM key_results"),
    listObjectives(),
    listUsers(),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const krById = new Map(keyResults.map((kr) => [kr.id, kr]));
  const objById = new Map(objectives.map((o) => [o.id, o]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return activity.map((a) => {
    const task = taskById.get(a.taskId);
    const kr = task ? krById.get(task.keyResultId) : undefined;
    const objective = kr ? objById.get(kr.objectiveId) : undefined;
    return {
      ...a,
      changedBy: a.changedById ? (userById.get(a.changedById) ?? null) : null,
      taskTitle: task?.title ?? "(deleted task)",
      keyResultTitle: kr?.title ?? "",
      objectiveId: objective?.id ?? "",
      objectiveTitle: objective?.title ?? "",
    };
  });
}

export type TaskWithActivityStatus = TaskRow & {
  owner: UserRow | null;
  subOwner: UserRow | null;
  keyResultTitle: string;
  objectiveId: string;
  objectiveTitle: string;
  /** Most recent task_activity."changedAt" for this task, or null if it has never had a tracked field change. */
  lastChangedAt: string | null;
};

/**
 * Every task (any status, org-wide), each paired with the timestamp of its
 * most recent tracked change (status/due date/sub-owner/details/notes) --
 * or null if it has never had one logged. Backs the "All tasks" freshness
 * list on the /activity page (see activityLabel.ts's `activityFreshness`
 * for how that timestamp turns into green/yellow/red).
 */
export async function listTasksWithActivityStatus(): Promise<TaskWithActivityStatus[]> {
  const [tasks, lastChanged, users, keyResults, objectives] = await Promise.all([
    query<TaskRow>("SELECT * FROM tasks"),
    query<{ taskId: string; lastChangedAt: string }>(
      'SELECT "taskId", MAX("changedAt") AS "lastChangedAt" FROM task_activity GROUP BY "taskId"'
    ),
    listUsers(),
    query<KeyResultRow>("SELECT * FROM key_results"),
    listObjectives(),
  ]);
  const lastChangedByTaskId = new Map(lastChanged.map((r) => [r.taskId, r.lastChangedAt]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const krById = new Map(keyResults.map((kr) => [kr.id, kr]));
  const objById = new Map(objectives.map((o) => [o.id, o]));

  return tasks.map((t) => {
    const kr = krById.get(t.keyResultId);
    const objective = kr ? objById.get(kr.objectiveId) : undefined;
    return {
      ...t,
      owner: userById.get(t.ownerId) ?? null,
      subOwner: t.subOwnerId ? (userById.get(t.subOwnerId) ?? null) : null,
      keyResultTitle: kr?.title ?? "",
      objectiveId: objective?.id ?? "",
      objectiveTitle: objective?.title ?? "",
      lastChangedAt: lastChangedByTaskId.get(t.id) ?? null,
    };
  });
}

// ---------- Meeting agendas ----------

export type MeetingAgendaRow = {
  id: string;
  meetingDate: string;
  /** User ids selected as attendees at creation time. See the table's own comment in ensureSchema for why there's no FK here. */
  attendeeIds: string[];
  createdById: string | null;
  createdAt: string;
};

export async function createMeetingAgenda(data: {
  meetingDate: string;
  attendeeIds: string[];
  createdById: string | null;
}): Promise<MeetingAgendaRow> {
  const row: MeetingAgendaRow = {
    id: newId("agenda"),
    meetingDate: data.meetingDate,
    attendeeIds: data.attendeeIds,
    createdById: data.createdById,
    createdAt: new Date().toISOString(),
  };
  await query(
    'INSERT INTO meeting_agendas (id, "meetingDate", "attendeeIds", "createdById", "createdAt") VALUES ($1, $2, $3, $4, $5)',
    [row.id, row.meetingDate, row.attendeeIds, row.createdById, row.createdAt]
  );
  return row;
}

export async function getMeetingAgendaById(id: string): Promise<MeetingAgendaRow | undefined> {
  return queryOne<MeetingAgendaRow>("SELECT * FROM meeting_agendas WHERE id = $1", [id]);
}

/** Wipes all rows (dev/seed convenience) -- keeps the schema. */
export async function resetAllData(): Promise<void> {
  await query("DELETE FROM digest_logs");
  await query("DELETE FROM reminder_logs");
  await query("DELETE FROM task_activity");
  await query("DELETE FROM meeting_agendas");
  await query("DELETE FROM tasks");
  await query("DELETE FROM key_results");
  await query("DELETE FROM objectives");
  await query("DELETE FROM users");
}
