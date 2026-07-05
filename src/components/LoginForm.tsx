"use client";

import { useState } from "react";

export function LoginForm({ nextPath, orgSlug }: { nextPath?: string; orgSlug?: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Use XMLHttpRequest to bypass any Next.js fetch interception
    // and avoid being blocked by the browser's HTTP/1.1 connection pool
    // which can be exhausted by RSC prefetch requests.
    const result = await new Promise<{ ok: boolean; data: Record<string, unknown> }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/auth/login", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
        } catch {
          resolve({ ok: false, data: { error: "Invalid response" } });
        }
      };
      xhr.onerror = () => {
        resolve({ ok: false, data: { error: "Network error" } });
      };
      xhr.ontimeout = () => {
        resolve({ ok: false, data: { error: "Request timed out" } });
      };
      xhr.timeout = 15000;
      xhr.send(JSON.stringify({ email, password, orgSlug }));
    });

    setLoading(false);

    if (!result.ok) {
      setError((result.data.error as string) ?? "Login failed");
      return;
    }

    const slug = (result.data.organization as { slug: string })?.slug;
    if (!slug) {
      setError("Organization not found");
      return;
    }

    // Use full page navigation to avoid RSC state tree issues
    window.location.href = nextPath || `/o/${slug}/admin`;
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">Access your organization admin portal.</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input
          type="email"
          name="email"
          className="field-input"
          required
          autoFocus
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700">Password</span>
        <input
          type="password"
          name="password"
          className="field-input"
          required
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
