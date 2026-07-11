import type { Job } from "./db";

/**
 * Candidate risk + recommendation layer. Turns the raw skills score, resume
 * signal, and applicant-supplied context (desired pay, home location) into the
 * risk flags, risk level, recommended next step, and card badges a recruiter
 * scans first — the "should I spend an interview on this person?" answer.
 */

export type RiskFlagKey = "pay_mismatch" | "commute_risk" | "job_hop" | "overqualified";
export type RiskLevel = "low" | "medium" | "high";

export type RiskFlag = { key: RiskFlagKey; label: string; detail: string; severity: "medium" | "high" };

export type RiskAssessment = {
  flags: RiskFlag[];
  level: RiskLevel;
};

const FLAG_LABELS: Record<RiskFlagKey, string> = {
  pay_mismatch: "Pay mismatch risk",
  commute_risk: "Commute risk",
  job_hop: "Job-hop pattern",
  overqualified: "Overqualified — flight risk",
};

function parsePay(value: string): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  let n = Number.parseFloat(digits);
  if (!Number.isFinite(n)) return null;
  // Treat small numbers as an hourly rate → annualize for comparison.
  if (n > 0 && n < 200) n = n * 2080;
  return Math.round(n);
}

/**
 * Counts short employment stints in resume text by pairing up 4-digit years in
 * "20xx–20xx" style ranges. Rough by design — a strong signal, not proof.
 */
function countShortStints(resumeText: string): number {
  if (!resumeText) return 0;
  const ranges = resumeText.match(/(19|20)\d{2}\s*[–\-—to]{1,3}\s*((19|20)\d{2}|present|current)/gi) ?? [];
  let short = 0;
  for (const range of ranges) {
    const years = range.match(/(19|20)\d{2}/g);
    if (!years) continue;
    const start = Number(years[0]);
    const end = years[1] ? Number(years[1]) : new Date(0).getFullYear(); // "present" handled leniently below
    const span = /present|current/i.test(range) ? 3 : Math.max(0, end - start);
    if (span > 0 && span < 2) short++;
  }
  return short;
}

export function assessRisk(input: {
  job: Pick<Job, "salary_max" | "salary_min" | "city" | "state" | "location">;
  desiredPay?: string;
  applicantLocation?: string;
  resumeText?: string;
  /** Screen overall score, if completed — used only for the overqualified check. */
  screenScore?: number | null;
  jobIsLeadRole?: boolean;
  candidateIsLead?: boolean;
}): RiskAssessment {
  const flags: RiskFlag[] = [];

  // Pay mismatch — desired materially above the posted ceiling.
  const desired = parsePay(input.desiredPay ?? "");
  if (desired && input.job.salary_max && desired > input.job.salary_max * 1.08) {
    const over = Math.round(((desired - input.job.salary_max) / input.job.salary_max) * 100);
    flags.push({
      key: "pay_mismatch",
      label: FLAG_LABELS.pay_mismatch,
      detail: `Wants ~$${desired.toLocaleString()}; posting tops out at $${input.job.salary_max.toLocaleString()} (${over}% over).`,
      severity: over >= 20 ? "high" : "medium",
    });
  }

  // Commute / relocation — home location doesn't match the job's city/state.
  const home = (input.applicantLocation ?? "").trim().toLowerCase();
  const jobCity = (input.job.city ?? "").toLowerCase();
  const jobState = (input.job.state ?? "").toLowerCase();
  const jobLoc = (input.job.location ?? "").toLowerCase();
  if (home && !/remote/.test(jobLoc)) {
    const near =
      (jobCity && home.includes(jobCity)) ||
      (jobState && (home.includes(jobState) || new RegExp(`\\b${jobState}\\b`).test(home)));
    if (!near) {
      flags.push({
        key: "commute_risk",
        label: FLAG_LABELS.commute_risk,
        detail: `Lists "${input.applicantLocation}" — outside the ${input.job.location} area. Confirm commute or relocation.`,
        severity: "medium",
      });
    }
  }

  // Job-hop pattern from resume history.
  const shortStints = countShortStints(input.resumeText ?? "");
  if (shortStints >= 3) {
    flags.push({
      key: "job_hop",
      label: FLAG_LABELS.job_hop,
      detail: `${shortStints} jobs under ~2 years each in the resume. Ask why each ended.`,
      severity: shortStints >= 4 ? "high" : "medium",
    });
  }

  // Overqualified — a supervisor-level candidate applying to a tech role.
  if (input.candidateIsLead && !input.jobIsLeadRole) {
    flags.push({
      key: "overqualified",
      label: FLAG_LABELS.overqualified,
      detail: "Supervisor/lead background applying to a technician role — confirm they want hands-on work and will stay.",
      severity: "medium",
    });
  }

  const level: RiskLevel = flags.some((f) => f.severity === "high")
    ? "high"
    : flags.length >= 2
      ? "high"
      : flags.length === 1
        ? "medium"
        : "low";

  return { flags, level };
}

/**
 * The single recommended next step, combining screen fit and risk. This is the
 * line a recruiter acts on.
 */
export function deriveRecommendedAction(
  screenScore: number | null,
  screenStatus: string,
  risk: RiskLevel,
): string {
  if (screenStatus === "skipped") return "Resume only — send a skills screen or verify ability on the phone screen";
  if (screenStatus === "none") return "No screen attached — review resume and phone screen";
  if (screenStatus === "pending") return "Screen sent — nudge the candidate or phone screen";
  if (screenScore === null) return "Phone screen to confirm ability";

  if (screenScore >= 70) {
    if (risk === "high") return "Strong on the screen, but verify pay/commute before booking time";
    return "Call first — strong practical signal";
  }
  if (screenScore >= 45) {
    return risk === "high" ? "Phone screen and clear the risk flags first" : "Phone screen to confirm";
  }
  return "Likely reject — weak on the practical screen";
}

// ─── Card badges ────────────────────────────────────────────────────────────
export type BadgeTone = "good" | "warn" | "bad" | "muted";
export type Badge = { label: string; tone: BadgeTone };

/**
 * Compact snapshot stored on the application at scoring time so list views and
 * pipeline cards can render badges without loading the full submission.
 */
export type ScreenSummary = {
  strengths: string[];
  redFlags: string[];
  recommendedAction: string;
  /** Dimension keys (see ScreenDimension) that scored strong / weak. */
  strongDims: string[];
  weakDims: string[];
  method: "llm" | "heuristic";
  /** How much to trust this score (see deriveScoreConfidence). Optional for older rows. */
  confidence?: ConfidenceLevel;
};

export function emptyScreenSummary(): ScreenSummary {
  return { strengths: [], redFlags: [], recommendedAction: "", strongDims: [], weakDims: [], method: "heuristic" };
}

// ─── Score confidence ───────────────────────────────────────────────────────
export type ConfidenceLevel = "high" | "medium" | "low";
export type ScoreConfidence = { level: ConfidenceLevel; reason: string };

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/**
 * Not every score is an equally safe bet. A 74 from a fully-answered, substantive
 * screen and a 74 from three one-word answers are different — this surfaces which
 * to act on and which to verify by phone. Signals: how much was answered, how
 * substantive the written answers were, and whether opens were AI- or
 * offline-graded. Deterministic.
 */
export function deriveScoreConfidence(input: {
  answeredCount: number;
  totalCount: number;
  method: "llm" | "heuristic";
  /** Average word count across the open (short-answer/scenario) answers. */
  avgOpenWords: number;
  /** Whether the screen had any open questions at all. */
  hasOpenQuestions: boolean;
}): ScoreConfidence {
  const ratio = input.totalCount === 0 ? 0 : input.answeredCount / input.totalCount;

  if (ratio < 0.6) {
    return { level: "low", reason: `Only ${input.answeredCount} of ${input.totalCount} answered` };
  }
  if (input.hasOpenQuestions && input.avgOpenWords < 6) {
    return { level: "low", reason: "Written answers were very thin" };
  }
  // Prose graded offline (no LLM) is rougher than AI rubric grading, so a
  // full, substantive screen with written answers tops out at medium unless the
  // opens were AI-graded — high is reserved for the most trustworthy scores.
  const graderTrusted = !input.hasOpenQuestions || input.method === "llm";
  if (ratio >= 0.9 && (!input.hasOpenQuestions || input.avgOpenWords >= 12) && graderTrusted) {
    return { level: "high", reason: "Complete and substantive" };
  }
  if (ratio >= 0.9 && input.hasOpenQuestions && input.avgOpenWords >= 12 && !graderTrusted) {
    return { level: "medium", reason: "Complete, but written answers were graded offline — spot-check by phone" };
  }
  return { level: "medium", reason: "Some answers were brief or partial" };
}

export type BadgeInput = {
  screenStatus: string;
  screenScore: number | null;
  matchScore: number | null;
  riskLevel: RiskLevel;
  riskFlags: Pick<RiskFlag, "label">[];
  summary: ScreenSummary;
};

/**
 * Derives the badges shown on a candidate card, most-decision-relevant first.
 */
export function deriveBadges(input: BadgeInput): Badge[] {
  const badges: Badge[] = [];
  const { screenStatus, screenScore, matchScore, riskFlags, summary } = input;

  if (screenStatus === "completed" && screenScore !== null) {
    if (screenScore >= 70) {
      const strongTs = summary.strongDims.includes("troubleshooting");
      badges.push({ label: strongTs ? "Strong troubleshooting signal" : "Strong screen score", tone: "good" });
    } else if (screenScore < 40) {
      badges.push({ label: "Reject / low fit", tone: "bad" });
    }

    // "Looks good on paper only" — high resume keyword match but failed the screen.
    if (matchScore !== null && matchScore >= 55 && screenScore < 45) {
      badges.push({ label: "Resume keyword match only", tone: "warn" });
    }

    for (const dim of summary.weakDims) {
      if (dim === "electrical") badges.push({ label: "Weak electrical fundamentals", tone: "bad" });
      if (dim === "safety") badges.push({ label: "Weak safety judgment", tone: "bad" });
    }
  } else if (screenStatus === "skipped") {
    badges.push({ label: "Resume only", tone: "muted" });
  } else if (screenStatus === "pending") {
    badges.push({ label: "Screen sent — awaiting", tone: "muted" });
  } else if (screenStatus === "none") {
    badges.push({ label: "No screen", tone: "muted" });
  }

  for (const flag of riskFlags) {
    badges.push({ label: flag.label, tone: "warn" });
  }

  // Action badge last.
  if (screenStatus === "completed" && screenScore !== null) {
    if (screenScore >= 70 && input.riskLevel === "low") badges.push({ label: "Call first", tone: "good" });
    else if (screenScore >= 45 && screenScore < 70) badges.push({ label: "Needs phone screen", tone: "muted" });
  }

  // De-dupe by label, keep first (priority) occurrence.
  const seen = new Set<string>();
  return badges.filter((b) => (seen.has(b.label) ? false : (seen.add(b.label), true))).slice(0, 6);
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Some risk",
  high: "High risk",
};

// ─── "Why this candidate?" ────────────────────────────────────────────────────

const VERIFY_BY_RISK: Record<RiskFlagKey, string> = {
  pay_mismatch: "Confirm the pay range works long-term — pay gaps are the #1 reason good trades hires walk.",
  commute_risk: "Confirm the commute, or a genuine willingness to relocate for shift work.",
  job_hop: "Ask why each recent job ended and what would make them stay.",
  overqualified: "Confirm they want hands-on work and won't leave the bench when a lead role opens.",
};

const ASK_HM_BY_RISK: Record<RiskFlagKey, string> = {
  pay_mismatch: "Any flexibility on the pay range for a candidate who proved the hands-on skills?",
  commute_risk: "Is relocation support or a schedule tweak on the table for the right person?",
  job_hop: "How much runway before this role has to be self-sufficient?",
  overqualified: "Is there a growth path that keeps a lead-caliber person engaged?",
};

export type WhyThisCandidate = {
  recommendedAction: string;
  whyStrong: string[];
  whyRisky: string[];
  verifyOnPhone: string[];
  askHiringManager: string[];
};

/**
 * The recruiter-facing "should I call this person, and what do I probe?" answer,
 * composed from the stored screen summary + risk assessment. Deterministic — no
 * LLM — so it renders instantly and never contradicts the badges.
 */
export function buildWhyThisCandidate(input: {
  screenScore: number | null;
  screenStatus: string;
  matchScore: number | null;
  riskLevel: RiskLevel;
  riskFlags: Array<{ key: string; label: string; detail: string }>;
  summary: ScreenSummary | null;
}): WhyThisCandidate {
  const { screenScore, screenStatus, matchScore, riskLevel, riskFlags, summary } = input;

  const recommendedAction =
    summary?.recommendedAction?.trim() || deriveRecommendedAction(screenScore, screenStatus, riskLevel);

  const whyStrong: string[] = [...(summary?.strengths ?? [])];
  if (whyStrong.length === 0) {
    if (screenStatus === "completed" && screenScore !== null && screenScore >= 70) {
      whyStrong.push(`Scored ${screenScore}/100 on the practical skills screen`);
    }
    if (summary?.strongDims?.includes("troubleshooting")) {
      whyStrong.push("Strong troubleshooting signal on the screen");
    }
  }

  const whyRisky: string[] = [
    ...riskFlags.map((f) => f.detail || f.label),
    ...(summary?.redFlags ?? []),
  ];

  const verifyOnPhone: string[] = [];
  for (const flag of riskFlags) {
    verifyOnPhone.push(VERIFY_BY_RISK[flag.key as RiskFlagKey] ?? `Verify: ${flag.label.toLowerCase()}.`);
  }
  if (matchScore !== null && screenScore !== null && matchScore >= 55 && screenScore < 45) {
    verifyOnPhone.push("Resume reads stronger than the demonstrated screen — verify hands-on ability by phone.");
  }
  if (screenStatus !== "completed") {
    verifyOnPhone.push("No completed skills screen yet — run a short phone screen to confirm practical ability.");
  }
  if (verifyOnPhone.length === 0) {
    verifyOnPhone.push("No specific red flags surfaced — a standard reference check should suffice.");
  }

  const askHiringManager: string[] = [];
  for (const flag of riskFlags) {
    const q = ASK_HM_BY_RISK[flag.key as RiskFlagKey];
    if (q) askHiringManager.push(q);
  }
  if (whyStrong.length > 0) {
    askHiringManager.push(`Does "${whyStrong[0]}" match what the crew needs most right now?`);
  } else {
    askHiringManager.push("What does success in the first 90 days look like for this role?");
  }

  const dedupe = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  return {
    recommendedAction,
    whyStrong: dedupe(whyStrong).slice(0, 5),
    whyRisky: dedupe(whyRisky).slice(0, 5),
    verifyOnPhone: dedupe(verifyOnPhone).slice(0, 5),
    askHiringManager: dedupe(askHiringManager).slice(0, 4),
  };
}

export function normalizeRiskLevel(value: string): RiskLevel {
  return value === "high" || value === "medium" ? value : "low";
}

/** Convenience: derives card badges straight from a stored application row. */
export function badgesForApplication(app: {
  screen_status: string;
  screen_score: number | null;
  match_score: number | null;
  risk_level: string;
  risk_flags: Pick<RiskFlag, "label">[];
  screen_summary: ScreenSummary | null;
}): Badge[] {
  return deriveBadges({
    screenStatus: app.screen_status,
    screenScore: app.screen_score,
    matchScore: app.match_score,
    riskLevel: normalizeRiskLevel(app.risk_level),
    riskFlags: app.risk_flags,
    summary: app.screen_summary ?? emptyScreenSummary(),
  });
}
