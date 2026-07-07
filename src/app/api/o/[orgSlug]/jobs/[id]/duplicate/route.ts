import { NextResponse } from "next/server";
import { requireOrgSessionApi } from "@/lib/auth";
import { duplicateJob } from "@/lib/jobs";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Clone a job into a new draft and return it (client redirects to its editor). */
export async function POST(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    const job = duplicateJob(id, organization.id);
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to duplicate job" }, { status: 500 });
  }
}
