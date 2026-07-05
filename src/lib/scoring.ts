import { extractSkills } from "./skills";

export type ScoreResult = {
  /** 0–100 match score, or null when the job has no recognizable skills to match against. */
  score: number | null;
  /** Canonical skills present in both the job description and the resume. */
  matchedSkills: string[];
  /** Job skills the resume does not mention. */
  missingSkills: string[];
  /** All canonical skills detected in the resume. */
  resumeSkills: string[];
  method: "heuristic" | "llm";
};

export type ScoreInput = {
  resumeText: string;
  jobTitle: string;
  jobDescription: string;
};

/**
 * Offline skill-overlap scorer.
 *
 * Derives the job's target skills from its title + description, then scores the
 * resume by how many of those skills it demonstrates. Deterministic and fully
 * offline — no external calls.
 */
export function scoreResumeHeuristic(input: ScoreInput): ScoreResult {
  const resumeSkills = extractSkills(input.resumeText);
  const jobSkills = extractSkills(`${input.jobTitle} ${input.jobDescription}`);

  const resumeSet = new Set(resumeSkills);
  const matchedSkills = jobSkills.filter((skill) => resumeSet.has(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSet.has(skill));

  // No recognizable skills in the JD → nothing meaningful to score against.
  if (jobSkills.length === 0) {
    return { score: null, matchedSkills, missingSkills, resumeSkills, method: "heuristic" };
  }

  const score = Math.round((matchedSkills.length / jobSkills.length) * 100);
  return { score, matchedSkills, missingSkills, resumeSkills, method: "heuristic" };
}

/**
 * Scores a resume against a job.
 *
 * Extension point: when an LLM provider is configured (e.g. ANTHROPIC_API_KEY),
 * a higher-quality semantic scorer can be plugged in here and fall back to the
 * heuristic on error or when the key is absent. Today it always uses the
 * offline heuristic, so behaviour is unchanged without configuration.
 */
export async function scoreResume(input: ScoreInput): Promise<ScoreResult> {
  return scoreResumeHeuristic(input);
}
