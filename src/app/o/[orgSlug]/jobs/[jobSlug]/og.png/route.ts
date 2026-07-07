import sharp from "sharp";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import type { Job } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; jobSlug: string }> };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function employmentLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

function salaryLabel(job: Job): string {
  if (!job.salary_min && !job.salary_max) return "";
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  const period = (job.salary_period || "YEAR").toLowerCase();
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)}–${fmt(job.salary_max)}/${period}`;
  const single = (job.salary_min ?? job.salary_max) as number;
  return `${fmt(single)}/${period}`;
}

/** Greedily wrap a title into up to `maxLines` lines of ~`perLine` chars. */
function wrapTitle(title: string, perLine = 22, maxLines = 3): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > perLine && current) {
      lines.push(current.trim());
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  const rest = title.slice(lines.join(" ").length).trim();
  if (rest) lines.push(rest.length > perLine + 3 ? `${rest.slice(0, perLine)}…` : rest);
  else if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

/**
 * 1200×630 branded social/OG card for a job, rendered to PNG (via sharp) for
 * maximum crawler compatibility — Twitter/Facebook/LinkedIn prefer raster
 * images over SVG. DB-driven; referenced from the job page's OG/Twitter tags.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, jobSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  const job = organization ? getJobByOrgAndSlug(organization.id, jobSlug) : null;

  if (!organization || !job || job.status !== "published") {
    return new Response("Not found", { status: 404 });
  }

  const titleLines = wrapTitle(job.title);
  const meta = [job.location, employmentLabel(job.employment_type), salaryLabel(job)].filter(Boolean).join("  ·  ");

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${255 + i * 74}" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800" fill="#ffffff">${escapeXml(
          line,
        )}</text>`,
    )
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3d5917"/>
      <stop offset="0.55" stop-color="#4c7019"/>
      <stop offset="1" stop-color="#2f4b16"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="10" fill="#8fc63f"/>
  <path d="M92 70 L60 118 H82 L72 168 L120 96 H96 Z" fill="#8fc63f" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
  <text x="140" y="118" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="2" fill="#eaf3d6">${escapeXml(
    organization.name.toUpperCase(),
  )}</text>
  <text x="80" y="180" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" letter-spacing="4" fill="#c7e08a">WE'RE HIRING</text>
  ${titleSvg}
  <text x="80" y="540" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#eaf3d6">${escapeXml(meta)}</text>
</svg>`;

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // If rasterization fails for any reason, fall back to serving the SVG so the
    // card still resolves rather than 404-ing.
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  }
}
