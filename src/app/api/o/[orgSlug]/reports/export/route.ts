import { authErrorResponse } from "@/lib/api";
import { requireOrgSessionApi } from "@/lib/auth";
import { getJobAccess } from "@/lib/job-visibility";
import { getOrganizationBySlug } from "@/lib/organizations";
import {
  getReportData,
  isRangePreset,
  reportToCsvRows,
  resolveRange,
  type RangePreset,
} from "@/lib/reports";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Download the current Reports view as a CSV, honoring the same date range. */
export async function GET(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const organization = getOrganizationBySlug(orgSlug);
    if (!organization) return new Response("Not found", { status: 404 });
    // API auth guard: throws "UNAUTHORIZED" for unauthenticated/foreign-org
    // callers (→ 401 via authErrorResponse) instead of redirecting like the
    // page guard, which previously fell through to a 500. Export runs only
    // after auth succeeds.
    const { user } = await requireOrgSessionApi(orgSlug);

    const url = new URL(request.url);
    const preset: RangePreset = isRangePreset(url.searchParams.get("range") ?? undefined)
      ? (url.searchParams.get("range") as RangePreset)
      : "all";
    const { range, label } = resolveRange(
      preset,
      url.searchParams.get("from") ?? undefined,
      url.searchParams.get("to") ?? undefined,
      new Date(),
    );

    const data = getReportData(organization.id, range, getJobAccess(organization.id, user));
    const rows = reportToCsvRows(data);
    rows.splice(1, 0, ["Date range", label]);
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");

    const safeSlug = orgSlug.replace(/[^a-z0-9-]/gi, "");
    const filename = `eas-recruit-report-${safeSlug}-${preset}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Report export failed:", error);
    return new Response("Export failed", { status: 500 });
  }
}
