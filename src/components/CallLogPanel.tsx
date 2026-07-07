"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { CALL_OUTCOMES, CHANNEL_LABELS, type CallChannel } from "@/lib/call-outcomes";

function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

export function CallLogPanel({
  orgSlug,
  candidateId,
  applicationId,
  phone,
  email,
  currentStatus,
}: {
  orgSlug: string;
  candidateId: string;
  applicationId?: string;
  phone?: string;
  email?: string;
  currentStatus?: ApplicationStatus;
}) {
  const router = useRouter();
  const tel = phone ? telHref(phone) : null;
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CallChannel>("call");
  const [outcome, setOutcome] = useState<string>(CALL_OUTCOMES[0].key);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const outcomeMeta = CALL_OUTCOMES.find((o) => o.key === outcome);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/o/${orgSlug}/candidates/${candidateId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          outcome,
          note,
          follow_up_at: followUp || undefined,
          application_id: applicationId,
          status: status || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't log that.");
        return;
      }
      setOpen(false);
      setNote("");
      setFollowUp("");
      setStatus("");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {tel ? (
          <a href={`tel:${tel}`} className="btn-primary text-sm">
            Call
          </a>
        ) : null}
        {tel ? (
          <a href={`sms:${tel}`} className="btn-secondary text-sm">
            Text
          </a>
        ) : null}
        {email ? (
          <a href={`mailto:${email}`} className="btn-secondary text-sm">
            Email
          </a>
        ) : null}
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary text-sm">
          {open ? "Cancel" : "Log outcome"}
        </button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CHANNEL_LABELS) as CallChannel[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  channel === c
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">Outcome</span>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="field-input py-2 text-sm">
                {CALL_OUTCOMES.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">
                Follow-up date {outcomeMeta?.followUp ? "" : "(optional)"}
              </span>
              <input
                type="date"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="field-input py-2 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was said, next step…"
              className="field-input py-2 text-sm"
            />
          </label>

          {applicationId ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-600">Move to stage (optional)</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input py-2 text-sm">
                <option value="">Keep current{currentStatus ? ` (${APPLICATION_STATUS_LABELS[currentStatus]})` : ""}</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="button" onClick={save} disabled={busy} className="btn-primary text-sm">
            {busy ? "Saving…" : "Save to timeline"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
