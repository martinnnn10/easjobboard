import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { BadgeRow, RiskPill, ScreenScoreBadge } from "@/components/ScreenSignals";
import { countApplicationsByOrganization, listApplicationsByOrganization } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { badgesForApplication, deriveRecommendedAction, normalizeRiskLevel } from "@/lib/candidate-intel";
import { getJobAccess } from "@/lib/job-visibility";
import { getOrganizationBySlug, getOrgLabels } from "@/lib/organizations";
import { canViewResumes, canWrite } from "@/lib/roles";

function appliedAgo(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

const PAGE_SIZE = 25;

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ page?: string; screen?: string }>;
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
  const filter =
    sp.screen === "qualified" || sp.screen === "knockout" || sp.screen === "resume_only" ? sp.screen : undefined;
  const resumeOnly = filter === "resume_only";
  const screenOutcome = resumeOnly ? undefined : filter;

  // Per-job visibility: restrict counts + rows to jobs this user may see.
  const access = getJobAccess(organization.id, user);

  const allCount = countApplicationsByOrganization(organization.id, undefined, access);
  const qualifiedCount = countApplicationsByOrganization(organization.id, "qualified", access);
  const knockoutCount = countApplicationsByOrganization(organization.id, "knockout", access);
  const resumeOnlyCount = countApplicationsByOrganization(organization.id, undefined, access, true);

  const total = resumeOnly
    ? resumeOnlyCount
    : filter
      ? countApplicationsByOrganization(organization.id, filter, access)
      : allCount;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(1, requestedPage), pageCount) : 1;

  const applicants = listApplicationsByOrganization(organization.id, {
    orderBy: "score",
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    screenOutcome,
    resumeOnly,
    access,
  });

  const tabs = [
    { key: undefined as string | undefined, label: "All", count: allCount },
    { key: "qualified", label: "Qualified", count: qualifiedCount },
    { key: "resume_only", label: "Resume only", count: resumeOnlyCount },
    { key: "knockout", label: "Auto-screened out", count: knockoutCount },
  ];
  const tabHref = (key: string | undefined) =>
    `/o/${orgSlug}/admin/applicants${key ? `?screen=${key}` : ""}`;

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + applicants.length;

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">{labels.applicants}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ranked by practical skills-screen score — who can actually do the work — not resume keywords. Resumes are
          also emailed to {organization.application_email} when candidates apply.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {tab.label} <span className={active ? "text-zinc-300" : "text-zinc-400"}>{tab.count}</span>
            </Link>
          );
        })}
      </div>

      {applicants.length === 0 ? (
        <div className="card space-y-1 py-10 text-center">
          <p className="font-medium text-zinc-800">
            {filter === "knockout"
              ? `No auto-screened-out ${labels.applicantSingular}s`
              : filter === "qualified"
                ? `No qualified ${labels.applicantSingular}s yet`
                : filter === "resume_only"
                  ? `No resume-only ${labels.applicantSingular}s`
                  : "No applications yet"}
          </p>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            {filter === "knockout"
              ? "Nobody has been screened out by a job's must-pass rules."
              : filter === "qualified"
                ? "Candidates who clear a skills screen's must-pass rules land here, ranked by practical score."
                : filter === "resume_only"
                  ? "Everyone who has applied has completed a skills screen — applicants without one show up here."
                  : "Share a job link or import candidates, and applicants will appear here ranked by practical skills score — who can actually do the work."}
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
                      {application.job_title}
                      {application.applicant_location ? ` · ${application.applicant_location}` : ""}
                      {application.desired_pay ? ` · wants ${application.desired_pay}` : ""}
                      {" · applied "}
                      {appliedAgo(application.created_at)}
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
                    <p className="text-xs text-zinc-400">{application.applicant_email}</p>
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
                      <a
                        href={`/api/o/${orgSlug}/applications/${application.id}/resume`}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Resume ↓
                      </a>
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
              <Link
                href={`/o/${orgSlug}/admin/applicants?${filter ? `screen=${filter}&` : ""}page=${page - 1}`}
                className="btn-secondary px-3 py-1.5"
              >
                ← Previous
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-3 py-1.5 opacity-50">← Previous</span>
            )}
            {page < pageCount ? (
              <Link
                href={`/o/${orgSlug}/admin/applicants?${filter ? `screen=${filter}&` : ""}page=${page + 1}`}
                className="btn-secondary px-3 py-1.5"
              >
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
