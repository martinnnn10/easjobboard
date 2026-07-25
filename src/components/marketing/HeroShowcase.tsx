/**
 * The hero product visual: the Resume Trap at a glance. A high resume match
 * against a low demonstrated-ability score, with the recommended action — the
 * single image that communicates "this platform tells me who's actually worth
 * calling." Built from the real app's UI vocabulary (score chips, ability
 * bars), never a fake screenshot or invented metric.
 */

function Bar({ label, value, tone }: { label: string; value: number; tone: "steel" | "warn" | "go" }) {
  const fill =
    tone === "go" ? "bg-brand-500" : tone === "warn" ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-600">{label}</span>
        <span className="font-semibold text-zinc-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function HeroShowcase() {
  return (
    <div className="relative">
      {/* Soft steel glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-400/20 via-transparent to-slate-400/10 blur-2xl"
      />

      {/* Contrast candidate peeking behind — "Call first" */}
      <div className="absolute -right-3 -top-5 hidden w-64 rotate-2 rounded-2xl border border-white/10 bg-[#1b1d22] p-4 shadow-xl sm:block">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Marcus Hill</p>
            <p className="text-[11px] text-zinc-400">Industrial Electrician</p>
          </div>
          <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[11px] font-semibold text-brand-300">
            Call first
          </span>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>Demonstrated ability</span>
            <span className="font-semibold text-brand-300">92</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-400" style={{ width: "92%" }} />
          </div>
        </div>
      </div>

      {/* Foreground card — the Resume Trap */}
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Jordan Blake</p>
            <p className="text-xs text-zinc-500">Maintenance Technician · applied 2d ago</p>
          </div>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200">
            Resume Trap
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <Bar label="Resume match" value={88} tone="steel" />
          <Bar label="Demonstrated ability" value={34} tone="warn" />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span aria-hidden className="mt-px">
            ⚠
          </span>
          <span>Strong keywords, weak troubleshooting evidence on the live-fault scenario.</span>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Recommended</span>
          <span className="text-sm font-semibold text-zinc-900">Verify before you interview</span>
        </div>
      </div>
    </div>
  );
}
