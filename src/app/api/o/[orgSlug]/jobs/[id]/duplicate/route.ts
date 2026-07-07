import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { duplicateJob } from "@/lib/jobs";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Clone a job into a new draft and return it (client redirects to its editor). */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canWrite);
    const job = duplicateJob(id, organization.id);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Failed to duplicate job" }, { status: 500 });
  }
}
