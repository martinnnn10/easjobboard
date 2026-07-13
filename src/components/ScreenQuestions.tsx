"use client";

import type { PublicQuestion } from "@/lib/screens";
import type { ScreenAnswerValue } from "@/lib/screen-scoring";

/**
 * Renders the applicant-facing skills screen. Answer keys never reach the
 * browser — this only knows the prompts and options. Ranking questions use
 * up/down reordering so no drag library is needed on the public page.
 */
export function ScreenQuestions({
  questions,
  answers,
  onChange,
}: {
  questions: PublicQuestion[];
  answers: Record<string, ScreenAnswerValue>;
  onChange: (id: string, value: ScreenAnswerValue) => void;
}) {
  const total = questions.length;
  return (
    <div className="space-y-5">
      {questions.map((question, index) => (
        <div key={question.id} className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Question {index + 1} of {total}
          </p>
          <p className="text-base font-semibold text-zinc-900">{question.prompt}</p>
          {question.help ? <p className="text-sm text-zinc-500">{question.help}</p> : null}
          {renderInput(question, answers[question.id], onChange)}
        </div>
      ))}
    </div>
  );
}

function renderInput(
  question: PublicQuestion,
  value: ScreenAnswerValue | undefined,
  onChange: (id: string, value: ScreenAnswerValue) => void,
) {
  if (question.type === "multiple_choice" || question.type === "experience") {
    const selected = typeof value === "number" ? value : null;
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((option, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
              selected === i ? "border-brand-600 bg-brand-50" : "border-zinc-200 hover:border-zinc-300"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              checked={selected === i}
              onChange={() => onChange(question.id, i)}
              className="mt-0.5 h-4 w-4 accent-brand-600"
            />
            <span className="text-zinc-800">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "ranking") {
    const items = question.items ?? [];
    // Current order = stored ids, defaulting to the presented order.
    const order = Array.isArray(value) && value.length === items.length ? value : items.map((it) => it.id);
    const byId = new Map(items.map((it) => [it.id, it.text]));

    function move(from: number, to: number) {
      if (to < 0 || to >= order.length) return;
      const next = [...order];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(question.id, next);
    }

    return (
      <ol className="space-y-1.5">
        {order.map((id, i) => (
          <li
            key={id}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
              {i + 1}
            </span>
            <span className="flex-1 text-zinc-800">{byId.get(id)}</span>
            <span className="flex flex-none gap-1">
              <button
                type="button"
                aria-label="Move up"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="rounded border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(i, i + 1)}
                disabled={i === order.length - 1}
                className="rounded border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  // short_answer / scenario
  return (
    <textarea
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(question.id, event.target.value)}
      className="field-input min-h-24"
      placeholder="Answer in your own words — how you'd actually approach it on the floor."
    />
  );
}
