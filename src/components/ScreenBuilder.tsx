"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ScreenQuestions } from "@/components/ScreenQuestions";
import type { ScreenRecord } from "@/lib/screen-store";
import {
  DIMENSION_LABELS,
  QUESTION_TYPE_LABELS,
  type PublicQuestion,
  type QuestionType,
  type ScreenDimension,
  type ScreenQuestion,
} from "@/lib/screens";

/**
 * Self-service Manufacturing Skills Screen Builder.
 *
 * A premium, obvious workflow: Basics → Skill domains → Questions → Scoring →
 * Candidate preview → Publish. Answer keys stay in the draft (recruiter-facing);
 * the live preview strips them exactly like the public page does. Publishing
 * freezes an immutable version — historic candidate results are never rewritten.
 */

type Step = "basics" | "domains" | "questions" | "scoring" | "preview" | "publish";
const STEPS: { key: Step; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "domains", label: "Skill domains" },
  { key: "questions", label: "Questions" },
  { key: "scoring", label: "Scoring" },
  { key: "preview", label: "Preview" },
  { key: "publish", label: "Publish" },
];

const DIMENSIONS = Object.keys(DIMENSION_LABELS) as ScreenDimension[];
const TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

function blankQuestion(type: QuestionType = "multiple_choice"): ScreenQuestion {
  const q: ScreenQuestion = {
    id: uid("q"),
    type,
    prompt: "",
    dimension: "troubleshooting",
    weight: 2,
  };
  if (type === "multiple_choice") {
    q.options = ["", ""];
    q.correctIndex = 0;
  } else if (type === "multi_select") {
    q.options = ["", ""];
    q.correctIndices = [];
  } else if (type === "experience") {
    q.options = ["None", "1–3 years", "3–7 years", "7+ years"];
    q.optionScores = [0, 60, 85, 100];
  } else if (type === "ranking") {
    q.items = [
      { id: uid("i"), text: "" },
      { id: uid("i"), text: "" },
    ];
  } else {
    q.manualReview = true;
  }
  return q;
}

export function ScreenBuilder({
  orgSlug,
  record,
  categoryLabels,
  canWrite,
  initialStep,
  versionCount,
}: {
  orgSlug: string;
  record: ScreenRecord;
  categoryLabels: Record<string, string>;
  canWrite: boolean;
  initialStep?: Step;
  versionCount: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep ?? "basics");
  const [title, setTitle] = useState(record.title);
  const [category, setCategory] = useState(record.category);
  const [targetRole, setTargetRole] = useState(record.targetRole);
  const [description, setDescription] = useState(record.description);
  const [questions, setQuestions] = useState<ScreenQuestion[]>(record.draft.questions);
  const [passingScore, setPassingScore] = useState(record.passingScore);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishedVersion, setPublishedVersion] = useState(record.publishedVersion);

  const touch = useCallback(() => {
    setDirty(true);
    setNotice("");
  }, []);

  const updateQuestion = useCallback(
    (index: number, patch: Partial<ScreenQuestion>) => {
      setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
      touch();
    },
    [touch],
  );

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
    touch();
  }
  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    touch();
  }
  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(index, 1);
      next.splice(to, 0, m);
      return next;
    });
    touch();
  }

  const definition = useMemo(
    () => ({
      label: title,
      shortLabel: title.slice(0, 60),
      blurb: description,
      passingScore,
      questions,
    }),
    [title, description, passingScore, questions],
  );

  async function save(): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/screens/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          target_role: targetRole,
          description,
          definition,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; screen?: ScreenRecord };
      if (!res.ok) {
        setError(data.error ?? "Couldn't save.");
        return false;
      }
      if (data.screen) setQuestions(data.screen.draft.questions);
      setDirty(false);
      setNotice("Draft saved.");
      return true;
    } catch {
      setError("Network error while saving.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    const validation = validate(title, questions);
    if (validation) {
      setError(validation);
      setStep("questions");
      return;
    }
    setPublishing(true);
    setError("");
    const saved = await save();
    if (!saved) {
      setPublishing(false);
      return;
    }
    try {
      const res = await fetch(`/api/o/${orgSlug}/screens/${record.id}/publish`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; screen?: ScreenRecord };
      if (!res.ok) {
        setError(data.error ?? "Couldn't publish.");
        return;
      }
      if (data.screen) setPublishedVersion(data.screen.publishedVersion);
      setNotice(`Published version ${data.screen?.publishedVersion ?? ""}. It's ready to attach to a job.`);
      router.refresh();
    } catch {
      setError("Network error while publishing.");
    } finally {
      setPublishing(false);
    }
  }

  const publicPreview: PublicQuestion[] = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt || "(untitled question)",
        help: q.help,
        options: q.options ? [...q.options] : undefined,
        items: q.items ? [...q.items].reverse() : undefined,
      })),
    [questions],
  );

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const readOnly = !canWrite;

  return (
    <div className="space-y-5">
      {/* Header + stepper */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{title || "Untitled screen"}</h1>
          <p className="text-xs text-zinc-500">
            {categoryLabels[category] ?? "Custom"} · {questions.length} question{questions.length === 1 ? "" : "s"}
            {publishedVersion > 0 ? ` · published v${publishedVersion}` : " · draft"}
            {readOnly ? " · read-only" : ""}
          </p>
        </div>
        {canWrite ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={save} disabled={saving || publishing} className="btn-secondary">
              {saving ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </button>
            <button type="button" onClick={publish} disabled={saving || publishing} className="btn-primary">
              {publishing ? "Publishing…" : publishedVersion > 0 ? "Publish new version" : "Publish"}
            </button>
          </div>
        ) : null}
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStep(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                s.key === step
                  ? "bg-brand-600 text-white"
                  : i < stepIndex
                    ? "bg-brand-50 text-brand-700"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">{notice}</p> : null}

      {/* Steps */}
      {step === "basics" ? (
        <section className="card space-y-4">
          <Field label="Screen title">
            <input className="field-input" value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} disabled={readOnly} placeholder="e.g. Industrial Maintenance Technician screen" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select className="field-input" value={category} onChange={(e) => { setCategory(e.target.value); touch(); }} disabled={readOnly}>
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Target role">
              <input className="field-input" value={targetRole} onChange={(e) => { setTargetRole(e.target.value); touch(); }} disabled={readOnly} placeholder="e.g. Multi-craft Maintenance Tech" />
            </Field>
          </div>
          <Field label="Description (internal)">
            <textarea className="field-input min-h-20" value={description} onChange={(e) => { setDescription(e.target.value); touch(); }} disabled={readOnly} placeholder="What this screen measures and who it's for." />
          </Field>
        </section>
      ) : null}

      {step === "domains" ? <DomainsStep questions={questions} /> : null}

      {step === "questions" ? (
        <section className="space-y-4">
          {questions.length === 0 ? (
            <div className="card py-10 text-center text-sm text-zinc-600">
              No questions yet. {canWrite ? "Add your first question below." : "Ask a recruiter to add questions."}
            </div>
          ) : (
            questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                index={i}
                total={questions.length}
                question={q}
                readOnly={readOnly}
                onChange={(patch) => updateQuestion(i, patch)}
                onRemove={() => removeQuestion(i)}
                onMove={(dir) => moveQuestion(i, dir)}
              />
            ))
          )}
          {canWrite ? (
            <button type="button" onClick={addQuestion} className="btn-secondary w-full py-2.5">
              + Add question
            </button>
          ) : null}
        </section>
      ) : null}

      {step === "scoring" ? (
        <ScoringStep
          questions={questions}
          passingScore={passingScore}
          readOnly={readOnly}
          onPassing={(v) => { setPassingScore(v); touch(); }}
        />
      ) : null}

      {step === "preview" ? (
        <section className="space-y-3">
          <div className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-800">
            This is exactly what a candidate sees on their phone — answer keys, scoring, and knockout rules are never
            shown.
          </div>
          <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <header className="mb-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
                {targetRole || "Your company"}
              </p>
              <h2 className="text-lg font-bold text-zinc-900">Show what you can actually do</h2>
            </header>
            {publicPreview.length === 0 ? (
              <p className="text-sm text-zinc-500">Add questions to preview the candidate experience.</p>
            ) : (
              <ScreenQuestions questions={publicPreview} answers={{}} onChange={() => {}} />
            )}
          </div>
        </section>
      ) : null}

      {step === "publish" ? (
        <PublishStep
          title={title}
          questions={questions}
          publishedVersion={publishedVersion}
          versionCount={versionCount}
          canWrite={canWrite}
          publishing={publishing}
          onPublish={publish}
        />
      ) : null}

      {/* Step nav */}
      <div className="flex justify-between border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].key)}
          disabled={stepIndex === 0}
          className="btn-secondary disabled:opacity-40"
        >
          ← Back
        </button>
        {stepIndex < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep(STEPS[stepIndex + 1].key)} className="btn-primary">
            Next: {STEPS[stepIndex + 1].label} →
          </button>
        ) : null}
      </div>
    </div>
  );
}

function validate(title: string, questions: ScreenQuestion[]): string {
  if (!title.trim()) return "Give the screen a title (Basics).";
  if (questions.length === 0) return "Add at least one question before publishing.";
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.prompt.trim()) return `Question ${i + 1} needs a prompt.`;
    if (q.type === "multiple_choice") {
      if ((q.options ?? []).filter((o) => o.trim()).length < 2) return `Question ${i + 1} needs at least two options.`;
    }
    if (q.type === "multi_select") {
      if ((q.options ?? []).filter((o) => o.trim()).length < 2) return `Question ${i + 1} needs at least two options.`;
      if ((q.correctIndices ?? []).length === 0) return `Question ${i + 1}: mark which options are correct.`;
    }
    if (q.type === "ranking" && (q.items ?? []).filter((it) => it.text.trim()).length < 2) {
      return `Question ${i + 1} needs at least two steps to order.`;
    }
  }
  return "";
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-zinc-400">{hint}</span> : null}
    </label>
  );
}

function DomainsStep({ questions }: { questions: ScreenQuestion[] }) {
  const counts = new Map<ScreenDimension, number>();
  for (const q of questions) counts.set(q.dimension, (counts.get(q.dimension) ?? 0) + 1);
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Skill domains covered</h2>
        <p className="text-xs text-zinc-500">
          Each question measures one competency. A well-rounded screen spreads across the domains that matter for the
          role — set each question&apos;s domain on the Questions step.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DIMENSIONS.map((d) => {
          const n = counts.get(d) ?? 0;
          return (
            <div
              key={d}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                n > 0 ? "border-brand-200 bg-brand-50 text-brand-800" : "border-zinc-200 bg-white text-zinc-500"
              }`}
            >
              <span>{DIMENSION_LABELS[d]}</span>
              <span className="font-semibold">{n}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoringStep({
  questions,
  passingScore,
  readOnly,
  onPassing,
}: {
  questions: ScreenQuestion[];
  passingScore: number;
  readOnly: boolean;
  onPassing: (v: number) => void;
}) {
  const safety = questions.filter((q) => q.mustPass).length;
  const knockouts = questions.filter((q) => q.knockout).length;
  const manual = questions.filter((q) => q.manualReview).length;
  const scored = questions.filter((q) => !q.manualReview).length;
  return (
    <section className="space-y-4">
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Passing bar</h2>
        <p className="text-xs text-zinc-500">
          Candidates below this overall score are flagged as a knockout (advisory — it never auto-rejects anyone). Set 0
          for no bar.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={passingScore}
            onChange={(e) => onPassing(Number(e.target.value))}
            disabled={readOnly}
            className="flex-1 accent-brand-600"
          />
          <span className="w-12 text-right text-sm font-semibold text-zinc-800">{passingScore || "Off"}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Scored questions" value={scored} />
        <StatTile label="Safety-critical" value={safety} tone={safety > 0 ? "amber" : undefined} />
        <StatTile label="Knockout rules" value={knockouts} />
        <StatTile label="Manual review" value={manual} />
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-zinc-900">Question weights</h3>
        <p className="text-xs text-zinc-500">Weight each question 1–5 on the Questions step. Higher weight counts more toward the overall score.</p>
        <ul className="divide-y divide-zinc-100 text-sm">
          {questions.map((q, i) => (
            <li key={q.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-zinc-700">
                {i + 1}. {q.prompt || "(untitled)"}
              </span>
              <span className="flex items-center gap-2 text-xs text-zinc-500">
                {q.mustPass ? <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">Safety</span> : null}
                {q.manualReview ? <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600">Manual</span> : null}
                <span className="font-semibold text-zinc-800">×{q.weight}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "amber" ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"}`}>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function PublishStep({
  title,
  questions,
  publishedVersion,
  versionCount,
  canWrite,
  publishing,
  onPublish,
}: {
  title: string;
  questions: ScreenQuestion[];
  publishedVersion: number;
  versionCount: number;
  canWrite: boolean;
  publishing: boolean;
  onPublish: () => void;
}) {
  const problem = validate(title, questions);
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Publish</h2>
        <p className="text-xs text-zinc-500">
          Publishing freezes the current draft as an immutable version you can attach to jobs and send to candidates.
          Editing later creates a new version — candidates who already completed an earlier version keep their exact
          results.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-zinc-500">Questions</dt><dd className="font-semibold text-zinc-900">{questions.length}</dd></div>
        <div><dt className="text-xs text-zinc-500">Current version</dt><dd className="font-semibold text-zinc-900">{publishedVersion > 0 ? `v${publishedVersion}` : "Unpublished"}</dd></div>
        <div><dt className="text-xs text-zinc-500">Total versions</dt><dd className="font-semibold text-zinc-900">{versionCount}</dd></div>
        <div><dt className="text-xs text-zinc-500">Status</dt><dd className="font-semibold text-zinc-900">{problem ? "Not ready" : "Ready"}</dd></div>
      </dl>
      {problem ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{problem}</p>
      ) : (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">Everything looks good to publish.</p>
      )}
      {canWrite ? (
        <button type="button" onClick={onPublish} disabled={publishing || Boolean(problem)} className="btn-primary">
          {publishing ? "Publishing…" : publishedVersion > 0 ? `Publish version ${publishedVersion + 1}` : "Publish version 1"}
        </button>
      ) : (
        <p className="text-xs text-zinc-500">Only owners and recruiters can publish.</p>
      )}
    </section>
  );
}

// ─── Question editor ────────────────────────────────────────────────────────

function QuestionEditor({
  index,
  total,
  question,
  readOnly,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  question: ScreenQuestion;
  readOnly: boolean;
  onChange: (patch: Partial<ScreenQuestion>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const q = question;
  const isOpen = q.type === "short_answer" || q.type === "scenario";
  const hasOptions = q.type === "multiple_choice" || q.type === "multi_select" || q.type === "experience";

  function setOption(i: number, text: string) {
    const opts = [...(q.options ?? [])];
    opts[i] = text;
    onChange({ options: opts });
  }
  function addOption() {
    onChange({ options: [...(q.options ?? []), ""] });
  }
  function removeOption(i: number) {
    const opts = (q.options ?? []).filter((_, j) => j !== i);
    const patch: Partial<ScreenQuestion> = { options: opts };
    if (q.type === "multiple_choice" && (q.correctIndex ?? 0) >= opts.length) patch.correctIndex = 0;
    if (q.type === "multi_select") patch.correctIndices = (q.correctIndices ?? []).filter((c) => c !== i).map((c) => (c > i ? c - 1 : c));
    if (q.type === "experience") patch.optionScores = (q.optionScores ?? []).filter((_, j) => j !== i);
    onChange(patch);
  }
  function changeType(type: QuestionType) {
    const next = blankQuestion(type);
    onChange({ type, options: next.options, correctIndex: next.correctIndex, correctIndices: next.correctIndices, optionScores: next.optionScores, items: next.items, manualReview: next.manualReview, idealPoints: undefined, rubric: undefined });
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Question {index + 1}</span>
        {!readOnly ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded border border-zinc-200 px-2 py-0.5 text-xs disabled:opacity-30">↑</button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded border border-zinc-200 px-2 py-0.5 text-xs disabled:opacity-30">↓</button>
            <button type="button" onClick={onRemove} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Remove</button>
          </div>
        ) : null}
      </div>

      <Field label="Prompt">
        <textarea className="field-input min-h-16" value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} disabled={readOnly} placeholder="What would you check first if…" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <select className="field-input" value={q.type} onChange={(e) => changeType(e.target.value as QuestionType)} disabled={readOnly}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="Skill domain">
          <select className="field-input" value={q.dimension} onChange={(e) => onChange({ dimension: e.target.value as ScreenDimension })} disabled={readOnly}>
            {DIMENSIONS.map((d) => (
              <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>
            ))}
          </select>
        </Field>
        <Field label="Weight (1–5)">
          <input type="number" min={1} max={5} className="field-input" value={q.weight} onChange={(e) => onChange({ weight: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} disabled={readOnly} />
        </Field>
      </div>

      {/* Difficulty + flags */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-zinc-600">Difficulty</span>
          <select className="field-input py-1" value={q.difficulty ?? "medium"} onChange={(e) => onChange({ difficulty: e.target.value as "easy" | "medium" | "hard" })} disabled={readOnly}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={Boolean(q.mustPass)} onChange={(e) => onChange({ mustPass: e.target.checked })} disabled={readOnly} className="h-4 w-4 accent-amber-600" />
          <span className="text-zinc-700">Safety-critical</span>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={Boolean(q.knockout)} onChange={(e) => onChange({ knockout: e.target.checked })} disabled={readOnly} className="h-4 w-4 accent-brand-600" />
          <span className="text-zinc-700">Knockout</span>
        </label>
      </div>

      {/* Options (MC / multi-select / experience) */}
      {hasOptions ? (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-zinc-700">
            {q.type === "experience" ? "Experience bands & scores" : "Answer options"}
            {q.type === "multiple_choice" ? " (select the correct one)" : q.type === "multi_select" ? " (check all correct)" : ""}
          </span>
          {(q.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              {q.type === "multiple_choice" ? (
                <input type="radio" name={`correct_${q.id}`} checked={q.correctIndex === i} onChange={() => onChange({ correctIndex: i })} disabled={readOnly} className="h-4 w-4 accent-brand-600" />
              ) : q.type === "multi_select" ? (
                <input
                  type="checkbox"
                  checked={(q.correctIndices ?? []).includes(i)}
                  onChange={(e) => {
                    const set = new Set(q.correctIndices ?? []);
                    if (e.target.checked) set.add(i);
                    else set.delete(i);
                    onChange({ correctIndices: [...set].sort((a, b) => a - b) });
                  }}
                  disabled={readOnly}
                  className="h-4 w-4 accent-brand-600"
                />
              ) : null}
              <input className="field-input flex-1 py-1.5 text-sm" value={opt} onChange={(e) => setOption(i, e.target.value)} disabled={readOnly} placeholder={`Option ${i + 1}`} />
              {q.type === "experience" ? (
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="field-input w-20 py-1.5 text-sm"
                  value={q.optionScores?.[i] ?? 0}
                  onChange={(e) => {
                    const scores = [...(q.optionScores ?? [])];
                    scores[i] = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    onChange({ optionScores: scores });
                  }}
                  disabled={readOnly}
                />
              ) : null}
              {!readOnly && (q.options ?? []).length > 2 ? (
                <button type="button" onClick={() => removeOption(i)} className="text-xs text-zinc-400 hover:text-red-600">✕</button>
              ) : null}
            </div>
          ))}
          {!readOnly ? (
            <button type="button" onClick={addOption} className="text-xs font-medium text-brand-700 hover:underline">+ Add option</button>
          ) : null}
        </div>
      ) : null}

      {/* Ranking items (correct order) */}
      {q.type === "ranking" ? (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-zinc-700">Steps in the CORRECT order (candidates see them shuffled)</span>
          {(q.items ?? []).map((it, i) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{i + 1}</span>
              <input
                className="field-input flex-1 py-1.5 text-sm"
                value={it.text}
                onChange={(e) => {
                  const items = [...(q.items ?? [])];
                  items[i] = { ...items[i], text: e.target.value };
                  onChange({ items });
                }}
                disabled={readOnly}
                placeholder={`Step ${i + 1}`}
              />
              {!readOnly && (q.items ?? []).length > 2 ? (
                <button type="button" onClick={() => onChange({ items: (q.items ?? []).filter((_, j) => j !== i) })} className="text-xs text-zinc-400 hover:text-red-600">✕</button>
              ) : null}
            </div>
          ))}
          {!readOnly ? (
            <button type="button" onClick={() => onChange({ items: [...(q.items ?? []), { id: uid("i"), text: "" }] })} className="text-xs font-medium text-brand-700 hover:underline">+ Add step</button>
          ) : null}
        </div>
      ) : null}

      {/* Open answer rubric / manual review */}
      {isOpen ? (
        <div className="space-y-3 rounded-lg bg-zinc-50 p-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={Boolean(q.manualReview)} onChange={(e) => onChange({ manualReview: e.target.checked })} disabled={readOnly} className="h-4 w-4 accent-brand-600" />
            <span className="font-medium text-zinc-700">Hold for manual review (not auto-scored)</span>
          </label>
          {!q.manualReview ? (
            <>
              <Field label="Rubric (guides the grader)">
                <textarea className="field-input min-h-16 text-sm" value={q.rubric ?? ""} onChange={(e) => onChange({ rubric: e.target.value })} disabled={readOnly} placeholder="What a strong answer demonstrates." />
              </Field>
              <IdealPointsEditor question={q} readOnly={readOnly} onChange={onChange} />
              <p className="text-xs text-zinc-400">
                Written answers are scored only against these concrete points — never with unsupported AI certainty. No
                points ⇒ the answer is held for manual review.
              </p>
            </>
          ) : (
            <p className="text-xs text-zinc-500">This answer will appear in the recruiter&apos;s manual-review list — it never affects the automatic score.</p>
          )}
          <Field label="Interview follow-up if weak (optional)">
            <input className="field-input py-1.5 text-sm" value={q.followUpIfWeak ?? ""} onChange={(e) => onChange({ followUpIfWeak: e.target.value })} disabled={readOnly} placeholder="What to ask in the interview if this is weak." />
          </Field>
        </div>
      ) : null}

      {/* Explanation + risk interpretation (recruiter-facing, post-submission) */}
      {!isOpen ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Explanation (shown after submission)">
            <input className="field-input py-1.5 text-sm" value={q.explanation ?? ""} onChange={(e) => onChange({ explanation: e.target.value })} disabled={readOnly} placeholder="Why the correct answer is correct." />
          </Field>
          <Field label="Risk interpretation (optional)">
            <input className="field-input py-1.5 text-sm" value={q.riskInterpretation ?? ""} onChange={(e) => onChange({ riskInterpretation: e.target.value })} disabled={readOnly} placeholder="What a wrong answer signals." />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function IdealPointsEditor({
  question,
  readOnly,
  onChange,
}: {
  question: ScreenQuestion;
  readOnly: boolean;
  onChange: (patch: Partial<ScreenQuestion>) => void;
}) {
  const points = question.idealPoints ?? [];
  function update(i: number, patch: Partial<{ label: string; any: string[] }>) {
    const next = points.map((p, j) => (i === j ? { ...p, ...patch } : p));
    onChange({ idealPoints: next });
  }
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-zinc-700">Key points a strong answer covers</span>
      {points.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-2">
          <input className="field-input py-1.5 text-sm" value={p.label} onChange={(e) => update(i, { label: e.target.value })} disabled={readOnly} placeholder="Point (e.g. Verify zero energy)" />
          <div className="flex items-center gap-1">
            <input
              className="field-input flex-1 py-1.5 text-sm"
              value={p.any.join(", ")}
              onChange={(e) => update(i, { any: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              disabled={readOnly}
              placeholder="Keywords, comma-separated"
            />
            {!readOnly ? (
              <button type="button" onClick={() => onChange({ idealPoints: points.filter((_, j) => j !== i) })} className="text-xs text-zinc-400 hover:text-red-600">✕</button>
            ) : null}
          </div>
        </div>
      ))}
      {!readOnly ? (
        <button type="button" onClick={() => onChange({ idealPoints: [...points, { label: "", any: [] }] })} className="text-xs font-medium text-brand-700 hover:underline">+ Add key point</button>
      ) : null}
    </div>
  );
}
