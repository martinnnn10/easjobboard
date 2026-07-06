"use client";

import { useMemo, useState } from "react";
import { ScreenQuestions } from "@/components/ScreenQuestions";
import { DimensionBars } from "@/components/ScreenSignals";
import type { ScreenAnswerValue } from "@/lib/screen-scoring";
import type { PublicScreen } from "@/lib/screens";

type ApplyReport = {
  score: number;
  dimensions: { label: string; score: number }[];
  strengths: string[];
};

export function ApplicationForm({
  orgSlug,
  jobSlug,
  jobTitle,
  screen,
}: {
  orgSlug: string;
  jobSlug: string;
  jobTitle: string;
  screen: PublicScreen | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [desiredPay, setDesiredPay] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<ApplyReport | null>(null);
  // The skills check is opt-in: hidden behind a CTA so it never blocks applying.
  const [screenOpen, setScreenOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ScreenAnswerValue>>({});

  const typeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of screen?.questions ?? []) map[q.id] = q.type;
    return map;
  }, [screen]);

  // Rough time estimate so applicants know the ask up front (~40s/question).
  const estMinutes = Math.max(2, Math.round(((screen?.questions.length ?? 0) * 40) / 60));

  function setAnswer(id: string, value: ScreenAnswerValue) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  // "Really answered" = picked an option or wrote text on a non-ranking question.
  // Ranking alone doesn't count, so peeking at the screen and bailing leaves the
  // application un-scored (pending) rather than scored as a fail.
  function hasRealAnswer(): boolean {
    return Object.entries(answers).some(([id, value]) => {
      const type = typeById[id];
      if (type === "multiple_choice" || type === "experience") return typeof value === "number" && value >= 0;
      if (type === "short_answer" || type === "scenario") return typeof value === "string" && value.trim().length > 0;
      return false;
    });
  }

  function startScreen() {
    // Seed ranking questions to the presented order so an opened screen submits
    // a scoreable ordering the applicant can then rearrange.
    setAnswers((current) => {
      const next = { ...current };
      for (const q of screen?.questions ?? []) {
        if (q.type === "ranking" && q.items && next[q.id] === undefined) {
          next[q.id] = q.items.map((it) => it.id);
        }
      }
      return next;
    });
    setScreenOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!resume) {
      setStatus("error");
      setMessage("Please attach your resume.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("jobSlug", jobSlug);
    formData.append("name", name);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("applicantLocation", location);
    formData.append("desiredPay", desiredPay);
    formData.append("coverLetter", coverLetter);
    formData.append("resume", resume);
    // Only submit the skills check if the applicant actually engaged with it —
    // otherwise it stays optional (application saved, screen left un-scored).
    if (screen && hasRealAnswer()) {
      formData.append("screenKey", screen.key);
      formData.append("screenAnswers", JSON.stringify(answers));
    }

    const response = await fetch(`/api/o/${orgSlug}/apply`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { error?: string; report?: ApplyReport | null };

    if (!response.ok) {
      setStatus("error");
      setMessage(data.error ?? "Application failed");
      return;
    }

    setReport(data.report ?? null);
    setStatus("success");
    setMessage(
      screen && hasRealAnswer()
        ? "Application sent — and because you completed the skills check, you go to the front of the review line."
        : "Application sent. The hiring team will review your resume.",
    );
  }

  if (status === "success") {
    const band =
      report && report.score >= 70
        ? { label: "Strong result", cls: "bg-green-100 text-green-800" }
        : report && report.score >= 45
          ? { label: "Solid result", cls: "bg-amber-100 text-amber-800" }
          : { label: "Thanks for taking it", cls: "bg-zinc-100 text-zinc-700" };
    return (
      <div className="card space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          <h2 className="text-lg font-semibold">Application submitted ✓</h2>
          <p className="mt-1 text-sm">{message}</p>
        </div>

        {report ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label">Your skills check</p>
                <p className="mt-1 text-sm text-zinc-600">Here&apos;s how you did — the hiring team sees this too.</p>
              </div>
              <span className={`inline-flex items-baseline gap-1 rounded-full px-3 py-1 text-lg font-bold ${band.cls}`}>
                {report.score}
                <span className="text-xs font-semibold opacity-70">/100</span>
              </span>
            </div>
            {report.dimensions.length > 0 ? <DimensionBars dimensions={report.dimensions} /> : null}
            {report.strengths.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-green-800">What you showed</p>
                <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
                  {report.strengths.map((s) => (
                    <li key={s}>✓ {s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-zinc-500">{band.label}. Good luck — the team will be in touch.</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Apply for {jobTitle}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Your resume goes straight to the hiring team.
          {screen ? " Want to jump the line? There’s an optional skills check below." : ""}
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Full name *</span>
        <input value={name} onChange={(event) => setName(event.target.value)} className="field-input" required />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email *</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Phone</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Where are you based? (city or ZIP)</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="e.g. Fresno, CA"
            className="field-input"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Desired pay</span>
          <input
            value={desiredPay}
            onChange={(event) => setDesiredPay(event.target.value)}
            placeholder="e.g. $32/hr or $75,000"
            className="field-input"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Resume (PDF, DOC, DOCX) *</span>
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setResume(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-zinc-700"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Cover letter</span>
        <textarea value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} className="field-input min-h-24" />
      </label>

      {screen ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          {!screenOpen ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-6">⚡</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    Optional: take the skills check and get seen first
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">
                    It’s optional — you can submit right now. But hiring managers review candidates who complete the
                    skills check <span className="font-medium">before the resume pile</span>. It’s about {estMinutes}{" "}
                    minutes of real plant-floor questions and it’s the fastest way in front of a person.
                  </p>
                </div>
              </div>
              <div>
                <button type="button" onClick={startScreen} className="btn-primary text-sm">
                  Start the skills check →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="section-label text-blue-700">Skills check · optional</p>
                <p className="mt-1 text-sm text-zinc-700">
                  {screen.blurb} No trick questions — answer the way you actually would on the floor. You can still
                  submit without finishing.
                </p>
              </div>
              <ScreenQuestions questions={screen.questions} answers={answers} onChange={setAnswer} />
            </div>
          )}
        </div>
      ) : null}

      {status === "error" ? <p className="text-sm text-red-600">{message}</p> : null}

      <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
        {status === "loading"
          ? "Submitting…"
          : screen && screenOpen && hasRealAnswer()
            ? "Submit application + skills check"
            : "Submit application"}
      </button>
    </form>
  );
}
