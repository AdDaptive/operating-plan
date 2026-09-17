/**
 * Seeds the Postgres database with a demo workspace: a small org chart,
 * three objectives, their key results, and tasks. Safe to re-run — it wipes
 * and reseeds every time.
 *
 *   npm run seed
 */
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";
import { resetAllData, createUser, createObjective, createKeyResult, createTask, closePool } from "../src/lib/db";

async function main() {
  console.log("Seeding…");

  const passwordHash = await bcrypt.hash("password123", 10);

  await resetAllData();

  const jordan = await createUser({ name: "Jordan Lee", email: "jlee@addaptive.com", passwordHash });
  const alex = await createUser({ name: "Alex Chen", email: "achen@addaptive.com", passwordHash, managerId: jordan.id });
  const priya = await createUser({ name: "Priya Nair", email: "pnair@addaptive.com", passwordHash, managerId: jordan.id });
  const sam = await createUser({ name: "Sam Ortiz", email: "sortiz@addaptive.com", passwordHash, managerId: jordan.id });
  const mahoney = await createUser({
    name: "Mahoney",
    email: "mmahoney@addaptive.com",
    passwordHash,
    managerId: jordan.id,
  });

  const today = new Date();
  const iso = (n: number) => addDays(today, n).toISOString();
  const dateOnly = (n: number) => addDays(today, n).toISOString().slice(0, 10);

  // --- Objective 1: Grow Programmatic Revenue ---
  const obj1 = await createObjective({
    title: "Grow Programmatic Revenue",
    team: "Revenue & Partnerships",
    dueDate: dateOnly(75),
  });
  const obj1kr1 = await createKeyResult({
    title: "Increase managed ad spend to $12M",
    status: "ON_TRACK",
    dueDate: dateOnly(60),
    objectiveId: obj1.id,
  });
  const obj1kr2 = await createKeyResult({
    title: "Reduce publisher onboarding time to 3 days",
    status: "AT_RISK",
    dueDate: dateOnly(45),
    objectiveId: obj1.id,
  });

  await createTask({ title: "Renew Trade Desk API contract", ownerId: alex.id, keyResultId: obj1kr1.id, dueDate: iso(3), status: "ON_TRACK" });
  await createTask({ title: "Launch new DSP integration for retail vertical", ownerId: priya.id, keyResultId: obj1kr1.id, dueDate: iso(9), status: "AT_RISK" });
  await createTask({ title: "Migrate legacy campaigns to new bidding engine", ownerId: sam.id, keyResultId: obj1kr1.id, dueDate: iso(-4), status: "OFF_TRACK" });
  await createTask({ title: "QA new floor-price logic", ownerId: mahoney.id, keyResultId: obj1kr1.id, dueDate: iso(14), status: "NOT_STARTED" });
  await createTask({ title: "Automate publisher tax form intake", ownerId: jordan.id, keyResultId: obj1kr2.id, dueDate: iso(1), status: "ON_TRACK" });
  await createTask({ title: "Build self-serve onboarding portal", ownerId: priya.id, keyResultId: obj1kr2.id, dueDate: iso(17), status: "NOT_STARTED" });
  await createTask({ title: "Document onboarding SLA with legal", ownerId: alex.id, keyResultId: obj1kr2.id, dueDate: iso(6), status: "DONE" });

  // --- Objective 2: Improve Platform Reliability ---
  const obj2 = await createObjective({
    title: "Improve Platform Reliability",
    team: "Platform Engineering",
    dueDate: dateOnly(80),
  });
  const obj2kr1 = await createKeyResult({
    title: "Achieve 99.95% uptime",
    status: "AT_RISK",
    dueDate: dateOnly(50),
    objectiveId: obj2.id,
  });
  const obj2kr2 = await createKeyResult({
    title: "Cut P1 incident response time to 15 minutes",
    status: "ON_TRACK",
    dueDate: dateOnly(40),
    objectiveId: obj2.id,
  });

  await createTask({ title: "Add automated failover for bidder cluster", ownerId: sam.id, keyResultId: obj2kr1.id, dueDate: iso(5), status: "ON_TRACK" });
  await createTask({ title: "Move edge nodes to multi-region", ownerId: jordan.id, keyResultId: obj2kr1.id, dueDate: iso(12), status: "NOT_STARTED" });
  await createTask({ title: "Set up automated PagerDuty escalation", ownerId: sam.id, keyResultId: obj2kr2.id, dueDate: iso(8), status: "AT_RISK" });
  await createTask({ title: "Run Q3 incident response tabletop", ownerId: jordan.id, keyResultId: obj2kr2.id, dueDate: iso(20), status: "NOT_STARTED" });

  // --- Objective 3: Expand Data Partnerships ---
  const obj3 = await createObjective({
    title: "Expand Data Partnerships",
    team: "Data & Identity",
    dueDate: dateOnly(90),
  });
  const obj3kr1 = await createKeyResult({
    title: "Sign 5 new data partners",
    status: "ON_TRACK",
    dueDate: dateOnly(70),
    objectiveId: obj3.id,
  });
  const obj3kr2 = await createKeyResult({
    title: "Integrate 2 new identity graphs",
    status: "NOT_STARTED",
    dueDate: dateOnly(65),
    objectiveId: obj3.id,
  });

  await createTask({ title: "Close contract with WeatherSignal", ownerId: priya.id, keyResultId: obj3kr1.id, dueDate: iso(8), status: "ON_TRACK" });
  await createTask({ title: "Scope partnership with UrbanMobility Data", ownerId: alex.id, keyResultId: obj3kr1.id, dueDate: iso(15), status: "NOT_STARTED" });
  await createTask({ title: "Integrate LiveRamp identity graph", ownerId: priya.id, keyResultId: obj3kr2.id, dueDate: iso(10), status: "AT_RISK" });
  await createTask({ title: "Evaluate Neustar identity graph", ownerId: mahoney.id, keyResultId: obj3kr2.id, dueDate: iso(25), status: "NOT_STARTED" });

  console.log("Seed complete.");
  console.log("Demo login: mmahoney@addaptive.com / password123");
  console.log("(Also seeded: jlee@addaptive.com, achen@addaptive.com, pnair@addaptive.com, sortiz@addaptive.com — all password123)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
