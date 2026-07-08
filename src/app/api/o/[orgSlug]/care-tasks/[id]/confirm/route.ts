import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canManageTeam, canWrite } from "@/lib/roles";
import { confirmCareTask, getCareTask } from "@/lib/candidate-care";
import { isCareOutcome, isContactMethod } from "@/lib/care-meta";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Recruiter confirms they reached out on a care task. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const task = getCareTask(id, organization.id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Recruiters may only confirm their own tasks; owners can confirm any.
    if (!canManageTeam(user.role) && task.assigned_recruiter_id !== user.id) {
      return NextResponse.json({ error: "This task is assigned to another recruiter." }, { status: 403 });
    }
    if (task.status === "confirmed" || task.status === "cancelled") {
      return NextResponse.json({ error: "This task is already closed." }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!isContactMethod(body.contact_method)) {
      return NextResponse.json({ error: "Pick how you contacted them." }, { status: 400 });
    }
    if (!isCareOutcome(body.outcome)) {
      return NextResponse.json({ error: "Pick an outcome." }, { status: 400 });
    }

    confirmCareTask({
      organization_id: organization.id,
      task,
      contact_method: body.contact_method,
      outcome: body.outcome,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : "",
      actor: user.name,
      actor_id: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Confirm care task failed:", error);
    return NextResponse.json({ error: "Failed to confirm task." }, { status: 500 });
  }
}
