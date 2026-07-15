import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { jobHasApplications } from "@/lib/applications";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { deleteJob, duplicateJob, getJobById, updateJob } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";
import type { JobStatus } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };
type BulkAction = "publish" | "draft" | "close" | "duplicate" | "delete";

const STATUS_FOR: Record<"publish" | "draft" | "close", JobStatus> = {
  publish: "published",
  draft: "draft",
  close: "closed",
};

const ACTIONS: BulkAction[] = ["publish", "draft", "close", "duplicate", "delete"];

/**
 * Bulk job actions. Owner/recruiter (canWrite) only; every job is re-checked
 * against per-job visibility so a user can never modify a job they can't see.
 * Delete is guarded: it requires an explicit confirmation flag, and the client
 * is expected to warn when any selected job already has applications.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as {
      jobIds?: unknown;
      action?: unknown;
      confirmDelete?: unknown;
    };

    const action = body.action as BulkAction;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
    }

    const jobIds = Array.isArray(body.jobIds) ? body.jobIds.filter((x): x is string => typeof x === "string") : [];
    if (jobIds.length === 0) {
      return NextResponse.json({ error: "No jobs selected." }, { status: 400 });
    }

    // Only act on jobs that belong to this org AND this user is allowed to see.
    const access = getJobAccess(organization.id, user);
    const scoped = jobIds.filter((id) => {
      const job = getJobById(id);
      return Boolean(job && job.organization_id === organization.id && canSeeJob(access, id));
    });
    if (scoped.length === 0) {
      return NextResponse.json({ error: "None of the selected jobs are available to you." }, { status: 404 });
    }

    if (action === "delete") {
      const withApplications = scoped.filter((id) => jobHasApplications(id));
      // Hard delete is destructive — require an explicit typed confirmation from
      // the client, and surface how many carry application history.
      if (body.confirmDelete !== true) {
        return NextResponse.json(
          {
            error:
              withApplications.length > 0
                ? "Some selected jobs have applications. Close/archive them instead, or confirm permanent deletion."
                : "Permanent deletion needs confirmation.",
            requiresConfirmation: true,
            jobsWithApplications: withApplications.length,
          },
          { status: 409 },
        );
      }
      let deleted = 0;
      for (const id of scoped) {
        if (deleteJob(id, organization.id)) deleted += 1;
      }
      return NextResponse.json({ ok: true, action, affected: deleted });
    }

    if (action === "duplicate") {
      // Copies are always created as drafts (duplicateJob enforces this) so a
      // bulk duplicate can never accidentally publish live postings.
      let created = 0;
      for (const id of scoped) {
        if (duplicateJob(id, organization.id, user.id)) created += 1;
      }
      return NextResponse.json({ ok: true, action, affected: created });
    }

    // publish / draft / close — updateJob manages published_at / closed_at so
    // public surfaces (careers, sitemap, feeds) stay correct.
    const status = STATUS_FOR[action];
    let updated = 0;
    for (const id of scoped) {
      if (updateJob(id, organization.id, { status })) updated += 1;
    }
    return NextResponse.json({ ok: true, action, affected: updated });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Bulk action failed." }, { status: 500 });
  }
}
