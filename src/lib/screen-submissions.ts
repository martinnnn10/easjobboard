import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { PerAnswer, ScreenResult } from "./screen-scoring";
import type { ScreenAnswers } from "./screen-scoring";
import type { ScreenDimension } from "./screens";

/**
 * Persistence for the detailed per-application screen submission — the full
 * answers, per-answer AI rationale, dimension breakdown, and interview
 * follow-ups shown on the candidate detail page. The compact summary that
 * drives cards/lists lives denormalized on the application row instead.
 */

export type ScreenSubmission = {
  id: string;
  applicationId: string;
  jobId: string;
  screenKey: string;
  answers: ScreenAnswers;
  overallScore: number | null;
  dimensionScores: Partial<Record<ScreenDimension, number>>;
  perAnswer: PerAnswer[];
  followUpQuestions: string[];
  method: string;
  createdAt: string;
};

export function saveScreenSubmission(input: {
  organizationId: string;
  applicationId: string;
  jobId: string;
  screenKey: string;
  answers: ScreenAnswers;
  result: ScreenResult;
}): void {
  getDb()
    .prepare(
      `INSERT INTO screen_submissions (
        id, organization_id, application_id, job_id, screen_key, answers,
        overall_score, dimension_scores, per_answer, follow_up_questions, method, created_at
      ) VALUES (
        @id, @organization_id, @application_id, @job_id, @screen_key, @answers,
        @overall_score, @dimension_scores, @per_answer, @follow_up_questions, @method, @created_at
      )`,
    )
    .run({
      id: randomUUID(),
      organization_id: input.organizationId,
      application_id: input.applicationId,
      job_id: input.jobId,
      screen_key: input.screenKey,
      answers: JSON.stringify(input.answers),
      overall_score: input.result.overallScore,
      dimension_scores: JSON.stringify(input.result.dimensionScores),
      per_answer: JSON.stringify(input.result.perAnswer),
      follow_up_questions: JSON.stringify(input.result.followUpQuestions),
      method: input.result.method,
      created_at: new Date().toISOString(),
    });
}

function parse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getScreenSubmission(applicationId: string, organizationId: string): ScreenSubmission | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM screen_submissions
       WHERE application_id = ? AND organization_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(applicationId, organizationId) as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    jobId: row.job_id as string,
    screenKey: row.screen_key as string,
    answers: parse<ScreenAnswers>(row.answers, {}),
    overallScore: row.overall_score == null ? null : Number(row.overall_score),
    dimensionScores: parse<Partial<Record<ScreenDimension, number>>>(row.dimension_scores, {}),
    perAnswer: parse<PerAnswer[]>(row.per_answer, []),
    followUpQuestions: parse<string[]>(row.follow_up_questions, []),
    method: (row.method as string) ?? "heuristic",
    createdAt: row.created_at as string,
  };
}
