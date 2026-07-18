#!/usr/bin/env node
/**
 * Seed a minimal org + published job into a SQLite DB so the smoke tests can
 * exercise the public careers/job/apply surfaces. Intended ONLY for the
 * ephemeral throwaway database the deploy verification boots — never the live DB.
 *
 *   DB_PATH=/tmp/smoke/data/jobs.db node scripts/seed-smoke.mjs
 *
 * Prints the org/job slugs for the smoke runner. Requires the schema to already
 * exist (the server creates it on first DB access — hit any route once first).
 */
import { createRequire } from "module";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = resolve(process.env.DB_PATH ?? join(repoRoot, "data", "jobs.db"));

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require(join(repoRoot, "node_modules", "better-sqlite3"));
}

const db = new Database(DB_PATH, { fileMustExist: true });
const now = new Date().toISOString();

db.prepare(
  `INSERT OR REPLACE INTO organizations (id, slug, name, website, application_email, brand_color, is_demo, created_at, updated_at)
   VALUES ('smoke_org','smoke-co','Smoke Co','https://smoke.example.com','careers@smoke.example.com','#2563eb',0,?,?)`,
).run(now, now);

const description = "Smoke-test role.\n\nWhat you'll do\n- Verify the deploy\n- Keep the lines green\n\nRequirements\n- A pulse";
db.prepare(
  `INSERT OR REPLACE INTO jobs
     (id, organization_id, slug, title, description, location, employment_type, salary_currency, salary_period,
      company_name, reference_number, status, screen_key, created_at, updated_at, published_at, notify_on_apply, created_by)
   VALUES ('smoke_job','smoke_org','smoke-electrician','Smoke Electrician',?,'Fresno, CA','FULL_TIME','USD','YEAR',
      'Smoke Co','SMOKE-001','published','', ?, ?, ?, 1, '')`,
).run(description, now, now, now);

const n = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE organization_id='smoke_org' AND status='published'").get().n;
db.close();
console.log(`[seed-smoke] seeded org=smoke-co job=smoke-electrician (published jobs: ${n})`);
