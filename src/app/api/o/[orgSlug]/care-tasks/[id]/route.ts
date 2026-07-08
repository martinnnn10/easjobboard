import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canManageTeam, canWrite } from "@/lib/roles";
import { cancelCareTask, getCareTask, snoozeCareTask } from "@/lib/candidate-care";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Snooze or cancel a care task. */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const task = getCareTask(id, organization.id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (!canManageTeam(user.role) && task.assigned_recruiter_id !== user.id) {
      return NextResponse.json({ error: "This task is assigned to another recruiter." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { action?: unknown; days?: unknown };
    if (body.action === "snooze") {
      const days = Number(body.days);
      snoozeCareTask(organization.id, task, Number.isFinite(days) && days > 0 ? Math.min(30, days) : 1, user.name);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "cancel") {
      cancelCareTask(organization.id, task, user.name);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Update care task failed:", error);
    return NextResponse.json({ error: "Failed to update task." }, { status: 500 });
  }
}
