import { completeJson, isLlmConfigured } from "./anthropic";
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

const LLM_SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", description: "0-100 overall match score" },
    matchedSkills: {
      type: "array",
      items: { type: "string" },
      description: "Key skills/requirements the candidate clearly meets",
    },
    missingSkills: {
      type: "array",
      items: { type: "string" },
      description: "Key skills/requirements the candidate appears to lack",
    },
  },
  required: ["score", "matchedSkills", "missingSkills"],
} as const;

type LlmScore = { score: number; matchedSkills: string[]; missingSkills: string[] };

// Keep prompt inputs bounded so token usage stays predictable.
function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * LLM-backed semantic scorer. Higher quality than the keyword heuristic because
 * it reasons about the whole resume against the whole JD. The stored
 * `resumeSkills` still come from the deterministic dictionary so the candidate
 * search/pool stay consistent; only the score + matched/missing come from Claude.
 */
async function scoreResumeLlm(input: ScoreInput): Promise<ScoreResult> {
  const result = await completeJson<LlmScore>({
    system:
      "You are an expert technical recruiter. Score how well a candidate's resume matches a job. " +
      "Be objective and specific. Return only the requested JSON.",
    prompt: [
      `JOB TITLE: ${input.jobTitle}`,
      "",
      "JOB DESCRIPTION:",
      clamp(input.jobDescription, 6000),
      "",
      "CANDIDATE RESUME:",
      clamp(input.resumeText, 8000),
      "",
      "Score 0-100 how well this candidate matches the job. List the key skills/requirements they clearly meet (matchedSkills) and the important ones they appear to lack (missingSkills).",
    ].join("\n"),
    schema: LLM_SCORE_SCHEMA,
    maxTokens: 1024,
  });

  const score = Math.max(0, Math.min(100, Math.round(result.score)));
  return {
    score,
    matchedSkills: Array.isArray(result.matchedSkills) ? result.matchedSkills : [],
    missingSkills: Array.isArray(result.missingSkills) ? result.missingSkills : [],
    resumeSkills: extractSkills(input.resumeText),
    method: "llm",
  };
}

/**
 * Scores a resume against a job. Uses the Claude-backed scorer when
 * ANTHROPIC_API_KEY is configured, falling back to the offline heuristic when
 * it is absent or the API call fails — so behaviour is graceful either way.
 */
export async function scoreResume(input: ScoreInput): Promise<ScoreResult> {
  if (isLlmConfigured() && input.resumeText.trim()) {
    try {
      return await scoreResumeLlm(input);
    } catch (error) {
      console.error("LLM scoring failed, falling back to heuristic:", error);
    }
  }
  return scoreResumeHeuristic(input);
}
