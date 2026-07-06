"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { EMAIL_TEMPLATES, renderTemplate, type TemplateTokens } from "@/lib/email-templates";

/**
 * Compose-and-send panel for the candidate detail page. Templates pre-fill from
 * the pipeline stage; optionally moves the candidate to the template's stage in
 * the same action ("advance with email").
 */
export function EmailPanel({
  orgSlug,
  applicationId,
  currentStatus,
  tokens,
}: {
  orgSlug: string;
  applicationId: string;
  currentStatus: ApplicationStatus;
  tokens: TemplateTokens;
}) {
  const defaultTemplate =
    EMAIL_TEMPLATES.find((t) => t.stage === currentStatus) ?? EMAIL_TEMPLATES[EMAIL_TEMPLATES.length - 1];

  const [templateId, setTemplateId] = useState(defaultTemplate.id);
  const [subject, setSubject] = useState(renderTemplate(defaultTemplate.subject, tokens));
  const [body, setBody] = useState(renderTemplate(defaultTemplate.body, tokens));
  const [moveStage, setMoveStage] = useState(true);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const template = EMAIL_TEMPLATES.find((t) => t.id === templateId) ?? defaultTemplate;
  const offerMove = template.stage !== null && template.stage !== currentStatus;

  function applyTemplate(id: string) {
    const next = EMAIL_TEMPLATES.find((t) => t.id === id);
    if (!next) return;
    setTemplateId(id);
    setSubject(renderTemplate(next.subject, tokens));
    setBody(renderTemplate(next.body, tokens));
    setNote(null);
  }

  const router = useRouter();

  async function handleSend() {
    setSending(true);
    setNote(null);
    try {
      const response = await fetch(`/api/o/${orgSlug}/applications/${applicationId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setNote({ kind: "error", text: data?.error ?? "Couldn't send the email." });
        return;
      }

      let moved = false;
      if (offerMove && moveStage && template.stage) {
        const stageResponse = await fetch(`/api/o/${orgSlug}/applications/${applicationId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: template.stage }),
        });
        moved = stageResponse.ok;
      }

      setNote({
        kind: "ok",
        text: moved
          ? `Email sent and candidate moved to ${APPLICATION_STATUS_LABELS[template.stage!]}.`
          : "Email sent.",
      });
      router.refresh();
    } catch {
      setNote({ kind: "error", text: "Couldn't send the email." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Template</span>
        <select value={templateId} onChange={(event) => applyTemplate(event.target.value)} className="field-input">
          {EMAIL_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Subject</span>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} className="field-input" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Message</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} className="field-input min-h-44" />
      </label>

      {offerMove ? (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={moveStage}
            onChange={(event) => setMoveStage(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Also move candidate to <span className="font-medium">{APPLICATION_STATUS_LABELS[template.stage!]}</span>
        </label>
      ) : null}

      {note ? (
        <p className={`text-sm ${note.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{note.text}</p>
      ) : null}

      <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()} className="btn-primary">
        {sending ? "Sending…" : offerMove && moveStage ? "Send & advance" : "Send email"}
      </button>
      <p className="text-xs text-zinc-500">
        Sent from {tokens.orgName} via the platform — replies go to your hiring inbox.
      </p>
    </div>
  );
}
