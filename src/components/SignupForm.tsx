"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    orgName: "",
    website: "",
    brandColor: "#2563eb",
    applicationEmail: "",
    adminName: "",
    adminEmail: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = (await response.json()) as { error?: string; organization?: { slug: string } };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Signup failed");
      return;
    }

    router.push(`/o/${data.organization!.slug}/admin`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Create your organization</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Each organization gets its own careers portal, job board feed, and applicant inbox.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Organization name *</span>
          <input
            value={values.orgName}
            onChange={(event) => setValues((current) => ({ ...current, orgName: event.target.value }))}
            className="field-input"
            placeholder="Electrical Automation Services Inc"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Website</span>
          <input
            value={values.website}
            onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))}
            className="field-input"
            placeholder="https://example.com"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Brand color</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={values.brandColor}
              onChange={(event) => setValues((current) => ({ ...current, brandColor: event.target.value }))}
              className="h-10 w-14 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1"
            />
            <span className="text-xs text-zinc-500">Used on your careers page and job flyers.</span>
          </div>
        </label>

        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Resume delivery email *</span>
          <input
            type="email"
            value={values.applicationEmail}
            onChange={(event) => setValues((current) => ({ ...current, applicationEmail: event.target.value }))}
            className="field-input"
            placeholder="hiring@yourcompany.com"
            required
          />
          <p className="text-xs text-zinc-500">Applications with resume attachments are sent here.</p>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Your name *</span>
          <input
            value={values.adminName}
            onChange={(event) => setValues((current) => ({ ...current, adminName: event.target.value }))}
            className="field-input"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Your email *</span>
          <input
            type="email"
            value={values.adminEmail}
            onChange={(event) => setValues((current) => ({ ...current, adminEmail: event.target.value }))}
            className="field-input"
            required
          />
        </label>

        <label className="block space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Password *</span>
          <input
            type="password"
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            className="field-input"
            minLength={8}
            required
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating..." : "Create organization"}
      </button>
    </form>
  );
}
