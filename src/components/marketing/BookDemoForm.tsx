"use client";

import { useState } from "react";
import Link from "next/link";

export function BookDemoForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          company: form.get("company"),
          role: form.get("role"),
          challenge: form.get("challenge"),
          notes: form.get("notes"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700">
          ✓
        </div>
        <h2 className="text-xl font-semibold text-zinc-900">Thanks — we&apos;ll be in touch.</h2>
        <p className="text-sm text-zinc-600">
          We got your request and will reach out at the email you provided to set up a time. In the meantime, you can
          start a free trial and explore the demo workspace.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link href="/signup" className="btn-primary">
            Start free trial
          </Link>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Name *</span>
          <input name="name" required className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Work email *</span>
          <input name="email" type="email" required className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Company</span>
          <input name="company" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Your role</span>
          <input name="role" placeholder="e.g. Recruiter, Plant Manager" className="field-input" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">What&apos;s your biggest hiring challenge?</span>
        <textarea name="challenge" className="field-input min-h-20" placeholder="e.g. Too many interviews with candidates who can't do the work" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Preferred time / notes</span>
        <textarea name="notes" className="field-input min-h-16" placeholder="Time zone, availability, anything else" />
      </label>

      {status === "error" ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={status === "loading"} className="btn-primary w-full py-3">
        {status === "loading" ? "Sending…" : "Request a demo"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        Prefer to dive in? <Link href="/signup" className="text-brand-700 hover:underline">Start a free trial</Link> — no
        credit card required.
      </p>
    </form>
  );
}
