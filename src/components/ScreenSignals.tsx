import type { Badge, BadgeTone, ConfidenceLevel, RiskLevel } from "@/lib/candidate-intel";
import { CONFIDENCE_LABELS, RISK_LEVEL_LABELS } from "@/lib/candidate-intel";
import type { ScreenStatus } from "@/lib/db";

/** Colour band for a 0–100 practical skills score. */
function scoreBand(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800 ring-green-200";
  if (score >= 45) return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-red-100 text-red-800 ring-red-200";
}

/**
 * The primary candidate signal: the practical skills-screen score. This is the
 * number recruiters rank on — resume keyword match is secondary.
 */
export function ScreenScoreBadge({
  score,
  status,
  size = "sm",
}: {
  score: number | null;
  status: ScreenStatus;
  size?: "sm" | "lg";
}) {
  const large = size === "lg";
  if (status !== "completed" || score === null) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-zinc-100 font-medium text-zinc-500 ${
          large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
        }`}
      >
        {status === "pending" ? "Screen not completed" : "No screen"}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ring-1 ${scoreBand(score)} ${
        large ? "px-3.5 py-1.5 text-lg" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {score}
      <span className={large ? "text-sm font-semibold opacity-70" : "text-[10px] font-semibold opacity-70"}>/100</span>
    </span>
  );
}

const TONE_CLASS: Record<BadgeTone, string> = {
  good: "bg-green-50 text-green-700 ring-green-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-red-50 text-red-700 ring-red-200",
  muted: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function BadgeRow({ badges, max }: { badges: Badge[]; max?: number }) {
  const shown = max ? badges.slice(0, max) : badges;
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((badge) => (
        <span
          key={badge.label}
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${TONE_CLASS[badge.tone]}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

const RISK_CLASS: Record<RiskLevel, string> = {
  low: "bg-green-50 text-green-700 ring-green-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-red-50 text-red-700 ring-red-200",
};

export function RiskPill({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${RISK_CLASS[level]}`}>
      {RISK_LEVEL_LABELS[level]}
    </span>
  );
}

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  high: "bg-green-50 text-green-700 ring-green-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-red-50 text-red-700 ring-red-200",
};

/** How much to trust a given score — high/medium/low. */
export function ConfidencePill({ level, reason }: { level: ConfidenceLevel; reason?: string }) {
  return (
    <span
      title={reason}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${CONFIDENCE_CLASS[level]}`}
    >
      <span aria-hidden>◑</span>
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}

/** "Top X% of N" role percentile chip. */
export function PercentileChip({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
        strong ? "bg-green-50 text-green-700 ring-green-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200"
      }`}
    >
      {label}
    </span>
  );
}

function barColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

/**
 * The claim-vs-proof strip: what the resume says (keyword match) beside what the
 * candidate demonstrated on the screen. When paper >> proof, the gap is the
 * whole pitch — the person a keyword ATS would have shortlisted.
 */
export function ClaimVsProof({
  resumeMatch,
  screenScore,
  proofLabel = "Demonstrated ability",
}: {
  resumeMatch: number | null;
  screenScore: number | null;
  proofLabel?: string;
}) {
  const rows: { label: string; value: number | null; kind: "paper" | "proof" }[] = [
    { label: "Resume says (keyword match)", value: resumeMatch, kind: "paper" },
    { label: proofLabel, value: screenScore, kind: "proof" },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-700">{row.label}</span>
            <span className="font-semibold text-zinc-900">{row.value === null ? "—" : row.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full ${
                row.kind === "paper" ? "bg-zinc-400" : barColor(row.value ?? 0)
              }`}
              style={{ width: `${row.value ?? 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bar breakdown of the six competency dimensions. */
export function DimensionBars({ dimensions }: { dimensions: { label: string; score: number }[] }) {
  if (dimensions.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {dimensions.map((dim) => (
        <div key={dim.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-700">{dim.label}</span>
            <span className="font-semibold text-zinc-900">{dim.score}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className={`h-full rounded-full ${barColor(dim.score)}`} style={{ width: `${dim.score}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
