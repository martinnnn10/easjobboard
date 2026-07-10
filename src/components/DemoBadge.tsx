/** Small inline "Demo" pill for sample candidate rows/cards. */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ${className}`}
      title="Sample candidate — demo data"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Demo data
    </span>
  );
}
