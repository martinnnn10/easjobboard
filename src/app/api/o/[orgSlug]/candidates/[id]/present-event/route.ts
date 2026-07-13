import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { listEventsByCandidate, recordCandidateEvent } from "@/lib/candidate-events";
import { getCandidateWithApplications } from "@/lib/candidates";
import { getJobAccess } from "@/lib/job-visibility";
import { canWrite } from "@/lib/roles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };
const DEDUPE_MS = 10 * 60 * 1000;

/** Log a "presentation generated / copied" timeline event (deduped). */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    // Per-job visibility: deny when the caller can only reach this candidate
    // through a restricted job (returns null), matching the present page's gate.
    const candidate = getCandidateWithApplications(id, organization.id, getJobAccess(organization.id, user));
    if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { action?: string; role?: string };
    const isCopy = body.action === "copied";
    const prefix = isCopy ? "Client presentation copied" : "Client presentation generated";
    const role = typeof body.role === "string" ? body.role.trim().slice(0, 120) : "";
    const detail = role && !isCopy ? `${prefix} for ${role}` : prefix;

    // Dedupe rapid repeats (refresh / re-copy) within a short window.
    const recent = listEventsByCandidate(id, organization.id).find(
      (e) => e.type === "note" && e.detail.startsWith(prefix),
    );
    if (recent && Date.now() - Date.parse(recent.created_at) < DEDUPE_MS) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    recordCandidateEvent({
      organization_id: organization.id,
      candidate_id: id,
      type: "note",
      detail,
      actor: user.name,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
