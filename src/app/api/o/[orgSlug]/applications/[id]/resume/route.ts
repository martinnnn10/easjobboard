import { NextResponse } from "next/server";
import { getApplicationResume } from "@/lib/applications";
import { requireOrgSessionApi } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    const resume = getApplicationResume(id, organization.id);
    if (!resume) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(resume.data), {
      headers: {
        "Content-Type": resume.contentType,
        "Content-Disposition": `attachment; filename="${resume.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
