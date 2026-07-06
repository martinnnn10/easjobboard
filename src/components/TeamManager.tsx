"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";

type Member = { id: string; name: string; email: string; role: string; joinedAt: string; isSelf: boolean };
type PendingInvite = { id: string; email: string; role: string; inviteUrl: string; invitedBy: string };

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-blue-100 text-blue-800",
  recruiter: "bg-zinc-100 text-zinc-700",
  viewer: "bg-amber-100 text-amber-800",
};

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="text-xs font-medium text-blue-600 hover:underline"
    >
      {copied ? "Copied ✓" : "Copy invite link"}
    </button>
  );
}

export function TeamManager({
  orgSlug,
  members,
  invites,
  canManage,
}: {
  orgSlug: string;
  members: Member[];
  invites: PendingInvite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("recruiter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [justInvited, setJustInvited] = useState<{ email: string; url: string } | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setJustInvited(null);
    try {
      const res = await fetch(`/api/o/${orgSlug}/team/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; email?: string; inviteUrl?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't send the invite.");
        return;
      }
      setJustInvited({ email: data.email ?? email, url: data.inviteUrl ?? "" });
      setEmail("");
      router.refresh();
    } catch {
      setError("Couldn't send the invite. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/o/${orgSlug}/team/invite/${id}/revoke`, { method: "POST" });
    router.refresh();
  }

  async function changeRole(memberId: string, nextRole: string) {
    const res = await fetch(`/api/o/${orgSlug}/team/member/${memberId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Couldn't change that role.");
    } else {
      setError("");
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Invite a teammate</h2>
          <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
            <label className="flex-1 space-y-1" style={{ minWidth: "14rem" }}>
              <span className="text-sm font-medium">Their work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@yourcompany.com"
                className="field-input"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="field-input">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Sending…" : "Send invite"}
            </button>
          </form>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {justInvited ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              Invited <span className="font-medium">{justInvited.email}</span>. We emailed them a link — or share it
              directly:
              <div className="mt-1 flex items-center gap-3">
                <code className="max-w-full truncate rounded bg-white px-2 py-1 text-xs text-zinc-700">
                  {justInvited.url}
                </code>
                <CopyLink url={justInvited.url} />
              </div>
            </div>
          ) : null}
          <p className="text-xs text-zinc-500">
            <span className="font-medium">Admin</span> can manage the team · <span className="font-medium">Recruiter</span>{" "}
            can post jobs and work candidates · <span className="font-medium">Viewer</span> is read-only. Invites expire
            in 7 days.
          </p>
        </section>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Only admins can invite teammates or change roles. Ask an admin if you need access changed.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Members ({members.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {m.name}
                    {m.isSelf ? <span className="ml-2 text-xs font-normal text-zinc-400">(you)</span> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{m.email}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role] ?? ROLE_BADGE.viewer}`}>
                        {ROLE_LABELS[(m.role as Role)] ?? m.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{new Date(m.joinedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && invites.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Pending invites ({invites.length})</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Invited by</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 text-zinc-800">{inv.email}</td>
                    <td className="px-4 py-3 text-zinc-600">{ROLE_LABELS[(inv.role as Role)] ?? inv.role}</td>
                    <td className="px-4 py-3 text-zinc-600">{inv.invitedBy || "—"}</td>
                    <td className="px-4 py-3">
                      <CopyLink url={inv.inviteUrl} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => revoke(inv.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
