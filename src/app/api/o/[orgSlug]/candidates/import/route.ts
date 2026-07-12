import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/api";
import { attachCandidateToJob } from "@/lib/applications";
import { requireOrgCapability } from "@/lib/auth";
import { createSourcedCandidate, findDuplicateCandidate } from "@/lib/candidates";
import { isCandidateSource, type CandidateSource } from "@/lib/candidate-meta";
import { detectResumeKind } from "@/lib/file-validation";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById } from "@/lib/jobs";
import { canWrite } from "@/lib/roles";
import { getUserById } from "@/lib/users";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
type RouteContext = { params: Promise<{ orgSlug: string }> };

function field(form: FormData, key: string, max = 300): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Candidate Import V0 — add a candidate who didn't apply through a public job
 * page. Optional resume upload, optional attach-to-job, owner assignment, and
 * duplicate detection. Recruiters/owners only (viewers blocked by canWrite).
 */
export async function POST(request: Request, context: RouteContext) {
  const { orgSlug } = await context.params;

  try {
    const { organization, user } = await requireOrgCapability(orgSlug, canWrite);
    const form = await request.formData();

    const firstName = field(form, "first_name", 100);
    const lastName = field(form, "last_name", 100);
    const name = [firstName, lastName].filter(Boolean).join(" ").trim();
    const email = field(form, "email", 320).toLowerCase();
    const phone = field(form, "phone", 60);
    const force = form.get("force") === "true";

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const location = field(form, "location", 200);
    const title = field(form, "title", 200);
    const company = field(form, "company", 200);
    const source: CandidateSource = isCandidateSource(form.get("source")) ? (form.get("source") as CandidateSource) : "manual";
    const notes = field(form, "notes", 5000);
    const jobId = field(form, "job_id", 60);
    let ownerId = field(form, "owner_user_id", 60);

    // Validate owner belongs to this org.
    if (ownerId) {
      const owner = getUserById(ownerId);
      if (!owner || owner.organization_id !== organization.id) ownerId = "";
    }

    // Duplicate check (unless the recruiter chose "add anyway").
    if (!force) {
      const dup = findDuplicateCandidate(organization.id, { email, phone, name, company, location });
      if (dup) {
        return NextResponse.json(
          { duplicate: { id: dup.candidate.id, name: dup.candidate.name || dup.candidate.email, matchedBy: dup.matchedBy } },
          { status: 409 },
        );
      }
    }

    // Optional resume upload — validated the same way as a public apply.
    let resume: { filename: string; contentType: string; data: Buffer } | null = null;
    const file = form.get("resume");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Resume must be under 5 MB." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!detectResumeKind(buffer)) {
        return NextResponse.json({ error: "Resume must be a PDF, DOC, or DOCX file." }, { status: 400 });
      }
      resume = {
        filename: file.name || "resume",
        contentType: file.type || "application/octet-stream",
        data: buffer,
      };
    }

    const result = createSourcedCandidate({
      organization_id: organization.id,
      email,
      name,
      phone,
      location,
      title,
      company,
      source,
      notes,
      owner_user_id: ownerId,
      resume,
      created_by: user.id,
      actor: user.name,
      skipDuplicateCheck: force,
    });

    // Optionally attach to a job (creates an application marked as manually added).
    let attachedJob: string | null = null;
    if (jobId) {
      const job = getJobById(jobId);
      if (job && job.organization_id === organization.id && canSeeJob(getJobAccess(organization.id, user), job.id)) {
        const attach = attachCandidateToJob({
          organization_id: organization.id,
          candidate_id: result.candidate.id,
          job_id: jobId,
          actor: user.name,
          source,
        });
        if (attach.ok) attachedJob = job.title;
      }
    }

    return NextResponse.json(
      { candidate: { id: result.candidate.id, name: result.candidate.name }, matched: result.matched, attachedJob },
      { status: 201 },
    );
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    console.error("Candidate import failed:", error);
    return NextResponse.json({ error: "Failed to import candidate." }, { status: 500 });
  }
}
