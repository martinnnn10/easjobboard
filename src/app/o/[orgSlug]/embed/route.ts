import { getOrgJobUrl, getOrgUrl } from "@/lib/env";
import { getPublishedJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orgSlug: string }> };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Self-contained careers widget rendered inside an iframe on the org's own
 * website (via embed.js). Intentionally bypasses the app's header/footer and
 * ships its own minimal styles. Posts its height to the parent so embed.js can
 * auto-size the iframe. This extends reach to the org's existing web traffic.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) {
    return new Response("Organization not found", { status: 404 });
  }

  const jobs = getPublishedJobsByOrganization(organization.id);
  const careersUrl = getOrgUrl(orgSlug);

  const items = jobs.length
    ? jobs
        .map((job) => {
          const href = getOrgJobUrl(orgSlug, job.slug);
          const meta = [job.location, job.employment_type.replace("_", " ")].filter(Boolean).join(" · ");
          return `<a class="eas-job" href="${escapeHtml(href)}" target="_blank" rel="noopener">
  <span class="eas-title">${escapeHtml(job.title)}</span>
  <span class="eas-meta">${escapeHtml(meta)}</span>
</a>`;
        })
        .join("\n")
    : `<p class="eas-empty">No open positions right now.</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(organization.name)} — Open roles</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #18181b; background: transparent; }
  .eas-widget { display: flex; flex-direction: column; gap: 8px; padding: 4px; }
  .eas-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .eas-head h2 { font-size: 15px; margin: 0; }
  .eas-head a { font-size: 12px; color: #2563eb; text-decoration: none; }
  .eas-job { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid #e4e4e7; border-radius: 10px; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s; }
  .eas-job:hover { border-color: #93c5fd; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
  .eas-title { font-weight: 600; font-size: 14px; }
  .eas-meta { font-size: 12px; color: #71717a; }
  .eas-empty { font-size: 14px; color: #71717a; }
  .eas-foot { font-size: 11px; color: #a1a1aa; text-align: right; }
  @media (prefers-color-scheme: dark) {
    body { color: #e4e4e7; }
    .eas-job { border-color: #3f3f46; }
    .eas-meta { color: #a1a1aa; }
  }
</style>
</head>
<body>
<div class="eas-widget" id="eas-widget">
  <div class="eas-head">
    <h2>Open roles at ${escapeHtml(organization.name)}</h2>
    <a href="${escapeHtml(careersUrl)}" target="_blank" rel="noopener">View all →</a>
  </div>
  ${items}
  <div class="eas-foot">Careers powered by this platform</div>
</div>
<script>
  function postHeight() {
    var h = document.getElementById('eas-widget').getBoundingClientRect().height + 8;
    parent.postMessage({ type: 'eas-embed-height', slug: ${JSON.stringify(orgSlug)}, height: Math.ceil(h) }, '*');
  }
  window.addEventListener('load', postHeight);
  window.addEventListener('resize', postHeight);
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
