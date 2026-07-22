import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability } from "@/lib/auth";
import { deleteOrganizationLogo, setOrganizationLogo } from "@/lib/organizations";
import { canManageTeam } from "@/lib/roles";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

// Raster only — no SVG (avoids the stored-XSS surface of script-bearing SVGs).
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 1024 * 1024; // 1 MB

/** Upload/replace the careers-page logo (owner only). */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Use a PNG, JPG, or WebP image." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be under 1 MB." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    setOrganizationLogo(organization.id, buffer, file.type);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Logo upload failed:", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

/** Remove the logo, reverting the careers page to name initials (owner only). */
export async function DELETE(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization } = await requireOrgCapability(orgSlug, canManageTeam);
    deleteOrganizationLogo(organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Logo delete failed:", error);
    return NextResponse.json({ error: "Failed to remove logo." }, { status: 500 });
  }
}
