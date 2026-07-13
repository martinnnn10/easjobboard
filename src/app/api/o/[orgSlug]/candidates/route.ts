import { NextResponse } from "next/server";
import { requireOrgCapability } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api";
import { canWrite } from "@/lib/roles";
import { createSourcedCandidate } from "@/lib/candidates";
import {
  isCandidateCrmStatus,
  isCandidateSource,
  type CandidateSource,
} from "@/lib/candidate-meta";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ orgSlug: string }> };

function str(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v, 60)).filter(Boolean).slice(0, 50);
}

/**
 * Create a sourced/passive candidate (someone who hasn't applied). Not
 * Apollo-specific: `source_provider` is free text so manual entries and future
 * providers work the same way. Duplicate detection runs server-side; when an
 * existing person matches we return their record with matched=true instead of
 * creating a second one.
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const email = str(body.email, 320).toLowerCase();
    const name = str(body.name, 200);
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const source: CandidateSource = isCandidateSource(body.source) ? body.source : "sourced";
    const crm_status = isCandidateCrmStatus(body.crm_status) ? body.crm_status : undefined;

    const result = createSourcedCandidate({
      organization_id: organization.id,
      email,
      name,
      phone: str(body.phone, 60),
      location: str(body.location, 200),
      title: str(body.title, 200),
      company: str(body.company, 200),
      source,
      source_provider: str(body.source_provider, 80),
      source_url: str(body.source_url, 500),
      skills: strArray(body.skills),
      tags: strArray(body.tags),
      crm_status,
      notes: str(body.notes, 5000),
      created_by: user.id,
      actor: user.name,
    });

    return NextResponse.json(result, { status: result.matched ? 200 : 201 });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Create sourced candidate failed:", error);
    return NextResponse.json({ error: "Failed to add candidate." }, { status: 500 });
  }
}
