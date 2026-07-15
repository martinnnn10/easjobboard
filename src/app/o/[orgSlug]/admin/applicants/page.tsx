import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { BadgeRow, ScreenScoreBadge } from "@/components/ScreenSignals";
import {
  countApplicationsByOrganization,
  listApplicationsByOrganization,
} from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { badgesForApplication } from "@/lib/candidate-intel";
import { getJobAccess } from "@/lib/job-visibility";
import { getOrganizationBySlug, getOrgLabels } from "@/lib/organizations";
import { canViewResumes, canWrite } from "@/lib/roles";

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
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
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
        <div className="card text-zinc-600">
          {filter === "knockout"
            ? `No auto-screened-out ${labels.applicantSingular}s.`
            : filter === "qualified"
              ? `No qualified ${labels.applicantSingular}s yet.`
              : filter === "resume_only"
                ? `No resume-only ${labels.applicantSingular}s — everyone has completed a skills screen.`
                : "No applications yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Skills screen</th>
                <th className="px-4 py-3 font-medium">Signals</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">Resume</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((application) => (
                <tr key={application.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/o/${orgSlug}/admin/applications/${application.id}`}
                      className="font-medium text-zinc-900 hover:text-blue-700"
                    >
                      {application.applicant_name}
                    </Link>
                    <div className="text-zinc-500">{application.applicant_email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{application.job_title}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ScreenScoreBadge score={application.screen_score} status={application.screen_status} />
                      {application.screen_outcome === "knockout" ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          Knockout
                        </span>
                      ) : application.screen_outcome === "qualified" ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                          Qualified
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      {application.match_score === null ? "" : `Resume kw: ${application.match_score}%`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <BadgeRow badges={badgesForApplication(application)} max={3} />
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{new Date(application.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {resumesOk ? (
                      <a href={`/api/o/${orgSlug}/applications/${application.id}/resume`} className="text-blue-600 hover:underline">
                        {application.resume_filename}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-400">Restricted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
