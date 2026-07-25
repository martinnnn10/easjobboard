"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const email = new FormData(event.currentTarget).get("email") as string;
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card mx-auto w-full max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Check your email</h1>
        <p className="text-sm text-zinc-600">
          If an account exists for that email, we&apos;ve sent a link to reset your password. The link expires in 1 hour.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Reset your password</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your work email and we&apos;ll send you a link to set a new password.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input type="email" name="email" className="field-input" required autoFocus />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-zinc-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
