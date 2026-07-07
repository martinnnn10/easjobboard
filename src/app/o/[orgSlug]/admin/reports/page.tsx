import { notFound } from "next/navigation";
import { requireOrgSession } from "@/lib/auth";
import { CANDIDATE_SOURCE_LABELS, isCandidateSource } from "@/lib/candidate-meta";
import { getOrganizationBySlug } from "@/lib/organizations";
import { getReportData } from "@/lib/reports";

type PageProps = { params: Promise<{ orgSlug: string }> };

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="card">
      <p className="section-label">{label}</p>
      <p className={`stat-value mt-2 ${tone ?? "text-zinc-900"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export default async function ReportsPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);
  const r = getReportData(organization.id);

  const noData = r.totalApplicants === 0;

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reports</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Proof the screen saves time and improves quality. Figures come from your real activity — nothing is estimated.
        </p>
      </div>

      {noData ? (
        <div className="card space-y-2 py-10 text-center">
          <p className="font-medium text-zinc-800">No applicant data yet.</p>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            Once candidates apply and complete skills screens, this page fills in — screen completion, average scores by
            role, source quality, calls logged, time to first contact, and hires.
          </p>
        </div>
      ) : (
        <>
          {/* Funnel headline */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Applicants" value={String(r.totalApplicants)} />
            <Stat
              label="Screen completion"
              value={r.screenCompletionRate === null ? "—" : `${r.screenCompletionRate}%`}
              hint={`${r.screened} of ${r.totalApplicants} screened`}
            />
            <Stat label="Avg skills score" value={r.avgScore === null ? "—" : String(r.avgScore)} tone="text-brand-700" />
            <Stat
              label="Time to first contact"
              value={r.timeToFirstContactDays === null ? "—" : `${r.timeToFirstContactDays}d`}
              hint={r.timeToFirstContactDays === null ? "No calls logged yet" : "avg from apply to first outreach"}
            />
          </section>

          {/* Quality + outcomes */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Strong-fit" value={String(r.strongFit)} tone="text-brand-700" />
            <Stat label="Needs review" value={String(r.needsReview)} tone="text-amber-600" />
            <Stat label="High-risk" value={String(r.highRisk)} tone="text-red-600" />
            <Stat
              label="Open roles, no strong candidate"
              value={String(r.openRolesNoStrong)}
              hint={`of ${r.openPublishedRoles} published`}
              tone={r.openRolesNoStrong > 0 ? "text-amber-600" : "text-zinc-900"}
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Calls logged" value={String(r.callsLogged)} />
            <Stat label="Submitted to hiring manager" value={String(r.submittedToHM)} tone="text-brand-700" />
            <Stat label="In interview" value={String(r.inInterview)} />
            <Stat label="Hired" value={String(r.hired)} tone="text-brand-700" />
          </section>

          {/* Applicants by source */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Applicants by source</h2>
            {r.bySource.length === 0 ? (
              <div className="card text-sm text-zinc-500">No candidates in the pool yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 text-right font-medium">Candidates</th>
                      <th className="px-4 py-3 text-right font-medium">Strong-fit</th>
                      <th className="px-4 py-3 text-right font-medium">Strong-fit rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.bySource.map((s) => {
                      const label = isCandidateSource(s.source) ? CANDIDATE_SOURCE_LABELS[s.source] : s.source;
                      const rate = s.applicants === 0 ? 0 : Math.round((s.strongFit / s.applicants) * 100);
                      return (
                        <tr key={s.source} className="border-b border-zinc-100 last:border-0">
                          <td className="px-4 py-3 text-zinc-800">{label}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-700">{s.applicants}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-700">{s.strongFit}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-zinc-600">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Avg score by role */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Average skills score by role</h2>
            {r.avgScoreByRole.length === 0 ? (
              <div className="card text-sm text-zinc-500">
                No completed screens yet — averages appear once candidates finish a skills screen.
              </div>
            ) : (
              <div className="space-y-2">
                {r.avgScoreByRole.map((role) => (
                  <div key={role.job} className="card flex items-center gap-4 py-3">
                    <div className="min-w-[10rem] flex-1">
                      <p className="text-sm font-medium text-zinc-900">{role.job}</p>
                      <p className="text-xs text-zinc-500">{role.screened} screened</p>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${role.avgScore >= 70 ? "bg-brand-500" : role.avgScore >= 45 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${Math.min(100, Math.max(4, role.avgScore))}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums text-zinc-800">
                      {role.avgScore}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
