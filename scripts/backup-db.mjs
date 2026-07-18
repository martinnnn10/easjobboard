#!/usr/bin/env node
/**
 * Timestamped, consistent SQLite backup for EAS Recruit.
 *
 * Uses better-sqlite3's online .backup() so it is safe on a live WAL database
 * (no need to stop the app, no torn reads). It NEVER writes to the live DB.
 *
 *   node scripts/backup-db.mjs
 *   DB_PATH=./data/jobs.db BACKUP_DIR=./backups KEEP=14 node scripts/backup-db.mjs
 *
 * Cron example (daily 02:15, keep 14 days):
 *   15 2 * * *  cd /home/ubuntu/eas-recruit && node scripts/backup-db.mjs >> backups/backup.log 2>&1
 *
 * Exit 0 on a verified backup; non-zero otherwise (so cron/monitoring can alert).
 */
import { existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DB_PATH = resolve(process.env.DB_PATH ?? join(repoRoot, "data", "jobs.db"));
const BACKUP_DIR = resolve(process.env.BACKUP_DIR ?? join(repoRoot, "backups"));
const KEEP = Math.max(1, Number(process.env.KEEP ?? "14"));

function ts() {
  // YYYYMMDD-HHMMSS in UTC — sortable, filename-safe.
  // "2026-07-18T02:09:21.123Z" -> "20260718-020921"
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`[backup] ERROR: database not found at ${DB_PATH}`);
    process.exit(2);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });

  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    Database = require(join(repoRoot, "node_modules", "better-sqlite3"));
  }

  const dest = join(BACKUP_DIR, `jobs-${ts()}.db`);
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    await db.backup(dest);
  } finally {
    db.close();
  }

  // Verify the backup exists and is a non-empty, openable SQLite file.
  if (!existsSync(dest)) {
    console.error(`[backup] ERROR: backup file was not created: ${dest}`);
    process.exit(3);
  }
  const size = statSync(dest).size;
  if (size <= 0) {
    console.error(`[backup] ERROR: backup file is empty: ${dest}`);
    process.exit(4);
  }
  try {
    const verify = new Database(dest, { readonly: true, fileMustExist: true });
    verify.prepare("SELECT count(*) AS n FROM sqlite_master").get();
    verify.close();
  } catch (err) {
    console.error(`[backup] ERROR: backup file failed to open: ${err?.message ?? err}`);
    process.exit(5);
  }
  console.log(`[backup] OK  ${dest}  (${(size / 1024).toFixed(0)} KB)`);

  // Prune: keep the newest KEEP backups.
  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => /^jobs-\d{8}-\d{6}\.db$/.test(f))
    .map((f) => ({ f, m: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  for (const { f } of backups.slice(KEEP)) {
    unlinkSync(join(BACKUP_DIR, f));
    console.log(`[backup] pruned old backup ${f}`);
  }
  console.log(`[backup] ${Math.min(backups.length, KEEP)} backup(s) retained in ${BACKUP_DIR}`);
}

main().catch((err) => {
  console.error(`[backup] ERROR: ${err?.message ?? err}`);
  process.exit(1);
});
