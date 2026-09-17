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

export type TaskStatus = "NOT_STARTED" | "ON_TRACK" | "AT_RISK" | "DONE";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  managerId: string | null;
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

const globalForDb = globalThis as unknown as {
  __addaptivePool?: Pool;
  __addaptiveSchemaReady?: Promise<void>;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Point it at a Postgres database (Netlify Database, Neon, Supabase, Railway, or a local Postgres) -- see the README."
    );
  }
  const useSsl = !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1");
  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
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
      "passwordHash" TEXT NOT NULL,
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

    -- "Off Track" was removed as a status option. Re-map any existing rows
    -- (tasks, and the vestigial key_results.status column) to At Risk, the
    -- next most severe remaining active status. A plain UPDATE with no
    -- matching rows is a safe no-op on every later startup.
    UPDATE tasks SET status = 'AT_RISK' WHERE status = 'OFF_TRACK';
    UPDATE key_results SET status = 'AT_RISK' WHERE status = 'OFF_TRACK';
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

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  managerId?: string | null;
}): Promise<UserRow> {
  const row: UserRow = {
    id: newId("user"),
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    managerId: data.managerId ?? null,
    createdAt: nowIso(),
  };
  await query(
    'INSERT INTO users (id, name, email, "passwordHash", "managerId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
    [row.id, row.name, row.email, row.passwordHash, row.managerId, row.createdAt]
  );
  return row;
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
}): Promise<TaskRow> {
  const now = nowIso();
  const row: TaskRow = {
    id: newId("task"),
    title: data.title,
    status: data.status || "NOT_STARTED",
    dueDate: new Date(data.dueDate).toISOString(),
    ownerId: data.ownerId,
    keyResultId: data.keyResultId,
    description: data.description ?? null,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await query(
    'INSERT INTO tasks (id, title, status, "dueDate", "ownerId", "keyResultId", description, notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [row.id, row.title, row.status, row.dueDate, row.ownerId, row.keyResultId, row.description, row.notes, row.createdAt, row.updatedAt]
  );
  return row;
}

export async function getTaskById(id: string): Promise<TaskRow | undefined> {
  return queryOne<TaskRow>('SELECT * FROM tasks WHERE id = $1', [id]);
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<TaskRow, "title" | "status" | "dueDate" | "ownerId" | "keyResultId" | "description" | "notes">
  >
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
    'UPDATE tasks SET title = $1, status = $2, "dueDate" = $3, "ownerId" = $4, "keyResultId" = $5, description = $6, notes = $7, "updatedAt" = $8 WHERE id = $9',
    [
      next.title,
      next.status,
      next.dueDate,
      next.ownerId,
      next.keyResultId,
      next.description,
      next.notes,
      next.updatedAt,
      id,
    ]
  );
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

export type TaskWithOwner = TaskRow & { owner: UserRow };
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
          .map((t) => ({ ...t, owner: userById.get(t.ownerId) as UserRow }));
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
        .map((t) => ({ ...t, owner: userById.get(t.ownerId) as UserRow }));
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
  manager: UserRow | null;
  keyResultTitle: string;
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
    const manager = owner.managerId ? (userById.get(owner.managerId) ?? null) : null;
    const kr = krById.get(t.keyResultId);
    const objective = kr ? objById.get(kr.objectiveId) : undefined;
    return {
      ...t,
      owner,
      manager,
      keyResultTitle: kr?.title ?? "",
      objectiveTitle: objective?.title ?? "",
    };
  });
}

/** Wipes all rows (dev/seed convenience) -- keeps the schema. */
export async function resetAllData(): Promise<void> {
  await query("DELETE FROM digest_logs");
  await query("DELETE FROM reminder_logs");
  await query("DELETE FROM tasks");
  await query("DELETE FROM key_results");
  await query("DELETE FROM objectives");
  await query("DELETE FROM users");
}
