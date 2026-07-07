import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { getCandidateById } from "@/lib/candidates";
import { recordCandidateEvent } from "@/lib/candidate-events";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

const KINDS = new Set(["Note", "Call", "Meeting", "Text"]);

/** Log a person-level note/activity directly on a candidate (no application). */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const candidate = getCandidateById(id, organization.id);
    if (!candidate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { text?: unknown; kind?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "Note";

    if (!text) {
      return NextResponse.json({ error: "Note text is required." }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Note is too long (max 5000 characters)." }, { status: 400 });
    }

    recordCandidateEvent({
      organization_id: organization.id,
      candidate_id: candidate.id,
      type: "note",
      detail: kind === "Note" ? text : `${kind}: ${text}`,
      actor: user.name,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Candidate note failed:", error);
    return NextResponse.json({ error: "Failed to save note." }, { status: 500 });
  }
}
