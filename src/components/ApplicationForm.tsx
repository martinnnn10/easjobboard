"use client";

import { useState } from "react";
import { ScreenQuestions } from "@/components/ScreenQuestions";
import { DimensionBars } from "@/components/ScreenSignals";
import type { ScreenAnswerValue } from "@/lib/screen-scoring";
import type { PublicScreen } from "@/lib/screens";

type ApplyReport = {
  score: number;
  dimensions: { label: string; score: number }[];
  strengths: string[];
};

export type ApplyAttribution = {
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export function ApplicationForm({
  orgSlug,
  jobSlug,
  jobTitle,
  screen,
  attribution,
}: {
  orgSlug: string;
  jobSlug: string;
  jobTitle: string;
  screen: PublicScreen | null;
  attribution?: ApplyAttribution;
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

  // The skills check is optional: answers start empty and only count once the
  // candidate actually engages, so skipping submits a clean resume-only app.
  const [answers, setAnswers] = useState<Record<string, ScreenAnswerValue>>({});
  const [answering, setAnswering] = useState(false);

  function setAnswer(id: string, value: ScreenAnswerValue) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  // How many screen questions have a usable answer — drives the progress bar.
  const answeredCount = (screen?.questions ?? []).filter((q) => {
    const v = answers[q.id];
    if (typeof v === "number") return true;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return false;
  }).length;

  // Only submit screen answers when the candidate opted in AND actually
  // answered something — otherwise it's a resume-only (skipped) application.
  const submittingScreen = Boolean(screen && answering && answeredCount > 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!resume) {
      setStatus("error");
      setMessage("Please upload a resume before submitting your application.");
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
    if (submittingScreen && screen) {
      formData.append("screenKey", screen.key);
      formData.append("screenAnswers", JSON.stringify(answers));
    }
    // Distribution attribution: the source/UTM from the apply link plus the
    // browser referrer, so the team can see which channel drove the apply.
    if (attribution?.source) formData.append("source", attribution.source);
    if (attribution?.utm_source) formData.append("utm_source", attribution.utm_source);
    if (attribution?.utm_medium) formData.append("utm_medium", attribution.utm_medium);
    if (attribution?.utm_campaign) formData.append("utm_campaign", attribution.utm_campaign);
    if (typeof document !== "undefined" && document.referrer) {
      formData.append("referrer", document.referrer);
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
      submittingScreen
        ? "Application sent. The hiring team will review your resume and your skills check."
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
          Your resume goes to the hiring team.
          {screen ? " An optional skills check below lets you show what you can actually do." : ""}
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
        <span className="text-sm font-medium">Resume required</span>
        <p className="text-xs text-zinc-500">
          Upload your resume so the hiring team can review your experience. PDF, DOC, or DOCX.
        </p>
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setResume(event.target.files?.[0] ?? null)}
          className="block w-full py-2 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Cover letter</span>
        <textarea value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} className="field-input min-h-24" />
      </label>

      {screen ? (
        <div className="space-y-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <div>
            <p className="section-label text-brand-700">Optional skills check — answer these to stand out</p>
            <p className="mt-1 text-sm text-zinc-700">
              This short screen helps you show what you can actually do, even if your resume does not tell the full
              story. You can skip it, but candidates who complete it are highlighted for the recruiter.
            </p>
          </div>

          {!answering ? (
            <button
              type="button"
              onClick={() => setAnswering(true)}
              className="btn-secondary w-full py-2.5 text-sm sm:w-auto"
            >
              Answer skills questions ({screen.questions.length})
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${screen.questions.length ? (answeredCount / screen.questions.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-zinc-500">
                  {answeredCount}/{screen.questions.length} answered
                </span>
              </div>
              <ScreenQuestions questions={screen.questions} answers={answers} onChange={setAnswer} />
              <button
                type="button"
                onClick={() => {
                  setAnswering(false);
                  setAnswers({});
                }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:underline"
              >
                Skip the skills check instead
              </button>
            </div>
          )}
        </div>
      ) : null}

      {status === "error" ? <p className="text-sm text-red-600">{message}</p> : null}

      {/* Sticky on small screens so the submit is always within thumb reach. */}
      <div className="sticky bottom-0 -mx-6 -mb-5 border-t border-zinc-100 bg-white/95 px-6 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <button type="submit" disabled={status === "loading"} className="btn-primary w-full py-3 text-base">
          {status === "loading"
            ? "Submitting…"
            : screen && !submittingScreen
              ? "Skip & submit application"
              : "Submit application"}
        </button>
      </div>
    </form>
  );
}
