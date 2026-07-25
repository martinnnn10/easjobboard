"use client";

import Link from "next/link";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset your password.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="card mx-auto w-full max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Invalid reset link</h1>
        <p className="text-sm text-zinc-600">This link is missing its token. Request a new password reset.</p>
        <Link href="/forgot-password" className="btn-primary inline-block">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card mx-auto w-full max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Password updated</h1>
        <p className="text-sm text-zinc-600">
          Your password has been reset and you&apos;ve been signed out everywhere. Sign in with your new password.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-zinc-600">Enter a new password for your account.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">New password</span>
        <input type="password" name="password" className="field-input" minLength={8} required autoFocus />
        <span className="text-xs text-zinc-500">At least 8 characters.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">Confirm new password</span>
        <input type="password" name="confirm" className="field-input" minLength={8} required />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
