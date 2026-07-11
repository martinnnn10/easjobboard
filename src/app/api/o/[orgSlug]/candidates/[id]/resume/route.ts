import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { getCandidateResume } from "@/lib/candidates";
import { sanitizeFilename } from "@/lib/file-validation";
import { canViewResumes } from "@/lib/roles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string; id: string }> };

/** Download a candidate-level resume (imported candidates). PII — viewers blocked. */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug, id } = await context.params;

  try {
    const { organization } = await requireOrgCapability(orgSlug, canViewResumes);
    const resume = getCandidateResume(id, organization.id);
    if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const safeName = sanitizeFilename(resume.filename);
    const encodedName = encodeURIComponent(resume.filename);
    return new NextResponse(new Uint8Array(resume.data), {
      headers: {
        "Content-Type": resume.contentType,
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
