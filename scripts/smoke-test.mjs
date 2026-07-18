#!/usr/bin/env node
/**
 * EAS Recruit smoke tests — practical, dependency-free (Node 18+ globals).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 *   SMOKE_ORG=acme SMOKE_JOB=welder node scripts/smoke-test.mjs        # + public org pages
 *   SMOKE_ORG=acme SMOKE_JOB=welder SMOKE_APPLY=1 node scripts/...     # + apply POSTs (WRITES)
 *
 * SMOKE_APPLY sends real apply POSTs, so only enable it against a throwaway/test
 * instance — never against production (it would insert rows into the live DB).
 * Org-specific checks are skipped (not failed) when SMOKE_ORG/SMOKE_JOB are unset.
 *
 * Exit code 0 = all run checks passed; 1 = at least one failed.
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ORG = process.env.SMOKE_ORG ?? "";
const JOB = process.env.SMOKE_JOB ?? "";
const DO_APPLY = process.env.SMOKE_APPLY === "1";

const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok, detail });
const skip = (name, why) => results.push({ name, ok: null, detail: why });

async function get(path, opts = {}) {
  return fetch(BASE + path, { redirect: "manual", ...opts });
}

// Public pages must never leak an internal origin (localhost, a raw IP, or a
// dev/proxy port) into what users and search engines see.
function findLeaks(html) {
  const patterns = [
    /localhost/i,
    /127\.0\.0\.1/,
    /0\.0\.0\.0/,
    /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/, // http(s)://<raw IPv4>
    /:30(?:00|30|31)\b/, // dev/proxy ports
  ];
  return patterns.filter((re) => re.test(html)).map((re) => re.source);
}

async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err));
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  // 1. Homepage
  await check("homepage loads", async () => {
    const r = await get("/");
    expect(r.status === 200, `status ${r.status}`);
    const leaks = findLeaks(await r.text());
    expect(leaks.length === 0, `leaked internal refs: ${leaks.join(", ")}`);
    record("homepage loads", true, "200, no internal-origin leaks");
  });

  // 2. Login page
  await check("login page works", async () => {
    const r = await get("/login");
    expect(r.status === 200, `status ${r.status}`);
    record("login page works", true, "200");
  });

  // 3. robots.txt
  await check("robots works", async () => {
    const r = await get("/robots.txt");
    expect(r.status === 200, `status ${r.status}`);
    const body = await r.text();
    expect(/sitemap/i.test(body), "no Sitemap: directive");
    record("robots works", true, "200 + Sitemap directive");
  });

  // 4. sitemap.xml
  await check("sitemap works", async () => {
    const r = await get("/sitemap.xml");
    expect(r.status === 200, `status ${r.status}`);
    const body = await r.text();
    expect(/<(urlset|sitemapindex)/.test(body), "not a sitemap document");
    record("sitemap works", true, "200 + valid sitemap XML");
  });

  // 5. Health check (present in this build onward)
  await check("health check works", async () => {
    const r = await get("/api/health");
    expect(r.status === 200 || r.status === 503, `status ${r.status}`);
    const j = await r.json();
    expect(typeof j.ok === "boolean" && "database" in j, "missing health fields");
    record("health check works", r.status === 200, `status ${r.status}, db ${j.database}`);
  });

  // Org-specific checks
  if (ORG) {
    // 6. Admin requires auth
    await check("admin route requires auth", async () => {
      const r = await get(`/o/${ORG}/admin`);
      const loc = r.headers.get("location") ?? "";
      expect([301, 302, 303, 307, 308].includes(r.status), `status ${r.status} (expected redirect)`);
      expect(/login/.test(loc), `redirect went to ${loc || "(none)"}`);
      record("admin route requires auth", true, `${r.status} → ${loc}`);
    });

    // 7. Careers page
    await check("careers page loads", async () => {
      const r = await get(`/o/${ORG}`);
      expect(r.status === 200, `status ${r.status}`);
      const leaks = findLeaks(await r.text());
      expect(leaks.length === 0, `leaked internal refs: ${leaks.join(", ")}`);
      record("careers page loads", true, "200, no internal-origin leaks");
    });

    // 8. Feeds
    for (const feed of ["feed/indeed.xml", "feed/jobs.xml", "feed/jobs.json"]) {
      await check(`feed ${feed} works`, async () => {
        const r = await get(`/o/${ORG}/${feed}`);
        expect(r.status === 200, `status ${r.status}`);
        record(`feed ${feed} works`, true, "200");
      });
    }
  } else {
    skip("admin route requires auth", "set SMOKE_ORG");
    skip("careers page loads", "set SMOKE_ORG");
    skip("feeds work", "set SMOKE_ORG");
  }

  // Job-specific checks
  if (ORG && JOB) {
    // 9. Job page + JSON-LD
    await check("job page loads", async () => {
      const r = await get(`/o/${ORG}/jobs/${JOB}`);
      expect(r.status === 200, `status ${r.status}`);
      const body = await r.text();
      expect(body.includes('"@type":"JobPosting"'), "missing JobPosting JSON-LD");
      const leaks = findLeaks(body);
      expect(leaks.length === 0, `leaked internal refs: ${leaks.join(", ")}`);
      record("job page loads", true, "200 + JSON-LD, no leaks");
    });

    if (DO_APPLY) {
      // 10. Apply requires a resume (400)
      await check("apply missing resume -> 400", async () => {
        const fd = new FormData();
        fd.append("jobSlug", JOB);
        fd.append("name", "Smoke Test");
        fd.append("email", "smoke@example.com");
        const r = await get(`/api/o/${ORG}/apply`, { method: "POST", body: fd });
        expect(r.status === 400, `status ${r.status} (expected 400)`);
        record("apply missing resume -> 400", true, "400");
      });

      // 11. Resume-only apply (200)
      await check("resume-only apply -> 200", async () => {
        const fd = new FormData();
        fd.append("jobSlug", JOB);
        fd.append("name", "Smoke Test");
        fd.append("email", "smoke-resume@example.com");
        const pdf = new Blob(["%PDF-1.4 smoke\n%%EOF"], { type: "application/pdf" });
        fd.append("resume", pdf, "resume.pdf");
        const r = await get(`/api/o/${ORG}/apply`, { method: "POST", body: fd });
        expect(r.status === 200, `status ${r.status} (expected 200)`);
        record("resume-only apply -> 200", true, "200");
      });
    } else {
      skip("apply flow (missing resume / resume-only)", "set SMOKE_APPLY=1 on a test instance");
    }
  } else {
    skip("job page loads", "set SMOKE_ORG and SMOKE_JOB");
  }
}

await run();

// Report
const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
console.log(`\nSmoke tests against ${BASE}\n${"=".repeat(60)}`);
let failed = 0;
for (const r of results) {
  const tag = r.ok === null ? "SKIP" : r.ok ? "PASS" : "FAIL";
  if (r.ok === false) failed++;
  console.log(`  [${tag}] ${pad(r.name, 36)} ${r.detail}`);
}
console.log("=".repeat(60));
const passed = results.filter((r) => r.ok === true).length;
const skipped = results.filter((r) => r.ok === null).length;
console.log(`${passed} passed, ${failed} failed, ${skipped} skipped\n`);
process.exit(failed > 0 ? 1 : 0);
