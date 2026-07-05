"use client";

import { useMemo, useState } from "react";
import { ScreenQuestions } from "@/components/ScreenQuestions";
import type { ScreenAnswerValue } from "@/lib/screen-scoring";
import type { PublicScreen } from "@/lib/screens";

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

  // Ranking questions start pre-populated with the presented order so an
  // untouched ranking still submits a (scoreable) answer.
  const initialAnswers = useMemo(() => {
    const seed: Record<string, ScreenAnswerValue> = {};
    for (const q of screen?.questions ?? []) {
      if (q.type === "ranking" && q.items) seed[q.id] = q.items.map((it) => it.id);
    }
    return seed;
  }, [screen]);
  const [answers, setAnswers] = useState<Record<string, ScreenAnswerValue>>(initialAnswers);

  function setAnswer(id: string, value: ScreenAnswerValue) {
    setAnswers((current) => ({ ...current, [id]: value }));
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
    if (screen) {
      formData.append("screenKey", screen.key);
      formData.append("screenAnswers", JSON.stringify(answers));
    }

    const response = await fetch(`/api/o/${orgSlug}/apply`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(data.error ?? "Application failed");
      return;
    }

    setStatus("success");
    setMessage("Application sent. The hiring team will review your resume and your skills check.");
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-green-900">
        <h2 className="text-lg font-semibold">Application submitted</h2>
        <p className="mt-2 text-sm">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Apply for {jobTitle}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Your resume goes to the hiring team.
          {screen ? " A short skills check below helps them see you can actually do the work." : ""}
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
        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div>
            <p className="section-label text-blue-700">Skills check</p>
            <p className="mt-1 text-sm text-zinc-700">
              {screen.blurb} There are no trick questions — answer the way you actually would on the floor.
            </p>
          </div>
          <ScreenQuestions questions={screen.questions} answers={answers} onChange={setAnswer} />
        </div>
      ) : null}

      {status === "error" ? <p className="text-sm text-red-600">{message}</p> : null}

      <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
        {status === "loading" ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
