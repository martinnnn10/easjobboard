import { NextResponse } from "next/server";
import { createApplication } from "@/lib/applications";
import {
  assessRisk,
  deriveRecommendedAction,
  deriveScoreConfidence,
  type ScreenSummary,
} from "@/lib/candidate-intel";
import { recordCandidateEvent } from "@/lib/candidate-events";
import { sendApplicantConfirmationEmail, sendApplicationEmail } from "@/lib/email";
import { detectResumeKind } from "@/lib/file-validation";
import { getJobByOrgAndSlug } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { extractResumeText } from "@/lib/resume-parsing";
import { scoreResume } from "@/lib/scoring";
import { evaluateKnockout, scoreScreen, type ScreenAnswers } from "@/lib/screen-scoring";
import { saveScreenSubmission } from "@/lib/screen-submissions";
import { DIMENSION_LABELS, getScreen, type ScreenDimension } from "@/lib/screens";

export const runtime = "nodejs";

/**
 * Next.js 16 standalone mode wraps the incoming Request in a Proxy. Calling
 * `request.formData()` on that Proxy returns File/Blob entries that are broken
 * objects with no prototype — no `arrayBuffer()`, no `size`. Workaround: read
 * the raw body bytes, construct a fresh standard Request with the same headers
 * and body, and call `formData()` on that.
 */
async function parseFormData(request: Request): Promise<FormData> {
  const body = await request.arrayBuffer();
  const freshRequest = new Request("http://localhost/upload", {
    method: "POST",
    headers: request.headers,
    body,
  });
  return freshRequest.formData();
}

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

    const formData = await parseFormData(request);
    const jobSlug = String(formData.get("jobSlug") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const coverLetter = String(formData.get("coverLetter") ?? "").trim();
    const applicantLocation = String(formData.get("applicantLocation") ?? "").trim();
    const desiredPay = String(formData.get("desiredPay") ?? "").trim();
    const screenAnswersRaw = String(formData.get("screenAnswers") ?? "");
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
    let matchMethod = "";
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
        // Record HOW the score was computed so a silent LLM→keyword fallback is
        // never invisible — the value surfaces next to the score in the admin UI.
        matchMethod = result.score === null ? "" : result.method;
      }
    } catch (parseError) {
      console.error("Resume parsing/scoring failed (application still saved):", parseError);
    }

    // ── Skills screen + candidate intelligence ──────────────────────────────
    // Parse the candidate's screen answers (if the job has a screen attached),
    // score them, and assess pay/commute/tenure risk. Never fail the submission
    // over scoring problems — degrade to "pending"/no-score and store the rest.
    const screen = getScreen(job.screen_key);
    let screenAnswers: ScreenAnswers = {};
    if (screenAnswersRaw) {
      try {
        const parsed = JSON.parse(screenAnswersRaw);
        if (parsed && typeof parsed === "object") screenAnswers = parsed as ScreenAnswers;
      } catch {
        screenAnswers = {};
      }
    }
    const answeredCount = Object.values(screenAnswers).filter(
      (v) => v !== "" && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0),
    ).length;

    let screenStatus: "none" | "pending" | "completed" = screen ? "pending" : "none";
    let screenScore: number | null = null;
    let screenOutcome = "";
    let screenResult = null;
    let screenSummary: ScreenSummary | null = null;

    if (screen && answeredCount > 0) {
      try {
        screenResult = await scoreScreen(job.screen_key, screenAnswers);
        if (screenResult) {
          screenStatus = "completed";
          screenScore = screenResult.overallScore;
          // Knockout gate: flag applicants who miss the passing bar or a
          // safety-critical must-pass question (advisory — never auto-rejects).
          const verdict = evaluateKnockout(job.screen_key, screenResult);
          screenOutcome = verdict.qualified ? "qualified" : "knockout";
        }
      } catch (screenError) {
        console.error("Screen scoring failed (application still saved):", screenError);
      }
    }

    // Risk assessment runs whether or not a screen was completed.
    const candidateIsLead = /supervisor|manager|superintendent|maintenance lead|reliability lead|team lead/i.test(
      resumeText,
    );
    const risk = assessRisk({
      job,
      desiredPay,
      applicantLocation,
      resumeText,
      screenScore,
      jobIsLeadRole: job.screen_key === "maintenance_leader",
      candidateIsLead,
    });

    if (screenResult) {
      const openAnswers = screenResult.perAnswer.filter(
        (a) => a.type === "short_answer" || a.type === "scenario",
      );
      const avgOpenWords =
        openAnswers.length === 0
          ? 0
          : openAnswers.reduce((sum, a) => sum + a.answerText.split(/\s+/).filter(Boolean).length, 0) /
            openAnswers.length;
      const confidence = deriveScoreConfidence({
        answeredCount: screenResult.answeredCount,
        totalCount: screenResult.totalCount,
        method: screenResult.method,
        avgOpenWords,
        hasOpenQuestions: openAnswers.length > 0,
      });
      screenSummary = {
        strengths: screenResult.strengths,
        redFlags: screenResult.redFlags,
        recommendedAction: deriveRecommendedAction(screenScore, screenStatus, risk.level),
        strongDims: screenResult.strongDims,
        weakDims: screenResult.weakDims,
        method: screenResult.method,
        confidence: confidence.level,
      };
    } else {
      screenSummary = {
        strengths: [],
        redFlags: [],
        recommendedAction: deriveRecommendedAction(screenScore, screenStatus, risk.level),
        strongDims: [],
        weakDims: [],
        method: "heuristic",
      };
    }

    const application = createApplication({
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
      match_method: matchMethod,
      applicant_location: applicantLocation,
      desired_pay: desiredPay,
      screen_status: screenStatus,
      screen_score: screenScore,
      screen_outcome: screenOutcome,
      risk_level: risk.level,
      risk_flags: risk.flags,
      screen_summary: screenSummary,
    });

    if (screenResult) {
      try {
        saveScreenSubmission({
          organizationId: organization.id,
          applicationId: application.id,
          jobId: job.id,
          screenKey: job.screen_key,
          answers: screenAnswers,
          result: screenResult,
        });
        recordCandidateEvent({
          organization_id: organization.id,
          application_id: application.id,
          type: "note",
          detail: `Completed the ${screen?.shortLabel ?? "skills"} screen — scored ${screenScore}/100.`,
          actor: name,
        });
      } catch (subError) {
        console.error("Saving screen submission failed (application still saved):", subError);
      }
    }

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

    // Confirmation to the candidate — also fire-and-forget.
    void sendApplicantConfirmationEmail({
      organization,
      job,
      applicantName: name,
      applicantEmail: email,
    }).catch((emailError) => {
      console.error("Applicant confirmation email failed:", emailError);
    });

    // Applicant-safe report card — the tradesperson sees their own result the
    // moment they submit (ends the application black hole and rewards the real
    // effort). Never exposes red flags, risk, rationale, or answer keys.
    const report =
      screenResult && screenStatus === "completed"
        ? {
            score: screenResult.overallScore,
            dimensions: (Object.entries(screenResult.dimensionScores) as [ScreenDimension, number][])
              .map(([dim, value]) => ({ label: DIMENSION_LABELS[dim], score: value }))
              .sort((a, b) => b.score - a.score),
            strengths: screenResult.strengths.filter((s) => /^Strong/i.test(s)),
          }
        : null;

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error("Application failed:", error);
    return NextResponse.json(
      { error: "Failed to submit application. Please try again." },
      { status: 500 },
    );
  }
}
