function bandClass(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-zinc-100 text-zinc-600";
}

/**
 * Presentational match-score badge + matched skill chips for the applicants
 * table. `score` is null when the job had no recognizable skills to match.
 */
export function MatchScore({ score, skills }: { score: number | null; skills: string[] }) {
  return (
    <div className="space-y-1">
      {score === null ? (
        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
          Not scored
        </span>
      ) : (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandClass(score)}`}>
          {score}% match
        </span>
      )}
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {skills.slice(0, 5).map((skill) => (
            <span key={skill} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
              {skill}
            </span>
          ))}
          {skills.length > 5 ? (
            <span className="text-[11px] text-zinc-400">+{skills.length - 5}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
