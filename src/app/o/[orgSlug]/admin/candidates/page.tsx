import Link from "next/link";
import { notFound } from "next/navigation";
import { ScreenScoreBadge } from "@/components/ScreenSignals";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { getPoolSkills, listCandidates, type CandidateView } from "@/lib/candidates";
import {
  CANDIDATE_CRM_STATUS_LABELS,
  CANDIDATE_CRM_STATUSES,
  CANDIDATE_SOURCE_LABELS,
  CANDIDATE_SOURCES,
  isCandidateCrmStatus,
  isCandidateSource,
} from "@/lib/candidate-meta";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string; skill?: string; stage?: string; source?: string; cstatus?: string; view?: string }>;
};

const TABS: { key: CandidateView; label: string }[] = [
  { key: "all", label: "All candidates" },
  { key: "applicants", label: "Applicants" },
  { key: "sourced", label: "Sourced" },
  { key: "needs_follow_up", label: "Needs follow-up" },
  { key: "high_risk", label: "High risk" },
];

const TAB_HELP: Record<CandidateView, string> = {
  all: "Everyone in your pool — applicants and sourced/passive candidates, deduplicated across jobs.",
  applicants: "People who applied to one of your roles.",
  sourced: "Passive and sourced prospects you added or imported — they haven't applied yet.",
  needs_follow_up: "Candidates with a follow-up date that's now due.",
  high_risk: "Candidates flagged high-risk on a screen — pay, commute, or job-hop concerns to verify.",
};

function isStage(value: string | undefined): value is ApplicationStatus {
  return !!value && (APPLICATION_STATUSES as string[]).includes(value);
}

function isView(value: string | undefined): value is CandidateView {
  return !!value && TABS.some((t) => t.key === value);
}

export default async function CandidatesPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);

  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const skill = sp.skill?.trim() || undefined;
  const stage = isStage(sp.stage) ? sp.stage : undefined;
  const source = isCandidateSource(sp.source) ? sp.source : undefined;
  const crmStatus = isCandidateCrmStatus(sp.cstatus) ? sp.cstatus : undefined;
  const view: CandidateView = isView(sp.view) ? sp.view : "all";

  const candidates = listCandidates(organization.id, { query, skill, stage, source, crmStatus, view });
  const poolSkills = getPoolSkills(organization.id);
  const hasFilters = Boolean(query || skill || stage || source || crmStatus);

  // Preserve the active tab when the filter form submits.
  const tabQuery = (v: CandidateView) => (v === "all" ? "" : `?view=${v}`);

  return (
    <div className="page-shell space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Candidates</h1>
            <p className="mt-1 text-sm text-zinc-600">
              One home for everyone you&apos;re recruiting — applicants and sourced/passive candidates, deduplicated
              across jobs. Use the tabs to narrow the pool.
            </p>
          </div>
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/candidates/new`} className="btn-primary shrink-0">
              + Add candidate
            </Link>
          ) : null}
        </div>
      </div>

      {/* Tabs — Applicants / Sourced / Needs follow-up / High risk are views of
          this one pool, not separate pages, so nobody has to guess where a
          person lives. */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = view === t.key;
            return (
              <Link
                key={t.key}
                href={`/o/${orgSlug}/admin/candidates${tabQuery(t.key)}`}
                aria-current={active ? "page" : undefined}
                className={`border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <p className="-mt-2 text-sm text-zinc-500">{TAB_HELP[view]}</p>

      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        <input type="hidden" name="view" value={view} />
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
        <label className="block space-y-1">
          <span className="text-sm font-medium">Source</span>
          <select name="source" defaultValue={source ?? ""} className="field-input">
            <option value="">Any source</option>
            {CANDIDATE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Outreach status</span>
          <select name="cstatus" defaultValue={crmStatus ?? ""} className="field-input">
            <option value="">Any status</option>
            {CANDIDATE_CRM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CANDIDATE_CRM_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-4">
          <button type="submit" className="btn-primary">
            Search
          </button>
          {hasFilters ? (
            <Link href={`/o/${orgSlug}/admin/candidates${tabQuery(view)}`} className="btn-secondary">
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
            <div key={candidate.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/o/${orgSlug}/admin/candidates/${candidate.id}`}
                    className="font-semibold text-zinc-900 hover:text-brand-700 hover:underline"
                  >
                    {candidate.name || candidate.email}
                  </Link>
                  <p className="text-sm text-zinc-500">
                    {candidate.email}
                    {candidate.phone ? ` · ${candidate.phone}` : ""}
                  </p>
                  {candidate.title || candidate.company ? (
                    <p className="text-xs text-zinc-500">
                      {[candidate.title, candidate.company].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {candidate.source !== "applied" ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {isCandidateSource(candidate.source) ? CANDIDATE_SOURCE_LABELS[candidate.source] : candidate.source}
                        {candidate.source_provider ? ` · ${candidate.source_provider}` : ""}
                      </span>
                    ) : null}
                    {isCandidateCrmStatus(candidate.crm_status) ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {CANDIDATE_CRM_STATUS_LABELS[candidate.crm_status]}
                      </span>
                    ) : null}
                    {candidate.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
                        {tag}
                      </span>
                    ))}
                    {candidate.ownerName ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                        Owner: {candidate.ownerName}
                      </span>
                    ) : null}
                  </div>
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

              {candidate.applications.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500">
                  No applications yet — sourced candidate. Open the profile to log outreach or attach them to a job.
                </p>
              ) : (
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
                            className="text-zinc-900 hover:text-brand-700 hover:underline"
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
                            className="text-brand-700 hover:underline"
                          >
                            {app.resumeFilename}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
