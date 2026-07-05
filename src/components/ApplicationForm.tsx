"use client";

import { useState } from "react";

export function ApplicationForm({
  orgSlug,
  jobSlug,
  jobTitle,
}: {
  orgSlug: string;
  jobSlug: string;
  jobTitle: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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
    formData.append("coverLetter", coverLetter);
    formData.append("resume", resume);

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
    setMessage("Application sent. The hiring team will review your resume.");
    setName("");
    setEmail("");
    setPhone("");
    setCoverLetter("");
    setResume(null);
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
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Apply for {jobTitle}</h2>
        <p className="mt-1 text-sm text-zinc-600">Your resume is sent directly to the hiring team.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Full name *</span>
        <input value={name} onChange={(event) => setName(event.target.value)} className="field-input" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Email *</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Phone</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} className="field-input" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Cover letter</span>
        <textarea value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} className="field-input min-h-28" />
      </label>

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

      {status === "error" ? <p className="text-sm text-red-600">{message}</p> : null}

      <button type="submit" disabled={status === "loading"} className="btn-primary">
        {status === "loading" ? "Sending..." : "Submit application"}
      </button>
    </form>
  );
}
