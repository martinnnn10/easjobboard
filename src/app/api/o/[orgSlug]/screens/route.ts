import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { requireOrgCapability, requireOrgSessionApi } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { createScreen, listScreens, templateToDefinition } from "@/lib/screen-store";
import { getScreen, isScreenCategory, isScreenKey } from "@/lib/screens";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

/** Sensible starter category for a built-in seed. */
const BUILTIN_CATEGORY: Record<string, string> = {
  maintenance_tech: "industrial_maintenance",
  industrial_electrician: "electrical_maintenance",
  controls_tech: "controls_plc",
  maintenance_leader: "maintenance_leadership",
};

/** List the org's screen library. Any signed-in member may read. */
export async function GET(_request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization } = await requireOrgSessionApi(orgSlug);
    return NextResponse.json({ screens: listScreens(organization.id) });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("List screens failed:", error);
    return NextResponse.json({ error: "Couldn't load screens." }, { status: 500 });
  }
}

/**
 * Create a screen — blank, or seeded from an approved built-in template. Owner
 * and recruiter only. Duplicating an existing custom screen goes through the
 * dedicated /duplicate route.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;
  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      category?: unknown;
      target_role?: unknown;
      description?: unknown;
      seed_from?: unknown;
    };

    const seedFrom = typeof body.seed_from === "string" ? body.seed_from.trim() : "";
    // Only built-in keys are valid seeds here (custom→custom uses /duplicate).
    const seedTemplate = seedFrom && isScreenKey(seedFrom) ? getScreen(seedFrom) : null;

    const title =
      (typeof body.title === "string" && body.title.trim()) ||
      (seedTemplate ? `${seedTemplate.shortLabel} (custom)` : "");
    if (!title) {
      return NextResponse.json({ error: "Give the screen a title." }, { status: 400 });
    }

    const category =
      typeof body.category === "string" && isScreenCategory(body.category)
        ? body.category
        : seedFrom
          ? BUILTIN_CATEGORY[seedFrom] ?? "custom"
          : "custom";

    const record = createScreen({
      organizationId: organization.id,
      title,
      category,
      targetRole: typeof body.target_role === "string" ? body.target_role : seedTemplate?.shortLabel ?? "",
      description: typeof body.description === "string" ? body.description : seedTemplate?.blurb ?? "",
      createdBy: user.name,
      seed: seedTemplate ? templateToDefinition(seedTemplate) : undefined,
      seededFrom: seedFrom,
    });

    return NextResponse.json({ screen: record }, { status: 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Create screen failed:", error);
    return NextResponse.json({ error: "Couldn't create the screen." }, { status: 500 });
  }
}
