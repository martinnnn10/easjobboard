/**
 * Self-service skills-screen store (Deploy 21).
 *
 * The org-scoped library behind the no-code Screen Builder. A `screen_templates`
 * row is the logical screen a customer builds; its editable DRAFT lives inline
 * as JSON. Publishing freezes the draft into an immutable `screen_versions` row
 * (sv_…). Jobs and invites pin a specific version id so a candidate's historic
 * result stays tied to the exact version they completed — editing a used screen
 * always creates a NEW version and never rewrites a completed one.
 *
 * Every version and draft is stored as a `ScreenDefinition`, which resolves to
 * the SAME `ScreenTemplate` shape the built-in code screens use — so the
 * existing scoring engine, public shape, and knockout rules are reused verbatim
 * (no competing scoring system). better-sqlite3 is synchronous, so resolution
 * stays synchronous and the entire scoring/apply/invite chain is unchanged.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";
import {
  getScreen as getBuiltinScreen,
  getScreenLabel as getBuiltinScreenLabel,
  isScreenKey,
  type QuestionType,
  type ScreenDimension,
  type ScreenQuestion,
  type ScreenTemplate,
} from "./screens";

export type ScreenStatus = "draft" | "published" | "archived";

/** The editable/immutable payload shared by drafts and published versions. */
export type ScreenDefinition = {
  label: string;
  shortLabel: string;
  blurb: string;
  passingScore: number;
  questions: ScreenQuestion[];
};

export type ScreenRecord = {
  id: string;
  organizationId: string;
  title: string;
  targetRole: string;
  category: string;
  description: string;
  status: ScreenStatus;
  passingScore: number;
  draft: ScreenDefinition;
  publishedVersionId: string;
  publishedVersion: number;
  seededFrom: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Derived: number of questions in the draft. */
  questionCount: number;
  /** Derived: estimated completion minutes for the draft. */
  estimatedMinutes: number;
  /** Derived: draft has unpublished edits since the last publish. */
  hasUnpublishedChanges: boolean;
};

export type ScreenVersionRecord = {
  id: string;
  templateId: string;
  organizationId: string;
  version: number;
  definition: ScreenDefinition;
  questionCount: number;
  estimatedMinutes: number;
  passingScore: number;
  publishedBy: string;
  publishedAt: string;
};

const VALID_TYPES: QuestionType[] = [
  "multiple_choice",
  "multi_select",
  "short_answer",
  "scenario",
  "ranking",
  "experience",
];

const VALID_DIMENSIONS: ScreenDimension[] = [
  "troubleshooting",
  "electrical",
  "mechanical",
  "safety",
  "roleAlignment",
  "communication",
];

function newQuestionId(): string {
  return `q_${randomUUID().slice(0, 8)}`;
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function str(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Estimated candidate completion time, in whole minutes (min 1). */
export function estimateMinutes(questions: ScreenQuestion[]): number {
  const perType: Record<QuestionType, number> = {
    multiple_choice: 0.75,
    multi_select: 0.9,
    experience: 0.5,
    ranking: 1.25,
    short_answer: 2.5,
    scenario: 3,
  };
  const total = questions.reduce((sum, q) => sum + (perType[q.type] ?? 1), 0);
  return Math.max(1, Math.round(total));
}

/**
 * Sanitize an untrusted definition from the builder into a safe, well-formed
 * ScreenDefinition. Assigns stable question ids, clamps weights, validates
 * enums, and drops malformed answer keys — so the scoring engine never sees a
 * bad shape and answer keys stay server-side.
 */
export function sanitizeDefinition(input: unknown): ScreenDefinition {
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : [];
  const questions: ScreenQuestion[] = [];

  for (const rq of rawQuestions) {
    if (!rq || typeof rq !== "object") continue;
    const q = rq as Record<string, unknown>;
    const type = (VALID_TYPES as string[]).includes(String(q.type))
      ? (q.type as QuestionType)
      : "multiple_choice";
    const dimension = (VALID_DIMENSIONS as string[]).includes(String(q.dimension))
      ? (q.dimension as ScreenDimension)
      : "roleAlignment";
    const prompt = str(q.prompt, 2000).trim();
    if (!prompt) continue;

    const question: ScreenQuestion = {
      id: typeof q.id === "string" && q.id.trim() ? q.id.trim().slice(0, 40) : newQuestionId(),
      type,
      prompt,
      dimension,
      // Simple 1–5 importance, used directly as the scoring weight. Round-trip
      // stable so repeated edit→save never drifts the weighting.
      weight: clampInt(q.weight, 1, 5, 2),
    };

    if (q.help) question.help = str(q.help, 500);
    if (q.mustPass === true) question.mustPass = true;
    if (q.knockout === true) question.knockout = true;
    if (q.difficulty === "easy" || q.difficulty === "medium" || q.difficulty === "hard") {
      question.difficulty = q.difficulty;
    }
    if (q.explanation) question.explanation = str(q.explanation, 1000);
    if (q.riskInterpretation) question.riskInterpretation = str(q.riskInterpretation, 500);

    const options = Array.isArray(q.options)
      ? q.options.map((o) => str(o, 500)).filter((o) => o.length > 0)
      : [];

    if (type === "multiple_choice") {
      question.options = options;
      question.correctIndex = clampInt(q.correctIndex, 0, Math.max(0, options.length - 1), 0);
    } else if (type === "multi_select") {
      question.options = options;
      const idx = Array.isArray(q.correctIndices) ? q.correctIndices : [];
      question.correctIndices = [
        ...new Set(
          idx
            .map((n) => clampInt(n, 0, Math.max(0, options.length - 1), -1))
            .filter((n) => n >= 0 && n < options.length),
        ),
      ].sort((a, b) => a - b);
    } else if (type === "experience") {
      question.options = options;
      const scores = Array.isArray(q.optionScores) ? q.optionScores : [];
      question.optionScores = options.map((_, i) => clampInt(scores[i], 0, 100, 0));
    } else if (type === "ranking") {
      const items = Array.isArray(q.items) ? q.items : [];
      question.items = items
        .map((it) => {
          const rec = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const text = str(rec.text, 300).trim();
          if (!text) return null;
          const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim().slice(0, 40) : newQuestionId();
          return { id, text };
        })
        .filter((x): x is { id: string; text: string } => x !== null);
    } else if (type === "short_answer" || type === "scenario") {
      if (q.rubric) question.rubric = str(q.rubric, 2000);
      if (q.followUpIfWeak) question.followUpIfWeak = str(q.followUpIfWeak, 500);
      const pts = Array.isArray(q.idealPoints) ? q.idealPoints : [];
      const ideal = pts
        .map((p) => {
          const rec = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
          const label = str(rec.label, 200).trim();
          const any = Array.isArray(rec.any)
            ? rec.any.map((k) => str(k, 60).toLowerCase().trim()).filter(Boolean)
            : [];
          if (!label || any.length === 0) return null;
          return { label, any };
        })
        .filter((x): x is { label: string; any: string[] } => x !== null);
      if (ideal.length > 0) question.idealPoints = ideal;
      // Manual review unless the author supplied rubric points the safe offline
      // grader can use. Honors "don't score written answers with unsupported AI
      // certainty" — no ideal points ⇒ held for a human.
      const wantsManual = q.manualReview === true || ideal.length === 0;
      if (wantsManual) question.manualReview = true;
    }

    questions.push(question);
  }

  return {
    label: str(obj.label, 200).trim() || "Untitled screen",
    shortLabel: str(obj.shortLabel, 60).trim() || str(obj.label, 60).trim() || "Screen",
    blurb: str(obj.blurb, 500).trim(),
    passingScore: clampInt(obj.passingScore, 0, 100, 0),
    questions,
  };
}

/** Convert a resolved ScreenTemplate (e.g. a built-in) into a seedable draft. */
export function templateToDefinition(t: ScreenTemplate): ScreenDefinition {
  return sanitizeDefinition({
    label: t.label,
    shortLabel: t.shortLabel,
    blurb: t.blurb,
    passingScore: t.passingScore ?? 0,
    questions: t.questions,
  });
}

function parseDefinition(raw: unknown): ScreenDefinition {
  if (typeof raw !== "string" || raw.length === 0) {
    return { label: "", shortLabel: "", blurb: "", passingScore: 0, questions: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      label: str(parsed.label, 200),
      shortLabel: str(parsed.shortLabel, 60),
      blurb: str(parsed.blurb, 500),
      passingScore: clampInt(parsed.passingScore, 0, 100, 0),
      questions: Array.isArray(parsed.questions) ? (parsed.questions as ScreenQuestion[]) : [],
    };
  } catch {
    return { label: "", shortLabel: "", blurb: "", passingScore: 0, questions: [] };
  }
}

function definitionToTemplate(key: string, raw: unknown): ScreenTemplate {
  const def = parseDefinition(raw);
  return {
    key,
    label: def.label || "Skills screen",
    shortLabel: def.shortLabel || def.label || "Screen",
    blurb: def.blurb,
    passingScore: def.passingScore,
    questions: def.questions,
  };
}

// ─── Resolution (used by lib/screens.ts getScreen) ──────────────────────────

/**
 * Resolve a DB-backed screen key to its full ScreenTemplate. `sv_…` → that exact
 * immutable version (historic fidelity); `scr_…` → the screen's current
 * published version, falling back to its draft for preview. Org-agnostic by
 * design — see getScreen's note.
 */
export function resolveDbScreen(key: string): ScreenTemplate | null {
  const db = getDb();
  if (key.startsWith("sv_")) {
    const row = db.prepare("SELECT definition FROM screen_versions WHERE id = ?").get(key) as
      | { definition?: string }
      | undefined;
    return row?.definition ? definitionToTemplate(key, row.definition) : null;
  }
  if (key.startsWith("scr_")) {
    const row = db
      .prepare("SELECT published_version_id, draft_definition FROM screen_templates WHERE id = ?")
      .get(key) as { published_version_id?: string; draft_definition?: string } | undefined;
    if (!row) return null;
    if (row.published_version_id) {
      const v = db.prepare("SELECT definition FROM screen_versions WHERE id = ?").get(row.published_version_id) as
        | { definition?: string }
        | undefined;
      if (v?.definition) return definitionToTemplate(key, v.definition);
    }
    return row.draft_definition ? definitionToTemplate(key, row.draft_definition) : null;
  }
  return null;
}

/**
 * Server-side unified resolver: built-in screens via ROLE_SCREENS, else a
 * DB-backed custom screen — both return the identical ScreenTemplate shape, so
 * the scoring engine and public shape are reused verbatim. This is the resolver
 * every server call site (scoring, public screen page, job command center)
 * should use. It is intentionally org-agnostic: callers that accept a key from
 * user input must additionally check `screenBelongsToOrg`.
 */
export function resolveScreen(key: string | null | undefined): ScreenTemplate | null {
  if (!key) return null;
  return getBuiltinScreen(key) ?? resolveDbScreen(key);
}

export function resolveScreenLabel(key: string | null | undefined): string {
  if (!key) return "";
  const builtin = getBuiltinScreenLabel(key);
  if (builtin) return builtin;
  return dbScreenLabel(key);
}

/** Runtime check: does this key resolve to a usable screen (built-in or DB)? */
export function screenExists(key: string | null | undefined): boolean {
  return resolveScreen(key) !== null;
}

export function dbScreenLabel(key: string): string {
  const db = getDb();
  if (key.startsWith("sv_")) {
    const row = db
      .prepare("SELECT t.title AS title FROM screen_versions v JOIN screen_templates t ON t.id = v.template_id WHERE v.id = ?")
      .get(key) as { title?: string } | undefined;
    return row?.title ?? "";
  }
  if (key.startsWith("scr_")) {
    const row = db.prepare("SELECT title FROM screen_templates WHERE id = ?").get(key) as
      | { title?: string }
      | undefined;
    return row?.title ?? "";
  }
  return "";
}

/**
 * Isolation guard for routes that accept a screen key from user input. Built-in
 * keys are global; DB keys must belong to the caller's org.
 */
export function screenBelongsToOrg(key: string, orgId: string): boolean {
  if (!key) return false;
  if (isScreenKey(key)) return true;
  const db = getDb();
  if (key.startsWith("sv_")) {
    const r = db.prepare("SELECT organization_id FROM screen_versions WHERE id = ?").get(key) as
      | { organization_id?: string }
      | undefined;
    return r?.organization_id === orgId;
  }
  if (key.startsWith("scr_")) {
    const r = db.prepare("SELECT organization_id FROM screen_templates WHERE id = ?").get(key) as
      | { organization_id?: string }
      | undefined;
    return r?.organization_id === orgId;
  }
  return false;
}

/** The current published version id for a logical screen id, or "" if none. */
export function publishedVersionKey(screenId: string, orgId: string): string {
  const row = getDb()
    .prepare("SELECT published_version_id FROM screen_templates WHERE id = ? AND organization_id = ?")
    .get(screenId, orgId) as { published_version_id?: string } | undefined;
  return row?.published_version_id ?? "";
}

/** Map any pinned screen key back to its logical screen id (or "" for built-ins). */
export function templateIdForKey(key: string): string {
  if (!key || isScreenKey(key)) return "";
  const db = getDb();
  if (key.startsWith("scr_")) return key;
  if (key.startsWith("sv_")) {
    const r = db.prepare("SELECT template_id FROM screen_versions WHERE id = ?").get(key) as
      | { template_id?: string }
      | undefined;
    return r?.template_id ?? "";
  }
  return "";
}

// ─── Row mapping ────────────────────────────────────────────────────────────

function rowToRecord(row: Record<string, unknown>): ScreenRecord {
  const draft = parseDefinition(row.draft_definition);
  const publishedVersionId = (row.published_version_id as string | undefined) ?? "";
  const draftJson = JSON.stringify(draft.questions);
  let hasUnpublishedChanges = false;
  if (publishedVersionId) {
    const pub = getDb().prepare("SELECT definition FROM screen_versions WHERE id = ?").get(publishedVersionId) as
      | { definition?: string }
      | undefined;
    const pubDef = parseDefinition(pub?.definition);
    hasUnpublishedChanges =
      JSON.stringify(pubDef.questions) !== draftJson ||
      pubDef.passingScore !== draft.passingScore ||
      pubDef.label !== draft.label;
  }
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    title: (row.title as string | undefined) ?? "",
    targetRole: (row.target_role as string | undefined) ?? "",
    category: (row.category as string | undefined) ?? "custom",
    description: (row.description as string | undefined) ?? "",
    status: ((row.status as string | undefined) ?? "draft") as ScreenStatus,
    passingScore: Number(row.passing_score ?? 0),
    draft,
    publishedVersionId,
    publishedVersion: Number(row.published_version ?? 0),
    seededFrom: (row.seeded_from as string | undefined) ?? "",
    createdBy: (row.created_by as string | undefined) ?? "",
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | undefined) ?? (row.created_at as string),
    questionCount: draft.questions.length,
    estimatedMinutes: estimateMinutes(draft.questions),
    hasUnpublishedChanges,
  };
}

// ─── CRUD + versioning (all org-scoped) ─────────────────────────────────────

/**
 * How many jobs each screen is attached to, keyed by logical screen id. Counts
 * jobs pinned to any published version (sv_…) of the screen — the shape the
 * attach flow produces.
 */
export function jobsUsingByScreen(orgId: string): Record<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT v.template_id AS tid, COUNT(*) AS c
       FROM jobs j JOIN screen_versions v ON v.id = j.screen_key
       WHERE j.organization_id = ?
       GROUP BY v.template_id`,
    )
    .all(orgId) as Array<{ tid: string; c: number }>;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.tid] = Number(r.c);
  return out;
}

export function listScreens(orgId: string, includeArchived = false): ScreenRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM screen_templates WHERE organization_id = ?${
        includeArchived ? "" : " AND status != 'archived'"
      } ORDER BY updated_at DESC`,
    )
    .all(orgId) as Array<Record<string, unknown>>;
  return rows.map(rowToRecord);
}

/**
 * Published custom screens as {key,label} picker options — key is the pinned
 * version id (sv_…) so sending one is version-locked. Appended to the built-in
 * SCREEN_OPTIONS wherever a recruiter chooses a screen to send.
 */
export function listPublishedScreenOptions(orgId: string): { key: string; label: string }[] {
  return listScreens(orgId)
    .filter((s) => s.status === "published" && s.publishedVersionId)
    .map((s) => ({ key: s.publishedVersionId, label: s.title }));
}

export function getScreenRecord(id: string, orgId: string): ScreenRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM screen_templates WHERE id = ? AND organization_id = ?")
    .get(id, orgId) as Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
}

export function createScreen(input: {
  organizationId: string;
  title: string;
  category: string;
  targetRole?: string;
  description?: string;
  createdBy?: string;
  /** Optional seed (from a built-in template or a duplicate). */
  seed?: ScreenDefinition;
  seededFrom?: string;
}): ScreenRecord {
  const db = getDb();
  const id = `scr_${randomUUID()}`;
  const now = new Date().toISOString();
  const title = input.title.trim().slice(0, 200) || "Untitled screen";
  const seed = input.seed ? sanitizeDefinition(input.seed) : null;
  const draft: ScreenDefinition = seed ?? {
    label: title,
    shortLabel: title.slice(0, 60),
    blurb: input.description?.slice(0, 500) ?? "",
    passingScore: 0,
    questions: [],
  };
  // Keep the library title as the definition label so previews read right.
  draft.label = title;
  if (!draft.shortLabel) draft.shortLabel = title.slice(0, 60);

  db.prepare(
    `INSERT INTO screen_templates (
       id, organization_id, title, target_role, category, description, status,
       passing_score, draft_definition, published_version_id, published_version,
       seeded_from, created_by, created_at, updated_at
     ) VALUES (
       @id, @organization_id, @title, @target_role, @category, @description, 'draft',
       @passing_score, @draft_definition, '', 0, @seeded_from, @created_by, @now, @now
     )`,
  ).run({
    id,
    organization_id: input.organizationId,
    title,
    target_role: input.targetRole?.slice(0, 200) ?? "",
    category: input.category.slice(0, 60) || "custom",
    description: input.description?.slice(0, 500) ?? "",
    passing_score: draft.passingScore,
    draft_definition: JSON.stringify(draft),
    seeded_from: input.seededFrom?.slice(0, 60) ?? "",
    created_by: input.createdBy?.slice(0, 200) ?? "",
    now,
  });
  return getScreenRecord(id, input.organizationId)!;
}

export function updateScreen(
  id: string,
  orgId: string,
  patch: {
    title?: string;
    category?: string;
    targetRole?: string;
    description?: string;
    definition?: unknown;
  },
): ScreenRecord | null {
  const existing = getScreenRecord(id, orgId);
  if (!existing) return null;
  const db = getDb();
  const now = new Date().toISOString();

  const title = patch.title !== undefined ? patch.title.trim().slice(0, 200) || existing.title : existing.title;
  let draft = existing.draft;
  if (patch.definition !== undefined) {
    draft = sanitizeDefinition(patch.definition);
  }
  // Library title is the source of truth for the definition label.
  draft.label = title;
  if (!draft.shortLabel) draft.shortLabel = title.slice(0, 60);

  db.prepare(
    `UPDATE screen_templates SET
       title = @title,
       category = @category,
       target_role = @target_role,
       description = @description,
       passing_score = @passing_score,
       draft_definition = @draft_definition,
       updated_at = @now
     WHERE id = @id AND organization_id = @org`,
  ).run({
    id,
    org: orgId,
    title,
    category: patch.category?.slice(0, 60) ?? existing.category,
    target_role: patch.targetRole?.slice(0, 200) ?? existing.targetRole,
    description: patch.description?.slice(0, 500) ?? existing.description,
    passing_score: draft.passingScore,
    draft_definition: JSON.stringify(draft),
    now,
  });
  return getScreenRecord(id, orgId);
}

export type PublishResult =
  | { ok: true; record: ScreenRecord; versionId: string }
  | { ok: false; error: string };

/**
 * Freeze the current draft into a new immutable version and mark the screen
 * published. Never mutates prior versions, so completed candidate results stay
 * tied to the exact version they took.
 */
export function publishScreen(id: string, orgId: string, actor: string): PublishResult {
  const rec = getScreenRecord(id, orgId);
  if (!rec) return { ok: false, error: "Screen not found." };
  const def = sanitizeDefinition(rec.draft);
  if (def.questions.length === 0) {
    return { ok: false, error: "Add at least one question before publishing." };
  }
  const db = getDb();
  const now = new Date().toISOString();
  const version = rec.publishedVersion + 1;
  const versionId = `sv_${randomUUID()}`;
  const qCount = def.questions.length;
  const mins = estimateMinutes(def.questions);

  db.prepare(
    `INSERT INTO screen_versions (
       id, template_id, organization_id, version, definition, question_count,
       estimated_minutes, passing_score, published_by, published_at, created_at
     ) VALUES (
       @id, @template_id, @org, @version, @definition, @qcount,
       @mins, @passing, @actor, @now, @now
     )`,
  ).run({
    id: versionId,
    template_id: id,
    org: orgId,
    version,
    definition: JSON.stringify(def),
    qcount: qCount,
    mins,
    passing: def.passingScore,
    actor: actor.slice(0, 200),
    now,
  });

  db.prepare(
    `UPDATE screen_templates SET status = 'published', published_version_id = @vid,
       published_version = @version, passing_score = @passing, updated_at = @now
     WHERE id = @id AND organization_id = @org`,
  ).run({ vid: versionId, version, passing: def.passingScore, now, id, org: orgId });

  return { ok: true, record: getScreenRecord(id, orgId)!, versionId };
}

export function duplicateScreen(id: string, orgId: string, actor: string): ScreenRecord | null {
  const rec = getScreenRecord(id, orgId);
  if (!rec) return null;
  const seed = { ...rec.draft, label: `${rec.title} (copy)` };
  return createScreen({
    organizationId: orgId,
    title: `${rec.title} (copy)`,
    category: rec.category,
    targetRole: rec.targetRole,
    description: rec.description,
    createdBy: actor,
    seed,
    seededFrom: rec.id,
  });
}

export function archiveScreen(id: string, orgId: string): ScreenRecord | null {
  getDb()
    .prepare("UPDATE screen_templates SET status = 'archived', updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(new Date().toISOString(), id, orgId);
  return getScreenRecord(id, orgId);
}

export function restoreScreen(id: string, orgId: string): ScreenRecord | null {
  const rec = getScreenRecord(id, orgId);
  if (!rec) return null;
  const status = rec.publishedVersionId ? "published" : "draft";
  getDb()
    .prepare("UPDATE screen_templates SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(status, new Date().toISOString(), id, orgId);
  return getScreenRecord(id, orgId);
}

export function listVersions(templateId: string, orgId: string): ScreenVersionRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM screen_versions WHERE template_id = ? AND organization_id = ? ORDER BY version DESC")
    .all(templateId, orgId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id as string,
    templateId: row.template_id as string,
    organizationId: row.organization_id as string,
    version: Number(row.version),
    definition: parseDefinition(row.definition),
    questionCount: Number(row.question_count ?? 0),
    estimatedMinutes: Number(row.estimated_minutes ?? 0),
    passingScore: Number(row.passing_score ?? 0),
    publishedBy: (row.published_by as string | undefined) ?? "",
    publishedAt: row.published_at as string,
  }));
}
