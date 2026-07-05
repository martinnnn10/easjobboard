import { NextResponse } from "next/server";
import { createApplication } from "@/lib/applications";
import { sendApplicationEmail } from "@/lib/email";
import { detectResumeKind } from "@/lib/file-validation";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { extractResumeText } from "@/lib/resume-parsing";
import { scoreResume } from "@/lib/scoring";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Cap application submissions per IP to blunt resume spam / abuse.
const APPLY_RATE_LIMIT = 10;
const APPLY_RATE_WINDOW_MS = 10 * 60 * 1000;

type RouteContext = { params: Promise<{ orgSlug: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;
    const organization = getOrganizationBySlug(orgSlug);
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const limit = rateLimit(`apply:${orgSlug}:${getClientIp(request)}`, APPLY_RATE_LIMIT, APPLY_RATE_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many applications. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const formData = await request.formData();
    const jobSlug = String(formData.get("jobSlug") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const coverLetter = String(formData.get("coverLetter") ?? "").trim();
    const resume = formData.get("resume");

    if (!jobSlug || !name || !email) {
      return NextResponse.json({ error: "Name, email, and job are required" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const job = getJobByOrgAndSlug(organization.id, jobSlug);
    if (!job || job.status !== "published") {
      return NextResponse.json({ error: "Job not found or no longer accepting applications" }, { status: 404 });
    }

    if (!(resume instanceof File) || resume.size === 0) {
      return NextResponse.json({ error: "Resume file is required" }, { status: 400 });
    }

    if (resume.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Resume must be 5 MB or smaller" }, { status: 400 });
    }

    const contentType = resume.type || "application/octet-stream";
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Resume must be PDF, DOC, or DOCX" }, { status: 400 });
    }

    const buffer = Buffer.from(await resume.arrayBuffer());

    // The MIME type above is client-supplied; confirm the actual file bytes match
    // an allowed resume format so a renamed script can't be stored.
    const resumeKind = detectResumeKind(buffer);
    if (!resumeKind) {
      return NextResponse.json(
        { error: "Resume file does not appear to be a valid PDF, DOC, or DOCX" },
        { status: 400 },
      );
    }

    // Parse the resume and score it against the job. Never fail the application
    // over parsing/scoring problems — store nulls and move on.
    let resumeText = "";
    let resumeSkills: string[] = [];
    let matchScore: number | null = null;
    try {
      resumeText = await extractResumeText(buffer, resumeKind);
      if (resumeText) {
        const result = await scoreResume({
          resumeText,
          jobTitle: job.title,
          jobDescription: job.description,
        });
        resumeSkills = result.resumeSkills;
        matchScore = result.score;
      }
    } catch (parseError) {
      console.error("Resume parsing/scoring failed (application still saved):", parseError);
    }

    createApplication({
      organization_id: organization.id,
      job_id: job.id,
      applicant_name: name,
      applicant_email: email,
      applicant_phone: phone,
      cover_letter: coverLetter,
      resume_filename: resume.name,
      resume_content_type: contentType,
      resume_data: buffer,
      resume_text: resumeText,
      resume_skills: resumeSkills,
      match_score: matchScore,
    });

    // Fire-and-forget the notification email: the application is already saved,
    // so the applicant shouldn't wait on (or be failed by) a slow/unreachable
    // SMTP server. Safe because this runs as a long-lived Node process.
    void sendApplicationEmail({
      organization,
      job,
      applicantName: name,
      applicantEmail: email,
      applicantPhone: phone,
      coverLetter,
      resume: {
        filename: resume.name,
        content: buffer,
        contentType,
      },
    }).catch((emailError) => {
      console.error("SMTP delivery failed (application still saved):", emailError);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Application failed:", error);
    return NextResponse.json(
      { error: "Failed to submit application. Please try again." },
      { status: 500 },
    );
  }
}
