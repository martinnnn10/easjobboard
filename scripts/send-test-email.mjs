#!/usr/bin/env node
/**
 * Verify SMTP/email delivery for EAS Recruit without touching product data.
 *
 *   node scripts/send-test-email.mjs --to you@example.com
 *   TEST_EMAIL_TO=you@example.com node scripts/send-test-email.mjs
 *
 * Reads the same SMTP_* env the app uses. It (1) verifies the SMTP connection,
 * then (2) sends one plain test email. Exit 0 on success; non-zero on any
 * misconfiguration or send failure, with a clear reason.
 */
import { createRequire } from "module";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
const FROM_EMAIL = process.env.FROM_EMAIL ?? SMTP_USER;
const FROM_NAME = process.env.FROM_NAME ?? process.env.PLATFORM_NAME ?? "EAS Recruit";
const TO = arg("--to") ?? process.env.TEST_EMAIL_TO ?? process.env.PLATFORM_EMAIL;

const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[email-test] SMTP is NOT configured — missing: ${missing.join(", ")}`);
  console.error("[email-test] Set them in the environment (see .env.example) and retry.");
  process.exit(2);
}
if (!TO) {
  console.error("[email-test] No recipient. Pass --to <email> or set TEST_EMAIL_TO / PLATFORM_EMAIL.");
  process.exit(2);
}

let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = require(join(repoRoot, "node_modules", "nodemailer"));
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  console.log(`[email-test] Verifying SMTP ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER} ...`);
  await transporter.verify();
  console.log("[email-test] SMTP connection OK. Sending test email ...");
  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: TO,
    subject: "EAS Recruit — SMTP test",
    text: [
      "This is a test email from EAS Recruit's send-test-email script.",
      `Sent: ${new Date().toISOString()}`,
      `Host: ${SMTP_HOST}:${SMTP_PORT}`,
      "If you received this, outbound email delivery is working.",
    ].join("\n"),
  });
  console.log(`[email-test] SENT to ${TO}  (messageId: ${info.messageId})`);
  if (info.accepted?.length) console.log(`[email-test] accepted: ${info.accepted.join(", ")}`);
  if (info.rejected?.length) console.log(`[email-test] rejected: ${info.rejected.join(", ")}`);
  process.exit(0);
} catch (err) {
  console.error(`[email-test] FAILED: ${err?.message ?? err}`);
  process.exit(1);
}
