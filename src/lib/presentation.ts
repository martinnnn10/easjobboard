import { getApplicationDetail } from "./applications";
import { buildWhyThisCandidate, normalizeRiskLevel } from "./candidate-intel";
import { listEventsByCandidate } from "./candidate-events";
import { getCandidateWithApplications } from "./candidates";
import type { JobAccess } from "./job-visibility";
import { getJobById } from "./jobs";
import { getScreenSubmission } from "./screen-submissions";

/**
 * Assembles a client-ready candidate submission from the stored intelligence —
 * the branded write-up an agency recruiter sends a hiring manager. All fields
 * come from data already captured; the UI decides what to redact.
 */
export type PresentationData = {
  orgName: string;
  candidateId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  title: string;
  company: string;
  targetRole: string;
  compExpectation: string;
  shiftNote: string;
  relocationNote: string;
  summary: string;
  whyFit: string[];
  skillsScore: number | null;
  troubleshootingEvidence: string[];
  strongSignals: string[];
  risks: string[];
  interviewQuestions: string[];
  recruiterNotes: string[];
  skills: string[];
  resumePath: string | null;
  resumeFilename: string;
};

export function buildPresentation(
  orgSlug: string,
  orgId: string,
  orgName: string,
  candidateId: string,
  access?: JobAccess,
): PresentationData | null {
  const candidate = getCandidateWithApplications(candidateId, orgId, access);
  if (!candidate) return null;

  const primary =
    candidate.applications.reduce<(typeof candidate.applications)[number] | null>((best, a) => {
      if (a.screenScore === null) return best;
      if (!best || best.screenScore === null || a.screenScore > best.screenScore) return a;
      return best;
    }, candidate.applications[0] ?? null) ?? candidate.applications[0] ?? null;

  const detail = primary ? getApplicationDetail(primary.applicationId, orgId, access) : null;
  const submission = primary ? getScreenSubmission(primary.applicationId, orgId) : null;

  const why = detail
    ? buildWhyThisCandidate({
        screenScore: detail.screen_score,
        screenStatus: detail.screen_status,
        matchScore: detail.match_score,
        riskLevel: normalizeRiskLevel(detail.risk_level),
        riskFlags: detail.risk_flags,
        summary: detail.screen_summary,
      })
    : null;

  const interviewQuestions = (() => {
    if (!submission) return [] as string[];
    const out: string[] = [];
    for (const a of submission.perAnswer) if (a.score < 70 && a.followUp) out.push(a.followUp);
    for (const q of submission.followUpQuestions) out.push(q);
    return [...new Set(out)].slice(0, 5);
  })();

  const troubleshootingEvidence = (() => {
    if (submission) {
      const strong = submission.perAnswer
        .filter((a) => a.score >= 70 && a.answerText)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((a) => `${a.prompt} — scored ${a.score}/100`);
      if (strong.length > 0) return strong;
    }
    return why?.whyStrong ?? [];
  })();

  const recruiterNotes = listEventsByCandidate(candidateId, orgId)
    .filter((e) => e.type === "note")
    .slice(0, 3)
    .map((e) => e.detail);

  const nameParts = (candidate.name || candidate.email).trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

  const risks = [...(why?.whyRisky ?? []), ...(why?.verifyOnPhone ?? [])];

  // Shift / relocation come from the target job's requirements when available.
  const job = detail ? getJobById(detail.job_id) : null;

  // Resume: the application's if they applied, else a candidate-level upload.
  const hasCandidateResume = Boolean(candidate.resume_filename);
  const resumePath = primary
    ? `/api/o/${orgSlug}/applications/${primary.applicationId}/resume`
    : hasCandidateResume
      ? `/api/o/${orgSlug}/candidates/${candidateId}/resume`
      : null;
  const resumeFilename = primary?.resumeFilename || candidate.resume_filename || "";

  return {
    orgName,
    candidateId,
    fullName: candidate.name || candidate.email,
    firstName,
    lastName,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location,
    title: candidate.title,
    company: candidate.company,
    targetRole: primary?.jobTitle ?? "",
    compExpectation: detail?.desired_pay ?? "",
    shiftNote: job?.shift ?? "",
    relocationNote: job?.relocation ?? "",
    summary: why?.recommendedAction ?? "",
    whyFit: why?.whyStrong ?? [],
    skillsScore: detail?.screen_score ?? candidate.bestScreenScore,
    troubleshootingEvidence,
    strongSignals: why?.whyStrong ?? [],
    risks: [...new Set(risks)].slice(0, 6),
    interviewQuestions,
    recruiterNotes,
    skills: candidate.skills,
    resumePath,
    resumeFilename,
  };
}
