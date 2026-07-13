import { NextResponse } from "next/server";
import { requireOrgCapability, requireOrgSessionApi } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canSeeJob, getJobAccess, setJobVisibleUsers } from "@/lib/job-visibility";
import { canWrite } from "@/lib/roles";
import { deleteJob, getJobById, updateJob } from "@/lib/jobs";
import { listUsersByOrganization } from "@/lib/users";
import type { JobStatus } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    const job = getJobById(id);
    if (!job || job.organization_id !== organization.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = await request.json();

    // Can't edit a restricted job you can't see.
    const existing = getJobById(id);
    if (!existing || existing.organization_id !== organization.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!canSeeJob(getJobAccess(organization.id, user), existing.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const job = updateJob(id, organization.id, {
      title: body.title,
      description: body.description,
      location: body.location,
      city: body.city,
      state: body.state,
      country: body.country,
      zip: body.zip,
      employment_type: body.employment_type,
      salary_min: body.salary_min !== undefined && body.salary_min !== "" ? Number(body.salary_min) : null,
      salary_max: body.salary_max !== undefined && body.salary_max !== "" ? Number(body.salary_max) : null,
      salary_currency: body.salary_currency,
      salary_period: body.salary_period,
      company_name: body.company_name,
      reference_number: body.reference_number,
      status: body.status as JobStatus,
      screen_key: body.screen_key,
      shift: body.shift,
      certifications: Array.isArray(body.certifications) ? body.certifications : undefined,
      schedule: body.schedule,
      overtime: body.overtime,
      union_status: body.union_status,
      relocation: body.relocation,
      plc_platforms: body.plc_platforms,
      vfd_experience: body.vfd_experience,
      refrigeration: body.refrigeration,
      industry: body.industry,
      travel: body.travel,
      application_deadline: body.application_deadline,
      notify_on_apply: body.notify_on_apply !== false,
    });

    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Update the visibility allowlist; always keep the original creator so they
    // can't be locked out (owners retain access via role regardless).
    if (Array.isArray(body.visible_user_ids)) {
      setJobVisibleUsers({
        organizationId: organization.id,
        jobId: job.id,
        selectedUserIds: [
          ...body.visible_user_ids.filter((x: unknown) => typeof x === "string"),
          ...(existing.created_by ? [existing.created_by] : []),
        ],
        allOrgUserIds: listUsersByOrganization(organization.id).map((u) => u.id),
      });
    }

    return NextResponse.json({ job });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canWrite);
    const deleted = deleteJob(id, organization.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
