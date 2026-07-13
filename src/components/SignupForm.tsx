"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEAT_PRICE_USD, TRIAL_DAYS } from "@/lib/pricing";

const COMPANY_TYPES = [
  { value: "employer", label: "Employer" },
  { value: "agency", label: "Recruiting agency" },
  { value: "other", label: "Other" },
];

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    orgName: "",
    companyType: "employer",
    adminName: "",
    adminEmail: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

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

    router.push(`/o/${data.organization!.slug}/admin/onboarding`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto w-full max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Start your {TRIAL_DAYS}-day free trial</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Create your workspace in under a minute. You can add branding, your resume inbox, and teammates later.
        </p>
      </div>

      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          <li>· {TRIAL_DAYS}-day free trial</li>
          <li>· No credit card required</li>
          <li>· From ${SEAT_PRICE_USD}/month per seat after the trial</li>
          <li>· Cancel anytime</li>
        </ul>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Your name *</span>
        <input value={values.adminName} onChange={(e) => set("adminName", e.target.value)} className="field-input" required />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Work email *</span>
        <input
          type="email"
          value={values.adminEmail}
          onChange={(e) => set("adminEmail", e.target.value)}
          className="field-input"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Password *</span>
        <input
          type="password"
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          className="field-input"
          minLength={8}
          required
        />
        <span className="text-xs text-zinc-500">At least 8 characters.</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Organization name *</span>
        <input
          value={values.orgName}
          onChange={(e) => set("orgName", e.target.value)}
          className="field-input"
          placeholder="Your company or agency"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">What best describes you?</span>
        <select value={values.companyType} onChange={(e) => set("companyType", e.target.value)} className="field-input">
          {COMPANY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Creating your workspace…" : "Start free trial"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          No credit card required. Your {TRIAL_DAYS}-day trial starts as soon as your workspace is created.
        </p>
      </div>
    </form>
  );
}
