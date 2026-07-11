"use client";

import { useMemo, useState } from "react";
import { ScreenQuestions } from "@/components/ScreenQuestions";
import type { PublicScreen } from "@/lib/screens";
import type { ScreenAnswerValue } from "@/lib/screen-scoring";

/**
 * Candidate-facing skills screen. No login — the token in the URL is the
 * credential. Answer keys never reach here (the server strips them), so this
 * only knows prompts and options. On submit it posts the answers and shows a
 * plain confirmation.
 */
export function PublicScreenForm({
  token,
  screen,
  orgName,
  jobTitle,
}: {
  token: string;
  screen: PublicScreen;
  orgName: string;
  jobTitle: string;
}) {
  const [answers, setAnswers] = useState<Record<string, ScreenAnswerValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const total = screen.questions.length;
  const answered = useMemo(
    () =>
      Object.values(answers).filter(
        (v) => v !== "" && v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0),
      ).length,
    [answers],
  );

  function setAnswer(id: string, value: ScreenAnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (answered === 0) {
      setError("Please answer at least one question before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/screen/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-bold text-zinc-900">Screen complete — thank you</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Thanks for taking the time. {orgName}&apos;s hiring team now has a clearer picture of what you can actually do
          {jobTitle ? ` for the ${jobTitle} role` : ""}. If you&apos;re a fit, someone will be in touch about next steps.
        </p>
        <p className="mt-4 text-xs text-zinc-400">You can close this page.</p>
      </div>
    );
  }

  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Progress */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:rounded-xl sm:border sm:mx-0">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
          <span>
            {answered} of {total} answered
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ScreenQuestions questions={screen.questions} answers={answers} onChange={setAnswer} />

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      ) : null}

      <div className="space-y-2">
        <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
          {busy ? "Submitting…" : "Submit my screen"}
        </button>
        <p className="text-center text-xs text-zinc-400">
          Your answers go straight to {orgName}&apos;s hiring team. This isn&apos;t a timed test — answer in your own
          words.
        </p>
      </div>
    </form>
  );
}
