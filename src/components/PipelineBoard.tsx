"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeRow, ScreenScoreBadge } from "@/components/ScreenSignals";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/application-status";
import type { Badge } from "@/lib/candidate-intel";
import type { ScreenStatus } from "@/lib/db";

export type PipelineCard = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  screenScore: number | null;
  screenStatus: ScreenStatus;
  badges: Badge[];
  status: ApplicationStatus;
  appliedAt: string;
};

const COLUMN_ACCENTS: Record<ApplicationStatus, string> = {
  new: "border-t-blue-400",
  screening: "border-t-amber-400",
  interview: "border-t-violet-400",
  offer: "border-t-teal-400",
  hired: "border-t-green-500",
  rejected: "border-t-red-400",
};

/**
 * Drag-and-drop pipeline: drag a candidate card between stage columns; the
 * stage change is saved optimistically and reverted if the API call fails.
 */
export function PipelineBoard({
  orgSlug,
  initialCards,
  readOnly = false,
}: {
  orgSlug: string;
  initialCards: PipelineCard[];
  readOnly?: boolean;
}) {
  const [cards, setCards] = useState(initialCards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState("");

  async function moveCard(id: string, status: ApplicationStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;

    const previous = card.status;
    setCards((current) => current.map((c) => (c.id === id ? { ...c, status } : c)));
    setError("");

    try {
      const response = await fetch(`/api/o/${orgSlug}/applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setCards((current) => current.map((c) => (c.id === id ? { ...c, status: previous } : c)));
      setError("Couldn't save that move — please try again.");
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {APPLICATION_STATUSES.map((status) => {
          const columnCards = cards.filter((card) => card.status === status);
          return (
            <div
              key={status}
              onDragOver={readOnly ? undefined : (event) => {
                event.preventDefault();
                setOverColumn(status);
              }}
              onDragLeave={readOnly ? undefined : () => setOverColumn((current) => (current === status ? null : current))}
              onDrop={readOnly ? undefined : (event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || dragId;
                setOverColumn(null);
                setDragId(null);
                if (id) void moveCard(id, status);
              }}
              className={`flex min-h-48 flex-col rounded-xl border border-zinc-200 border-t-4 bg-zinc-50 ${COLUMN_ACCENTS[status]} ${
                overColumn === status ? "ring-2 ring-blue-300" : ""
              }`}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold text-zinc-800">{APPLICATION_STATUS_LABELS[status]}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {columnCards.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {columnCards.map((card) => (
                  <div
                    key={card.id}
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : (event) => {
                      event.dataTransfer.setData("text/plain", card.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragId(card.id);
                    }}
                    onDragEnd={readOnly ? undefined : () => setDragId(null)}
                    className={`rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition ${
                      readOnly ? "" : "cursor-grab active:cursor-grabbing"
                    } ${dragId === card.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/o/${orgSlug}/admin/applications/${card.id}`}
                        className="block text-sm font-medium text-zinc-900 hover:text-blue-700"
                      >
                        {card.name}
                      </Link>
                      <ScreenScoreBadge score={card.screenScore} status={card.screenStatus} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{card.jobTitle}</p>
                    {card.badges.length > 0 ? (
                      <div className="mt-2">
                        <BadgeRow badges={card.badges} max={2} />
                      </div>
                    ) : null}
                    <p className="mt-2 text-[11px] text-zinc-400">
                      {new Date(card.appliedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        {readOnly
          ? "Read-only view. Click a name to open their full profile and activity."
          : "Drag a card to move a candidate between stages. Click a name to open their full profile and activity."}
      </p>
    </div>
  );
}
