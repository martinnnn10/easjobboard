"use client";

import { useState } from "react";

export function AcceptInviteForm({ token, email, orgName }: { token: string; email: string; orgName: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; orgSlug?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't accept the invitation.");
        return;
      }
      // Full navigation so the new session cookie is picked up.
      window.location.href = `/o/${data.orgSlug}/admin`;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Join {orgName}</h1>
        <p className="mt-1 text-sm text-zinc-600">Set up your account to start reviewing candidates.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input value={email} readOnly className="field-input bg-zinc-50 text-zinc-500" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Your name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Create a password *</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
          minLength={8}
          required
        />
        <span className="text-xs text-zinc-500">At least 8 characters.</span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Setting up…" : "Join the team"}
      </button>
    </form>
  );
}
