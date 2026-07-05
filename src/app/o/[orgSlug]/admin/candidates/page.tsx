import Link from "next/link";
import { notFound } from "next/navigation";
import { ScreenScoreBadge } from "@/components/ScreenSignals";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { getPoolSkills, searchCandidates } from "@/lib/candidates";
import { getOrganizationBySlug } from "@/lib/organizations";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string; skill?: string; stage?: string }>;
};

function isStage(value: string | undefined): value is ApplicationStatus {
  return !!value && (APPLICATION_STATUSES as string[]).includes(value);
}

export default async function CandidatesPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const skill = sp.skill?.trim() || undefined;
  const stage = isStage(sp.stage) ? sp.stage : undefined;

  const candidates = searchCandidates(organization.id, { query, skill, stage });
  const poolSkills = getPoolSkills(organization.id);

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Candidate pool</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Everyone who has applied, deduplicated across jobs. Search by name, email, or resume text and filter by skill
          or stage.
        </p>
      </div>

      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        <label className="sm:col-span-2 block space-y-1">
          <span className="text-sm font-medium">Search</span>
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Name, email, or resume keyword"
            className="field-input"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Skill</span>
          <select name="skill" defaultValue={skill ?? ""} className="field-input">
            <option value="">Any skill</option>
            {poolSkills.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Stage</span>
          <select name="stage" defaultValue={stage ?? ""} className="field-input">
            <option value="">Any stage</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-4">
          <button type="submit" className="btn-primary">
            Search
          </button>
          {query || skill || stage ? (
            <Link href={`/o/${orgSlug}/admin/candidates`} className="btn-secondary">
              Clear
            </Link>
          ) : null}
          <span className="ml-auto self-center text-sm text-zinc-500">
            {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
          </span>
        </div>
      </form>

      {candidates.length === 0 ? (
        <div className="card text-zinc-600">No candidates match your filters.</div>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.email} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{candidate.name}</p>
                  <p className="text-sm text-zinc-500">
                    {candidate.email}
                    {candidate.phone ? ` · ${candidate.phone}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <ScreenScoreBadge
                    score={candidate.bestScreenScore}
                    status={candidate.bestScreenScore === null ? "none" : "completed"}
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {candidate.bestScore === null ? "" : `Resume kw: ${candidate.bestScore}%`}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Applied to</th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                      <th className="px-3 py-2 font-medium">Skills screen</th>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Resume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidate.applications.map((app) => (
                      <tr key={app.applicationId} className="border-b border-zinc-100 last:border-0">
                        <td className="px-3 py-2">
                          <Link
                            href={`/o/${orgSlug}/admin/applications/${app.applicationId}`}
                            className="text-zinc-900 hover:text-blue-700 hover:underline"
                          >
                            {app.jobTitle}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{APPLICATION_STATUS_LABELS[app.status]}</td>
                        <td className="px-3 py-2">
                          <ScreenScoreBadge score={app.screenScore} status={app.screenStatus} />
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{new Date(app.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <a
                            href={`/api/o/${orgSlug}/applications/${app.applicationId}/resume`}
                            className="text-blue-600 hover:underline"
                          >
                            {app.resumeFilename}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
