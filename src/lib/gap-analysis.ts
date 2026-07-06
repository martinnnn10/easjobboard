import { DIMENSION_LABELS, backingDimension } from "./screens";
import type { ScreenSubmission } from "./screen-submissions";

/**
 * The product thesis made physical: what a candidate CLAIMS (resume keyword
 * match) vs what they DEMONSTRATED (the practical screen). Every keyword ATS
 * ranks exactly the inflated resumes this exposes; none can produce a
 * demonstrated-skill number to contrast against. Deterministic, no LLM.
 */

// A candidate looks strong on paper but failed the hands-on screen.
const PAPER_STRONG = 55; // resume keyword match at/above this reads as "great fit"
const PROOF_WEAK = 45; // screen score below this reads as "can't do the job"

type GapInput = {
  screen_status: string;
  screen_score: number | null;
  match_score: number | null;
};

/** True when the resume oversells: strong keyword match, weak demonstrated ability. */
export function isResumeTrap(app: GapInput): boolean {
  return (
    app.screen_status === "completed" &&
    app.screen_score !== null &&
    app.match_score !== null &&
    app.match_score >= PAPER_STRONG &&
    app.screen_score < PROOF_WEAK
  );
}

/** How badly the resume oversold — bigger gap first. */
export function trapSeverity(app: GapInput): number {
  if (app.match_score === null || app.screen_score === null) return 0;
  return app.match_score - app.screen_score;
}

export function resumeTrapCandidates<T extends GapInput>(apps: T[]): T[] {
  return apps.filter(isResumeTrap).sort((a, b) => trapSeverity(b) - trapSeverity(a));
}

export type CandidateGap = {
  resumeMatch: number | null;
  screenScore: number | null;
  backingLabel: string;
  backingScore: number | null;
  /** "trap" (paper » proof), "sleeper" (proof » paper), or "aligned". */
  verdict: "trap" | "sleeper" | "aligned";
};

/**
 * The claim-vs-proof contrast for one candidate. Uses the role's backing
 * dimension when a submission is available, else the overall screen score.
 */
export function candidateGap(
  app: { screen_score: number | null; match_score: number | null },
  screenKey: string,
  submission?: ScreenSubmission | null,
): CandidateGap {
  const dim = backingDimension(screenKey);
  const backingScore =
    submission?.dimensionScores?.[dim] ?? (app.screen_score ?? null);
  const proof = app.screen_score;
  const paper = app.match_score;

  // "trap" uses the SAME thresholds as isResumeTrap / the dashboard hero, so the
  // two surfaces can never disagree about who is a resume trap.
  let verdict: CandidateGap["verdict"] = "aligned";
  if (paper !== null && paper >= PAPER_STRONG && proof !== null && proof < PROOF_WEAK) {
    verdict = "trap";
  } else if (proof !== null && (paper === null ? proof >= 60 : proof - paper >= 20)) {
    verdict = "sleeper";
  }

  return {
    resumeMatch: paper,
    screenScore: proof,
    backingLabel: DIMENSION_LABELS[dim],
    backingScore,
    verdict,
  };
}

export const GAP_VERDICT_COPY: Record<CandidateGap["verdict"], string> = {
  trap: "Looks great on paper — can't back it up on the floor",
  sleeper: "Undersells on paper — proved it on the screen",
  aligned: "Resume and demonstrated ability line up",
};
