import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { JobFilterSelect } from "@/components/JobFilterSelect";
import { BadgeRow, RiskPill, ScreenScoreBadge } from "@/components/ScreenSignals";
import { StatusBadge } from "@/components/StatusBadge";
import {
  countApplications,
  listApplicationsByOrganization,
  type ApplicationCategory,
} from "@/lib/applications";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { badgesForApplication, deriveRecommendedAction, normalizeRiskLevel } from "@/lib/candidate-intel";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { getJobById, listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug, getOrgLabels } from "@/lib/organizations";
import { canViewResumes, canWrite } from "@/lib/roles";

function appliedAgo(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

const PAGE_SIZE = 25;

/** The category views a recruiter can drill into — labels + the exact filter each maps to. */
type ViewDef = { slug: string; label: string; category?: ApplicationCategory; screenOutcome?: string };
const VIEWS: ViewDef[] = [
  { slug: "all", label: "All" },
  { slug: "strong-fit", label: "Strong fit", category: "strong-fit" },
  { slug: "screened", label: "Screened", category: "screened" },
  { slug: "review", label: "Review", category: "review" },
  { slug: "high-risk", label: "High risk", category: "high-risk" },
  { slug: "calls-due", label: "Calls due", category: "calls-due" },
  { slug: "resume-only", label: "Resume only", category: "resume-only" },
  { slug: "knockout", label: "Auto-screened out", screenOutcome: "knockout" },
];

/** Resolve the active view slug, accepting the legacy `screen` param for old links. */
function resolveViewSlug(view?: string, legacyScreen?: string): string {
  const candidate =
    view ??
    (legacyScreen === "resume_only"
      ? "resume-only"
      : legacyScreen === "knockout"
        ? "knockout"
        : legacyScreen === "qualified"
          ? "strong-fit"
          : undefined);
  return VIEWS.some((v) => v.slug === candidate) ? (candidate as string) : "all";
}

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string; view?: string; job?: string; screen?: string }>;
};

export default async function OrgApplicantsPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const resumesOk = canViewResumes(user.role);
  const labels = getOrgLabels(organization);

  const sp = await searchParams;
  const access = getJobAccess(organization.id, user);

  // Resolve an optional job scope. A missing/foreign/hidden job silently falls
  // back to the org-wide list — org isolation and per-job visibility preserved.
  const requestedJobId = typeof sp.job === "string" && sp.job ? sp.job : undefined;
  let job = requestedJobId ? getJobById(requestedJobId) : null;
  if (job && (job.organization_id !== organization.id || !canSeeJob(access, job.id))) job = null;
  const jobId = job ? job.id : undefined;

  const activeSlug = resolveViewSlug(sp.view, sp.screen);
  const activeView = VIEWS.find((v) => v.slug === activeSlug) ?? VIEWS[0];

  // One count per view — the same query family the list uses, so a tab's number
  // always equals the rows it opens (and the Jobs-page counts it came from).
  const counts: Record<string, number> = {};
  for (const v of VIEWS) {
    counts[v.slug] = countApplications({
      organizationId: organization.id,
      jobId,
      category: v.category,
      screenOutcome: v.screenOutcome,
      access,
    });
  }

  const total = counts[activeSlug] ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), pageCount) : 1;

  const applicants = listApplicationsByOrganization(organization.id, {
    orderBy: "score",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    jobId,
    category: activeView.category,
    screenOutcome: activeView.screenOutcome,
    access,
  });

  // Jobs a recruiter may see, for the Job filter dropdown.
  const jobOptions = listJobsByOrganization(organization.id)
    .filter((j) => canSeeJob(access, j.id))
    .map((j) => ({ id: j.id, title: j.title, status: j.status }));

  const href = (slug: string, pageNum?: number) => {
    const p = new URLSearchParams();
    if (jobId) p.set("job", jobId);
    if (slug !== "all") p.set("view", slug);
    if (pageNum && pageNum > 1) p.set("page", String(pageNum));
    const qs = p.toString();
    return `/o/${orgSlug}/admin/applicants${qs ? `?${qs}` : ""}`;
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + applicants.length;

  return (
    <div className="page-shell space-y-6">
      {/* Header — job-scoped context, or the general pool */}
      <div className="space-y-2">
        {job ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href={`/o/${orgSlug}/admin/jobs`} className="font-medium text-brand-700 hover:underline">
                ← Back to jobs
              </Link>
              <Link href={`/o/${orgSlug}/admin/jobs/${job.id}`} className="text-zinc-500 hover:text-zinc-800">
                Job command center →
              </Link>
              <Link href={`/o/${orgSlug}/admin/applicants`} className="text-zinc-500 hover:text-zinc-800">
                Clear job filter ✕
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-zinc-900">
                {labels.applicantSingular === "candidate" ? "Applicants" : labels.applicants} for {job.title}
              </h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-sm text-zinc-600">
              {job.location ? `${job.location} · ` : ""}
              {counts.all} total · everyone who applied or was attached to this job, ranked by practical skills score.
            </p>
          </>
        ) : (
          <>
            <Link href={`/o/${orgSlug}/admin`} className="text-sm font-medium text-brand-700 hover:underline">
              ← Back to admin
            </Link>
            <h1 className="text-3xl font-bold text-zinc-900">{labels.applicants}</h1>
            <p className="text-sm text-zinc-600">
              Everyone who applied or was attached to a job, ranked by practical skills score — not resume keywords.
              Filter by job to work one req at a time. The <Link href={`/o/${orgSlug}/admin/queue`} className="text-brand-700 hover:underline">Call Queue</Link> is the prioritized subset worth calling first.
            </p>
          </>
        )}
        <div className="pt-1">
          <JobFilterSelect orgSlug={orgSlug} jobs={jobOptions} currentJobId={jobId} view={activeSlug} />
        </div>
      </div>

      {/* Category views double as the job's intelligence summary */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const active = v.slug === activeSlug;
          if (v.slug !== "all" && counts[v.slug] === 0 && !active) {
            return (
              <span
                key={v.slug}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-300"
              >
                {v.label} <span className="tabular-nums">0</span>
              </span>
            );
          }
          return (
            <Link
              key={v.slug}
              href={href(v.slug)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {v.label} <span className={`tabular-nums ${active ? "text-zinc-300" : "text-zinc-400"}`}>{counts[v.slug]}</span>
            </Link>
          );
        })}
      </div>

      {applicants.length === 0 ? (
        <div className="card space-y-1 py-10 text-center">
          <p className="font-medium text-zinc-800">
            {activeSlug === "all"
              ? job
                ? "No applicants on this job yet"
                : "No applications yet"
              : `No ${activeView.label.toLowerCase()} ${labels.applicantSingular}s${job ? " on this job" : ""}`}
          </p>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            {activeSlug === "all"
              ? job
                ? "Share this job's apply link or attach candidates, and applicants will appear here ranked by practical skills score."
                : "Share a job link or import candidates, and applicants will appear here ranked by practical skills score — who can actually do the work."
              : activeSlug === "resume-only"
                ? "Everyone here has completed a skills screen — applicants without one show up in this view."
                : activeSlug === "knockout"
                  ? "Nobody has been screened out by a must-pass rule."
                  : "No candidates match this category yet. Try another view or send skills screens to rank more people."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applicants.map((application) => {
            const risk = normalizeRiskLevel(application.risk_level);
            const action =
              application.screen_summary?.recommendedAction ??
              deriveRecommendedAction(application.screen_score, application.screen_status, risk);
            const topSignal = application.screen_summary?.strengths?.[0] ?? null;
            const topRisk = application.risk_flags?.[0]?.label ?? null;
            const externalSource =
              application.source && application.source !== "applied" ? application.source : null;
            return (
              <div key={application.id} className="card space-y-3">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-none pt-0.5">
                    <ScreenScoreBadge
                      score={application.screen_score}
                      status={application.screen_status}
                      size="lg"
                    />
                  </div>

                  <div className="min-w-[15rem] flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/o/${orgSlug}/admin/applications/${application.id}`}
                        className="font-semibold text-zinc-900 hover:text-brand-700"
                      >
                        {application.applicant_name}
                      </Link>
                      {application.screen_outcome === "knockout" ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          Auto-screened out
                        </span>
                      ) : application.screen_outcome === "qualified" ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                          Qualified
                        </span>
                      ) : null}
                      {risk !== "low" ? <RiskPill level={risk} /> : null}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {/* Only show the job name in the org-wide view; it's redundant when scoped. */}
                      {!job ? `${application.job_title} · ` : ""}
                      {application.applicant_location ? `${application.applicant_location} · ` : ""}
                      {application.desired_pay ? `wants ${application.desired_pay} · ` : ""}
                      applied {appliedAgo(application.created_at)}
                      {externalSource ? ` · via ${externalSource}` : ""}
                    </p>
                    <p className="text-sm font-medium text-zinc-800">{action}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {topSignal ? (
                        <span className="text-brand-700">
                          <span className="font-semibold">Signal:</span> {topSignal}
                        </span>
                      ) : null}
                      {topRisk ? (
                        <span className="text-red-600">
                          <span className="font-semibold">Risk:</span> {topRisk}
                        </span>
                      ) : null}
                    </div>
                    <BadgeRow badges={badgesForApplication(application)} max={4} />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                      <span>{application.applicant_email}</span>
                      <Link
                        href={`/o/${orgSlug}/admin/candidates/${application.candidate_id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        Open candidate →
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-none flex-col items-start gap-2 sm:items-end">
                    {writable ? (
                      <ApplicationStatusSelect
                        orgSlug={orgSlug}
                        applicationId={application.id}
                        initialStatus={application.status}
                      />
                    ) : (
                      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                        {APPLICATION_STATUS_LABELS[application.status] ?? application.status}
                      </span>
                    )}
                    {resumesOk ? (
                      application.resume_filename ? (
                        <a
                          href={`/api/o/${orgSlug}/applications/${application.id}/resume`}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Resume ↓
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">No resume</span>
                      )
                    ) : (
                      <span className="text-xs text-zinc-400">Resume restricted</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            Showing {rangeStart}–{rangeEnd} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href(activeSlug, page - 1)} className="btn-secondary px-3 py-1.5">
                ← Previous
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-50">← Previous</span>
            )}
            {page < pageCount ? (
              <Link href={href(activeSlug, page + 1)} className="btn-secondary px-3 py-1.5">
                Next →
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-50">Next →</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
