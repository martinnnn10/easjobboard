import { ClaimVsProof } from "@/components/ScreenSignals";

/**
 * Honest, static product previews for the marketing homepage — built from the
 * same UI vocabulary as the real app (score badges, call rows, claim-vs-proof
 * bars) rather than screenshots that drift out of date. Nothing here implies a
 * feature that doesn't exist in the product.
 */

function Chrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="ml-2 text-[11px] font-medium text-zinc-500">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Score({ value, tone = "brand" }: { value: number; tone?: "brand" | "amber" | "red" }) {
  const styles = {
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  }[tone];
  return (
    <span className={`inline-flex items-baseline gap-0.5 rounded-full px-2.5 py-1 text-sm font-bold ring-1 ${styles}`}>
      {value}
      <span className="text-[10px] font-medium opacity-70">/100</span>
    </span>
  );
}

export function ProductPreviews() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Call queue */}
      <Chrome title="Call Queue — ranked by ability">
        <div className="space-y-2.5">
          {[
            { n: "Marcus Hill", role: "Industrial Electrician", score: 92, tone: "brand" as const, note: "Call first" },
            { n: "Danny Cruz", role: "Controls / PLC Tech", score: 74, tone: "amber" as const, note: "Worth a screen" },
            { n: "Ray Delgado", role: "Maintenance Tech", score: 68, tone: "amber" as const, note: "Follow-up due" },
          ].map((r, i) => (
            <div key={r.n} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2">
              <span className="w-4 text-sm font-bold text-zinc-300">{i + 1}</span>
              <Score value={r.score} tone={r.tone} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">{r.n}</p>
                <p className="truncate text-xs text-zinc-500">{r.role}</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                {r.note}
              </span>
            </div>
          ))}
        </div>
      </Chrome>

      {/* Candidate profile / why this candidate */}
      <Chrome title="Candidate profile — Why this candidate?">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Marcus Hill</p>
              <p className="text-xs text-zinc-500">Industrial Electrician · 2nd shift</p>
            </div>
            <Score value={92} />
          </div>
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
            Recommended: Call first — strong practical signal
          </p>
          <ul className="space-y-1 text-xs text-zinc-600">
            <li className="flex gap-1.5"><span className="text-brand-600">•</span> Strong troubleshooting on live 480V fault scenario</li>
            <li className="flex gap-1.5"><span className="text-brand-600">•</span> Correctly sequenced lockout/tagout steps</li>
            <li className="flex gap-1.5"><span className="text-amber-500">•</span> Verify VFD programming depth on the phone screen</li>
          </ul>
        </div>
      </Chrome>

      {/* Skills screen results */}
      <Chrome title="Skills screen results">
        <div className="space-y-2.5">
          {[
            { label: "Electrical / controls knowledge", score: 88 },
            { label: "Troubleshooting method", score: 81 },
            { label: "Safety judgment", score: 90 },
            { label: "Mechanical aptitude", score: 64 },
          ].map((d) => (
            <div key={d.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-700">{d.label}</span>
                <span className="font-semibold text-zinc-900">{d.score}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${d.score >= 70 ? "bg-brand-500" : "bg-amber-400"}`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Chrome>

      {/* Resume trap / claim vs proof */}
      <Chrome title="Interview kit — claim vs. proof">
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            What the resume claimed against what the candidate actually demonstrated.
          </p>
          <ClaimVsProof resumeMatch={88} screenScore={61} />
        </div>
      </Chrome>
    </div>
  );
}
