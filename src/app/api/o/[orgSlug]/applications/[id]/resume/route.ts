import { NextResponse } from "next/server";
import { getApplicationResume } from "@/lib/applications";
import { requireOrgSessionApi } from "@/lib/auth";
import { sanitizeFilename } from "@/lib/file-validation";

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

    const safeName = sanitizeFilename(resume.filename);
    // RFC 5987 filename* carries the full (UTF-8) name; the plain filename is the
    // sanitized ASCII fallback. nosniff stops the browser from re-interpreting
    // the bytes as HTML and rendering a booby-trapped upload inline.
    const encodedName = encodeURIComponent(resume.filename);

    return new NextResponse(new Uint8Array(resume.data), {
      headers: {
        "Content-Type": resume.contentType,
        "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
