import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { deleteJob, getJobById, updateJob } from "@/lib/jobs";
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
    const { organization } = await requireOrgSessionApi(orgSlug);
    const body = await request.json();

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
    });

    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    const deleted = deleteJob(id, organization.id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
