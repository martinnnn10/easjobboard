import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import {
  previewImport,
  runImport,
  type DedupStrategy,
  type ImportMapping,
} from "@/lib/candidate-import";
import { getImportPlatform } from "@/lib/import-format";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";

export const runtime = "nodejs";

const MAX_ROWS = 5000;
const STRATEGIES: DedupStrategy[] = ["skip", "update", "new"];

type RouteContext = { params: Promise<{ orgSlug: string }> };

/**
 * Bulk candidate import from a parsed CSV export. Owner/recruiter only (viewers
 * blocked by canWrite). `dryRun: true` returns a no-writes preview; otherwise it
 * imports and returns a batch summary. All candidates are scoped to this org.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as {
      platform?: unknown;
      filename?: unknown;
      mapping?: unknown;
      rows?: unknown;
      strategy?: unknown;
      attachJobId?: unknown;
      dryRun?: unknown;
    };

    const platformKey = typeof body.platform === "string" ? body.platform : "custom";
    if (!getImportPlatform(platformKey)) {
      return NextResponse.json({ error: "Unknown import source." }, { status: 400 });
    }

    const rows = Array.isArray(body.rows)
      ? (body.rows.filter((r) => Array.isArray(r)) as string[][]).map((r) => r.map((c) => String(c ?? "")))
      : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows to import." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS}). Split the file and import in batches.` }, { status: 400 });
    }

    // Mapping: EAS field key -> column index. Keep only numeric indices.
    const mapping: ImportMapping = {};
    if (body.mapping && typeof body.mapping === "object") {
      for (const [k, v] of Object.entries(body.mapping as Record<string, unknown>)) {
        const idx = Number(v);
        if (Number.isInteger(idx) && idx >= 0) mapping[k] = idx;
      }
    }
    if (mapping.first_name == null || (mapping.email == null && mapping.phone == null)) {
      return NextResponse.json({ error: "Map a name column and at least an email or phone column." }, { status: 400 });
    }

    // Validate attach-to-job: must belong to this org and be visible to the user.
    let attachJobId = "";
    let attachJobTitle = "";
    if (typeof body.attachJobId === "string" && body.attachJobId.trim()) {
      const job = getJobById(body.attachJobId.trim());
      if (job && job.organization_id === organization.id && canSeeJob(getJobAccess(organization.id, user), job.id)) {
        attachJobId = job.id;
        attachJobTitle = job.title;
      } else {
        return NextResponse.json({ error: "Selected job is not available to you." }, { status: 400 });
      }
    }

    if (body.dryRun === true) {
      const preview = previewImport(organization.id, rows, mapping);
      return NextResponse.json({ preview });
    }

    const strategy: DedupStrategy = STRATEGIES.includes(body.strategy as DedupStrategy)
      ? (body.strategy as DedupStrategy)
      : "skip";
    const filename = typeof body.filename === "string" ? body.filename.slice(0, 300) : "import.csv";

    const result = runImport({
      organizationId: organization.id,
      userId: user.id,
      userName: user.name,
      platformKey,
      filename,
      dataRows: rows,
      mapping,
      strategy,
      attachJobId,
      attachJobTitle,
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Bulk candidate import failed:", error);
    return NextResponse.json({ error: "Import failed. Check the file and try again." }, { status: 500 });
  }
}
