#!/usr/bin/env node
/**
 * One-time cleanup for pre-`is_demo` databases that were seeded with the sample
 * dataset before demo/real separation existed. It removes ONLY confirmed demo
 * rows and never touches real candidates, real applications, users, or orgs.
 *
 * A row is treated as demo when it is either:
 *   • attached to a seed job (reference_number DEMO-ELEC-001 / DEMO-CTRL-001), or
 *   • a known seed candidate (seed name AND an @example.com email or 555 phone).
 * Candidates are deleted only when EVERY application they have is demo, so a real
 * applicant who also touched a demo job is preserved.
 *
 * Safe by default: prints a dry-run report and changes nothing unless --apply is
 * passed. With --apply it first writes a timestamped .bak-<epoch> backup.
 *
 * Usage:
 *   node scripts/cleanup-demo-contamination.mjs /path/to/data/jobs.db            # dry run
 *   node scripts/cleanup-demo-contamination.mjs /path/to/data/jobs.db --apply    # apply
 */
import fs from "node:fs";
import Database from "better-sqlite3";

const dbPath = process.argv[2];
const apply = process.argv.includes("--apply");
if (!dbPath) {
  console.error("Usage: node scripts/cleanup-demo-contamination.mjs <jobs.db> [--apply]");
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

const SEED_NAMES = new Set([
  "Ray Delgado", "Nina Alvarez", "Gloria Meyer", "Owen Pratt",
  "Danny Cruz", "Marcus Hill", "Kyle Fenton", "Trevor Blake",
]);
const DEMO_REFS = ["DEMO-ELEC-001", "DEMO-CTRL-001"];
const isSeedName = (n) => SEED_NAMES.has((n || "").trim());
const isExample = (e) => /@example\.com$/i.test(e || "");
const is555 = (p) => /(^|\D)\d{3}[ .-]?555[ .-]?\d{4}(\D|$)/.test(p || "");

if (apply) {
  const bak = `${dbPath}.bak-${Math.floor(Date.now() / 1000)}`;
  fs.copyFileSync(dbPath, bak);
  console.log(`Backup written: ${bak}`);
}

const db = new Database(dbPath);
db.pragma("wal_checkpoint(TRUNCATE)");
const hasTable = (t) =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const ph = (a) => a.map(() => "?").join(",");

let grandRemoved = { jobs: 0, applications: 0, candidates: 0, dependents: 0 };

for (const org of db.prepare("SELECT id, name FROM organizations").all()) {
  const demoJobIds = db
    .prepare(`SELECT id FROM jobs WHERE organization_id=? AND reference_number IN (${ph(DEMO_REFS)})`)
    .all(org.id, ...DEMO_REFS)
    .map((r) => r.id);

  const apps = db
    .prepare("SELECT id, candidate_id, applicant_name, applicant_email, applicant_phone, job_id FROM applications WHERE organization_id=?")
    .all(org.id);
  const demoAppIds = apps
    .filter((a) => demoJobIds.includes(a.job_id) || (isSeedName(a.applicant_name) && (isExample(a.applicant_email) || is555(a.applicant_phone))))
    .map((a) => a.id);
  const demoAppSet = new Set(demoAppIds);

  const cands = db.prepare("SELECT id, name, email, phone FROM candidates WHERE organization_id=?").all(org.id);
  const demoCandIds = cands
    .filter((c) => {
      const sig = isSeedName(c.name) && (isExample(c.email) || is555(c.phone));
      const cApps = db.prepare("SELECT id FROM applications WHERE candidate_id=?").all(c.id);
      const onlyDemo = cApps.length > 0 && cApps.every((a) => demoAppSet.has(a.id));
      return sig || onlyDemo;
    })
    .map((c) => c.id);

  const totalC = cands.length;
  const totalA = apps.length;
  console.log(`\nOrg: ${org.name}`);
  console.log(`  candidates: total=${totalC} demo=${demoCandIds.length} real=${totalC - demoCandIds.length}`);
  console.log(`  applications: total=${totalA} demo=${demoAppIds.length} real=${totalA - demoAppIds.length}`);
  console.log(`  demo jobs: ${demoJobIds.length}`);

  if (!apply) continue;
  if (!demoAppIds.length && !demoCandIds.length && !demoJobIds.length) continue;

  const tx = db.transaction(() => {
    let dep = 0;
    if (demoAppIds.length) {
      if (hasTable("screen_submissions")) dep += db.prepare(`DELETE FROM screen_submissions WHERE application_id IN (${ph(demoAppIds)})`).run(...demoAppIds).changes;
      dep += db.prepare(`DELETE FROM candidate_events WHERE application_id IN (${ph(demoAppIds)})`).run(...demoAppIds).changes;
    }
    if (demoCandIds.length) {
      dep += db.prepare(`DELETE FROM candidate_events WHERE candidate_id IN (${ph(demoCandIds)})`).run(...demoCandIds).changes;
      for (const t of ["candidate_assignments", "interviews", "care_tasks"]) {
        if (hasTable(t)) dep += db.prepare(`DELETE FROM ${t} WHERE candidate_id IN (${ph(demoCandIds)})`).run(...demoCandIds).changes;
      }
    }
    if (demoAppIds.length) grandRemoved.applications += db.prepare(`DELETE FROM applications WHERE id IN (${ph(demoAppIds)})`).run(...demoAppIds).changes;
    if (demoCandIds.length) grandRemoved.candidates += db.prepare(`DELETE FROM candidates WHERE id IN (${ph(demoCandIds)})`).run(...demoCandIds).changes;
    if (demoJobIds.length) grandRemoved.jobs += db.prepare(`DELETE FROM jobs WHERE id IN (${ph(demoJobIds)})`).run(...demoJobIds).changes;
    grandRemoved.dependents += dep;
    // If the org has an is_demo flag (post-migration schema) and now has no data, clear it.
    const orgCols = db.prepare("PRAGMA table_info(organizations)").all().map((c) => c.name);
    if (orgCols.includes("is_demo")) db.prepare("UPDATE organizations SET is_demo=0 WHERE id=?").run(org.id);
  });
  tx();
}

if (apply) {
  db.pragma("wal_checkpoint(TRUNCATE)");
  const integrity = db.pragma("integrity_check")[0].integrity_check;
  const fkIssues = db.pragma("foreign_key_check").length;
  console.log(`\nRemoved: ${JSON.stringify(grandRemoved)}`);
  console.log(`Integrity: ${integrity} · FK issues: ${fkIssues}`);
  console.log("Done. Restart the app so it reopens the cleaned database.");
} else {
  console.log("\nDry run — nothing changed. Re-run with --apply to remove the demo rows above.");
}
db.close();
