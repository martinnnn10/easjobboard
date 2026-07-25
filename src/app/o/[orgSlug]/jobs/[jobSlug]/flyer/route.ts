import QRCode from "qrcode";
import { getOrgJobUrl } from "@/lib/env";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getBrandColor, getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string; jobSlug: string }> };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSalary(min: number | null, max: number | null, period: string): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  const range = min && max ? `${fmt(min)}–${fmt(max)}` : fmt(min ?? max ?? 0);
  return `${range} / ${period.toLowerCase()}`;
}

/**
 * Print-ready job flyer: branded, one page, with a QR code straight to the
 * apply page. Built for break-room bulletin boards, job fairs, and trade shows
 * — where industrial/trades candidates actually see openings.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, jobSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) return new Response("Organization not found", { status: 404 });

  const job = getJobByOrgAndSlug(organization.id, jobSlug);
  if (!job || job.status !== "published") return new Response("Job not found", { status: 404 });

  const applyUrl = `${getOrgJobUrl(orgSlug, job.slug)}?source=flyer`;
  const brand = getBrandColor(organization);
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_period);

  const qrSvg = await QRCode.toString(applyUrl, {
    type: "svg",
    margin: 0,
    width: 220,
    color: { dark: "#18181b", light: "#ffffff" },
  });

  // First ~5 description lines as highlights, bullets normalized.
  const highlights = job.description
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 8)
    .slice(0, 5);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(job.title)} — ${escapeHtml(organization.name)} (flyer)</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #18181b; background: #f4f4f5; }
  .toolbar { display: flex; justify-content: center; gap: 12px; padding: 16px; }
  .toolbar button { background: ${brand}; color: #fff; border: 0; border-radius: 8px; padding: 10px 20px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .sheet { width: 8.5in; min-height: 10.5in; margin: 0 auto 24px; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.12); display: flex; flex-direction: column; }
  .band { background: ${brand}; color: #fff; padding: 40px 48px; }
  .band .org { font-size: 15px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; opacity: .9; }
  .band h1 { font-size: 42px; line-height: 1.1; margin-top: 10px; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .chip { background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.45); border-radius: 999px; padding: 6px 14px; font-size: 14px; font-weight: 600; }
  .body { flex: 1; display: flex; gap: 40px; padding: 40px 48px; }
  .left { flex: 1.4; }
  .left h2 { font-size: 15px; letter-spacing: .1em; text-transform: uppercase; color: ${brand}; margin-bottom: 14px; }
  .left li { margin: 0 0 10px 18px; font-size: 16px; line-height: 1.45; }
  .right { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-left: 2px dashed #e4e4e7; padding-left: 36px; }
  .qr { padding: 14px; border: 3px solid ${brand}; border-radius: 16px; background: #fff; }
  .qr svg { display: block; width: 220px; height: 220px; }
  .scan { margin-top: 16px; font-size: 22px; font-weight: 800; color: ${brand}; }
  .scan-sub { margin-top: 6px; font-size: 14px; color: #52525b; }
  .url { display: block; margin-top: 10px; font-size: 12px; color: #71717a; text-decoration: none; word-break: break-all; }
  .foot { padding: 18px 48px; border-top: 1px solid #e4e4e7; display: flex; justify-content: space-between; font-size: 13px; color: #71717a; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { width: auto; min-height: auto; margin: 0; box-shadow: none; }
    .band { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">🖨 Print flyer</button>
</div>
<div class="sheet">
  <div class="band">
    <div class="org">${escapeHtml(organization.name)} is hiring</div>
    <h1>${escapeHtml(job.title)}</h1>
    <div class="meta">
      <span class="chip">📍 ${escapeHtml(job.location)}</span>
      <span class="chip">${escapeHtml(job.employment_type.replace(/_/g, " "))}</span>
      ${salary ? `<span class="chip">💰 ${escapeHtml(salary)}</span>` : ""}
    </div>
  </div>
  <div class="body">
    <div class="left">
      <h2>About the role</h2>
      <ul>
        ${highlights.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n        ")}
      </ul>
    </div>
    <div class="right">
      <div class="qr">${qrSvg}</div>
      <div class="scan">Scan to apply</div>
      <div class="scan-sub">Takes under a minute — just your name, email, and resume.</div>
      <a class="url" href="${escapeHtml(applyUrl)}">${escapeHtml(applyUrl)}</a>
    </div>
  </div>
  <div class="foot">
    <span>${escapeHtml(organization.name)}</span>
    <span>Ref: ${escapeHtml(job.reference_number)}</span>
  </div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
