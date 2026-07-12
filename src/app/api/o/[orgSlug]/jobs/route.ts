import { NextResponse } from "next/server";
import { requireOrgCapability, requireOrgSessionApi } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { setJobVisibleUsers } from "@/lib/job-visibility";
import { canWrite } from "@/lib/roles";
import { createJob, listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { listUsersByOrganization } from "@/lib/users";
import type { JobStatus } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    return NextResponse.json({ jobs: listJobsByOrganization(organization.id) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = await request.json();

    const job = createJob(
      organization.id,
      organization.name,
      {
        title: body.title,
        description: body.description,
        location: body.location,
        city: body.city,
        state: body.state,
        country: body.country,
        zip: body.zip,
        employment_type: body.employment_type,
        salary_min: body.salary_min ? Number(body.salary_min) : null,
        salary_max: body.salary_max ? Number(body.salary_max) : null,
        salary_currency: body.salary_currency,
        salary_period: body.salary_period,
        company_name: body.company_name,
        reference_number: body.reference_number,
        status: (body.status as JobStatus) ?? "draft",
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
      },
      user.id,
    );

    // Per-job visibility allowlist. Always include the creator so they can't
    // lock themselves out; owners retain access via role regardless.
    if (Array.isArray(body.visible_user_ids)) {
      setJobVisibleUsers({
        organizationId: organization.id,
        jobId: job.id,
        selectedUserIds: [...body.visible_user_ids.filter((x: unknown) => typeof x === "string"), user.id],
        allOrgUserIds: listUsersByOrganization(organization.id).map((u) => u.id),
      });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Create job failed:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function HEAD(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(null, { status: 200 });
}
