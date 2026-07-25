"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";

type Member = { id: string; name: string; email: string; role: string; isSelf: boolean };

export function TeamManager({ orgSlug, members }: { orgSlug: string; members: Member[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "recruiter" as Role });
  const [invite, setInvite] = useState<{ email: string; emailed: boolean; tempPassword?: string } | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function memberAction(userId: string, method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/team/${userId}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function addTeammate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInvite(null);
    try {
      const res = await fetch(`/api/o/${orgSlug}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", ...form }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        emailed?: boolean;
        tempPassword?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setInvite({ email: form.email, emailed: Boolean(data.emailed), tempPassword: data.tempPassword });
      setForm({ name: "", email: "", password: "", role: "recruiter" });
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">
                    {m.name} {m.isSelf ? <span className="text-xs font-normal text-zinc-400">(you)</span> : null}
                  </div>
                  <div className="text-zinc-500">{m.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={m.role}
                    disabled={busy || m.isSelf}
                    onChange={(e) => memberAction(m.id, "PATCH", { role: e.target.value })}
                    className="field-input max-w-[12rem] disabled:opacity-60"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {m.isSelf ? (
                    <span className="text-xs text-zinc-400">—</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name} from the team?`)) memberAction(m.id, "DELETE");
                      }}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Sign out every member on all devices? Everyone will need to log in again."))
              post({ action: "revoke_all" });
          }}
          className="btn-secondary text-sm"
        >
          Sign out all sessions
        </button>
        <span className="text-xs text-zinc-500">Revokes every active session in this organization immediately.</span>
      </div>

      <form onSubmit={addTeammate} className="card space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Add a teammate</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="field-input"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="field-input"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Temporary password</span>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="field-input"
              minLength={8}
              placeholder="Leave blank to auto-generate"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="field-input"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          We&apos;ll email the teammate a sign-in link and their temporary password. If email delivery isn&apos;t
          configured in Settings, we&apos;ll show the password here so you can share it.
        </p>
        {invite ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm">
            {invite.emailed ? (
              <p className="text-brand-800">
                Invite emailed to <span className="font-medium">{invite.email}</span>.
              </p>
            ) : (
              <div className="space-y-1 text-zinc-700">
                <p>
                  Added <span className="font-medium">{invite.email}</span>. Email delivery isn&apos;t configured, so
                  share this temporary password with them:
                </p>
                <p className="font-mono text-sm font-semibold text-zinc-900">{invite.tempPassword}</p>
              </div>
            )}
          </div>
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Add teammate"}
        </button>
      </form>
    </div>
  );
}
