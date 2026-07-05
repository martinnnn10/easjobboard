import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { createJob, listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
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
    const { organization } = await requireOrgSessionApi(orgSlug);
    const body = await request.json();

    const job = createJob(organization.id, organization.name, {
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
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
