import { NextResponse } from "next/server";
import { createApplication } from "@/lib/applications";
import { sendApplicationEmail } from "@/lib/email";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type RouteContext = { params: Promise<{ orgSlug: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgSlug } = await context.params;
    const organization = getOrganizationBySlug(orgSlug);
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
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
    });

    // Send email notification in the background — don't fail the application if SMTP is down
    try {
      await sendApplicationEmail({
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
      });
    } catch (emailError) {
      console.error("SMTP delivery failed (application still saved):", emailError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Application failed:", error);
    return NextResponse.json(
      { error: "Failed to submit application. Please try again." },
      { status: 500 },
    );
  }
}
