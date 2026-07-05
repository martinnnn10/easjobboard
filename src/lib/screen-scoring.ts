import { completeJson, isLlmConfigured } from "./anthropic";
import {
  DIMENSION_LABELS,
  getScreen,
  type ScreenDimension,
  type ScreenQuestion,
  type ScreenTemplate,
} from "./screens";

/**
 * Turns a candidate's screen answers into a 0–100 skills score plus a
 * dimension breakdown, per-answer rationale, strengths, red flags, and
 * interview follow-ups. Deterministic for multiple-choice / ranking /
 * experience questions; rubric-based (LLM when configured, otherwise an
 * offline keyword-point grader) for short-answer and scenario questions.
 *
 * The grader deliberately does not reward keyword stuffing: an answer scores by
 * how many distinct practical points it demonstrates and how substantive it is,
 * not by how many buzzwords it contains.
 */

/** Raw answer value as submitted: text, a chosen option index, or ranking ids. */
export type ScreenAnswerValue = string | number | string[];
export type ScreenAnswers = Record<string, ScreenAnswerValue>;

export type PerAnswer = {
  questionId: string;
  type: ScreenQuestion["type"];
  dimension: ScreenDimension;
  prompt: string;
  answerText: string;
  answered: boolean;
  score: number;
  rationale: string;
  redFlags: string[];
  strongSignals: string[];
  followUp: string;
};

export type ScreenResult = {
  method: "llm" | "heuristic";
  overallScore: number;
  dimensionScores: Partial<Record<ScreenDimension, number>>;
  perAnswer: PerAnswer[];
  strengths: string[];
  redFlags: string[];
  strongDims: ScreenDimension[];
  weakDims: ScreenDimension[];
  followUpQuestions: string[];
  answeredCount: number;
  totalCount: number;
};

const STRONG = 70;
const WEAK = 45;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function answerToText(question: ScreenQuestion, value: ScreenAnswerValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (question.type === "multiple_choice" || question.type === "experience") {
    const index = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(index) && question.options?.[index]) return question.options[index];
    return "";
  }
  if (question.type === "ranking") {
    const ids = Array.isArray(value) ? value : [];
    const byId = new Map((question.items ?? []).map((item) => [item.id, item.text]));
    return ids.map((id) => byId.get(id)).filter(Boolean).join(" → ");
  }
  return typeof value === "string" ? value.trim() : String(value);
}

// ─── Deterministic scorers ─────────────────────────────────────────────────
function scoreMultipleChoice(q: ScreenQuestion, value: ScreenAnswerValue | undefined): Omit<PerAnswer, "questionId" | "type" | "dimension" | "prompt" | "answerText" | "answered"> {
  const index = typeof value === "number" ? value : Number(value);
  const correct = Number.isInteger(index) && index === q.correctIndex;
  if (!Number.isInteger(index) || index < 0) {
    return { score: 0, rationale: "No answer selected.", redFlags: ["Left unanswered"], strongSignals: [], followUp: "" };
  }
  if (correct) {
    return {
      score: 100,
      rationale: "Chose the correct diagnosis.",
      redFlags: [],
      strongSignals: ["Correct on a practical judgment question"],
      followUp: "",
    };
  }
  return {
    score: 12,
    rationale: `Chose an incorrect answer; the correct approach was: “${q.options?.[q.correctIndex ?? 0] ?? ""}”.`,
    redFlags: ["Incorrect on a basic judgment question"],
    strongSignals: [],
    followUp: q.followUpIfWeak ?? "",
  };
}

function scoreExperience(q: ScreenQuestion, value: ScreenAnswerValue | undefined) {
  const index = typeof value === "number" ? value : Number(value);
  const score = Number.isInteger(index) && q.optionScores?.[index] !== undefined ? q.optionScores[index] : 0;
  const label = q.options?.[index] ?? "not provided";
  const redFlags = score <= 35 ? ["Little relevant hands-on experience"] : [];
  const strongSignals = score >= 85 ? ["Deep relevant experience"] : [];
  return {
    score: clampScore(score),
    rationale: `Reported experience: ${label}.`,
    redFlags,
    strongSignals,
    followUp: "",
  };
}

function scoreRanking(q: ScreenQuestion, value: ScreenAnswerValue | undefined) {
  const correctOrder = (q.items ?? []).map((item) => item.id);
  const given = Array.isArray(value) ? value : [];
  if (given.length !== correctOrder.length) {
    return { score: 0, rationale: "Ordering not completed.", redFlags: ["Left unanswered"], strongSignals: [], followUp: "" };
  }
  // Kendall-style concordance: fraction of ordered pairs the candidate got right.
  const rank = new Map(given.map((id, i) => [id, i]));
  let concordant = 0;
  let total = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    for (let j = i + 1; j < correctOrder.length; j++) {
      total++;
      const a = rank.get(correctOrder[i]);
      const b = rank.get(correctOrder[j]);
      if (a !== undefined && b !== undefined && a < b) concordant++;
    }
  }
  const score = clampScore(total === 0 ? 0 : (concordant / total) * 100);
  return {
    score,
    rationale: `Ordered ${concordant} of ${total} step-pairs correctly.`,
    redFlags: score < WEAK ? ["Weak grasp of correct troubleshooting/process sequence"] : [],
    strongSignals: score >= STRONG ? ["Sound process/troubleshooting sequence"] : [],
    followUp: score < STRONG ? q.followUpIfWeak ?? "" : "",
  };
}

// ─── Rubric scorers for open answers ───────────────────────────────────────
type OpenScore = { score: number; rationale: string; redFlags: string[]; strongSignals: string[]; followUp: string };

function scoreOpenHeuristic(q: ScreenQuestion, text: string): OpenScore {
  const answer = text.trim();
  const lower = answer.toLowerCase();
  const words = answer.split(/\s+/).filter(Boolean);
  const points = q.idealPoints ?? [];

  if (words.length < 3 || answer.length < 8) {
    return {
      score: 6,
      rationale: "No real answer provided.",
      redFlags: ["Did not answer the question"],
      strongSignals: [],
      followUp: q.followUpIfWeak ?? "",
    };
  }

  const matched = points.filter((p) => p.any.some((kw) => lower.includes(kw)));
  const ratio = points.length === 0 ? 0 : matched.length / points.length;
  let score = clampScore(ratio * 100);

  // Guardrail against keyword-stuffing / one-liners: a very short answer that
  // name-drops a term shouldn't score like a real explanation.
  if (words.length < 8) score = Math.min(score, 30);
  else if (words.length < 15 && ratio < 0.6) score = Math.min(score, 55);

  const strongSignals = matched.map((m) => m.label);
  const missing = points.filter((p) => !matched.includes(p)).map((m) => m.label);
  const redFlags: string[] = [];
  if (ratio === 0) redFlags.push("Vague or keyword-only — did not demonstrate real steps");
  else if (words.length < 8) redFlags.push("Answer too brief to judge real ability");

  const rationale =
    `Demonstrated ${matched.length} of ${points.length} key points` +
    (strongSignals.length ? ` (${strongSignals.join(", ")})` : "") +
    (missing.length ? `; did not address: ${missing.join(", ")}.` : ".");

  return {
    score,
    rationale,
    redFlags,
    strongSignals,
    followUp: score < STRONG ? q.followUpIfWeak ?? "" : "",
  };
}

const LLM_OPEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          questionId: { type: "string" },
          score: { type: "integer", description: "0-100 quality of the answer" },
          rationale: { type: "string", description: "1-2 sentences on why, referencing the rubric" },
          redFlags: { type: "array", items: { type: "string" } },
          strongSignals: { type: "array", items: { type: "string" } },
          followUp: { type: "string", description: "One targeted interview follow-up question" },
        },
        required: ["questionId", "score", "rationale", "redFlags", "strongSignals", "followUp"],
      },
    },
  },
  required: ["answers"],
} as const;

type LlmOpenAnswer = {
  questionId: string;
  score: number;
  rationale: string;
  redFlags: string[];
  strongSignals: string[];
  followUp: string;
};

async function scoreOpenAnswersLlm(
  template: ScreenTemplate,
  openQuestions: ScreenQuestion[],
  answers: ScreenAnswers,
): Promise<Map<string, OpenScore>> {
  const blocks = openQuestions.map((q, i) => {
    const idealPoints = (q.idealPoints ?? []).map((p) => `- ${p.label}`).join("\n");
    return [
      `QUESTION ${i + 1} [id: ${q.id}]`,
      `Prompt: ${q.prompt}`,
      `Rubric: ${q.rubric ?? "Judge practical correctness and real hands-on reasoning."}`,
      idealPoints ? `A strong answer covers:\n${idealPoints}` : "",
      `CANDIDATE ANSWER: ${answerToText(q, answers[q.id]) || "(blank)"}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const result = await completeJson<{ answers: LlmOpenAnswer[] }>({
    system:
      "You are a veteran plant maintenance manager grading a hands-on skills screen for manufacturing hiring " +
      "(maintenance, controls, and industrial electrical roles). Score each answer 0-100 on real troubleshooting " +
      "ability and practical correctness — NOT on keywords, buzzwords, or resume language. A confident but wrong or " +
      "vague answer must score low. A plain-spoken answer that shows the person can actually diagnose and fix the " +
      "problem must score high. Be strict and specific. Return only the requested JSON.",
    prompt: `Screen: ${template.label}\n\n${blocks.join("\n\n---\n\n")}`,
    schema: LLM_OPEN_SCHEMA,
    maxTokens: 2048,
  });

  const map = new Map<string, OpenScore>();
  for (const a of result.answers ?? []) {
    map.set(a.questionId, {
      score: clampScore(a.score),
      rationale: a.rationale ?? "",
      redFlags: Array.isArray(a.redFlags) ? a.redFlags : [],
      strongSignals: Array.isArray(a.strongSignals) ? a.strongSignals : [],
      followUp: a.followUp ?? "",
    });
  }
  return map;
}

// ─── Assembly ──────────────────────────────────────────────────────────────
function assemble(
  template: ScreenTemplate,
  answers: ScreenAnswers,
  openScores: Map<string, OpenScore>,
  method: "llm" | "heuristic",
): ScreenResult {
  const perAnswer: PerAnswer[] = [];

  for (const q of template.questions) {
    const raw = answers[q.id];
    const answerText = answerToText(q, raw);
    const answered = answerText.trim().length > 0;

    let base: OpenScore;
    if (q.type === "multiple_choice") base = scoreMultipleChoice(q, raw);
    else if (q.type === "experience") base = scoreExperience(q, raw);
    else if (q.type === "ranking") base = scoreRanking(q, raw);
    else base = openScores.get(q.id) ?? scoreOpenHeuristic(q, answerText);

    perAnswer.push({
      questionId: q.id,
      type: q.type,
      dimension: q.dimension,
      prompt: q.prompt,
      answerText,
      answered,
      score: base.score,
      rationale: base.rationale,
      redFlags: base.redFlags,
      strongSignals: base.strongSignals,
      followUp: base.followUp,
    });
  }

  // Weighted overall + per-dimension.
  const weightOf = (id: string) => template.questions.find((q) => q.id === id)?.weight ?? 1;
  let wsum = 0;
  let wtot = 0;
  const dimAgg = new Map<ScreenDimension, { s: number; w: number }>();
  for (const a of perAnswer) {
    const w = weightOf(a.questionId);
    wsum += a.score * w;
    wtot += w;
    const cur = dimAgg.get(a.dimension) ?? { s: 0, w: 0 };
    cur.s += a.score * w;
    cur.w += w;
    dimAgg.set(a.dimension, cur);
  }
  const overallScore = clampScore(wtot === 0 ? 0 : wsum / wtot);
  const dimensionScores: Partial<Record<ScreenDimension, number>> = {};
  const strongDims: ScreenDimension[] = [];
  const weakDims: ScreenDimension[] = [];
  for (const [dim, { s, w }] of dimAgg) {
    const v = clampScore(w === 0 ? 0 : s / w);
    dimensionScores[dim] = v;
    if (v >= STRONG) strongDims.push(dim);
    if (v < WEAK) weakDims.push(dim);
  }

  // Strengths, red flags, follow-ups.
  const strengths = uniq([
    ...strongDims.map((d) => `Strong ${DIMENSION_LABELS[d].toLowerCase()}`),
    ...perAnswer.filter((a) => a.score >= STRONG).flatMap((a) => a.strongSignals),
  ]).slice(0, 5);

  const redFlags = uniq([
    ...weakDims.map((d) => `Weak ${DIMENSION_LABELS[d].toLowerCase()}`),
    ...perAnswer.flatMap((a) => a.redFlags),
  ]).slice(0, 5);

  const followUpQuestions = uniq(
    perAnswer.filter((a) => a.score < STRONG).map((a) => a.followUp).filter((f) => f && f.length > 0),
  ).slice(0, 5);

  const answeredCount = perAnswer.filter((a) => a.answered).length;

  return {
    method,
    overallScore,
    dimensionScores,
    perAnswer,
    strengths,
    redFlags,
    strongDims,
    weakDims,
    followUpQuestions,
    answeredCount,
    totalCount: template.questions.length,
  };
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Fully offline, deterministic scoring (no LLM). Used by demo seeding so the
 * sample data ranks identically on every machine, and as the guaranteed
 * fallback path.
 */
export function scoreScreenOffline(screenKey: string, answers: ScreenAnswers): ScreenResult | null {
  const template = getScreen(screenKey);
  if (!template) return null;
  const openScores = new Map<string, OpenScore>();
  for (const q of template.questions) {
    if (q.type === "short_answer" || q.type === "scenario") {
      openScores.set(q.id, scoreOpenHeuristic(q, answerToText(q, answers[q.id])));
    }
  }
  return assemble(template, answers, openScores, "heuristic");
}

/**
 * Scores a completed screen. Uses the LLM rubric grader for open answers when
 * ANTHROPIC_API_KEY is set, falling back to the offline point grader otherwise
 * or on error — deterministic questions are always scored locally.
 */
export async function scoreScreen(
  screenKey: string,
  answers: ScreenAnswers,
): Promise<ScreenResult | null> {
  const template = getScreen(screenKey);
  if (!template) return null;

  const openQuestions = template.questions.filter(
    (q) => q.type === "short_answer" || q.type === "scenario",
  );

  let openScores = new Map<string, OpenScore>();
  let method: "llm" | "heuristic" = "heuristic";

  if (openQuestions.length > 0 && isLlmConfigured()) {
    try {
      openScores = await scoreOpenAnswersLlm(template, openQuestions, answers);
      method = "llm";
    } catch (error) {
      console.error("LLM screen grading failed, falling back to heuristic:", error);
      openScores = new Map();
      method = "heuristic";
    }
  }

  if (method === "heuristic") {
    for (const q of openQuestions) {
      openScores.set(q.id, scoreOpenHeuristic(q, answerToText(q, answers[q.id])));
    }
  } else {
    // Backfill any open answer the LLM omitted.
    for (const q of openQuestions) {
      if (!openScores.has(q.id)) {
        openScores.set(q.id, scoreOpenHeuristic(q, answerToText(q, answers[q.id])));
      }
    }
  }

  return assemble(template, answers, openScores, method);
}
