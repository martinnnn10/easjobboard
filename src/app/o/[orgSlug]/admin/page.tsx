import Link from "next/link";
import { notFound } from "next/navigation";
import { countApplicationsByOrganization, getCallQueueCount } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { getBillingState } from "@/lib/billing";
import { careAlertsForOwner, careTaskQueue, sweepEscalations } from "@/lib/candidate-care";
import { canSeeJob, getJobAccess } from "@/lib/job-visibility";
import { listJobsByOrganization } from "@/lib/jobs";
import { getOrganizationBySlug, getOrgLabels } from "@/lib/organizations";
import { canManageTeam, canWrite } from "@/lib/roles";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ published?: string }>;
};

/** Action-first tile: a label, a live count, a one-line hint, one real link. */
function ActionCard({
  href,
  label,
  value,
  hint,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Link href={href} className={`card card-hover ${accent && value > 0 ? "border-l-4 border-l-brand-500" : ""}`}>
      <p className="section-label">{label}</p>
      <p className={`stat-value mt-2 ${accent && value > 0 ? "text-brand-700" : "text-zinc-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </Link>
  );
}

export default async function OrgAdminPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const sessionContext = await requireOrgSession(orgSlug);
  const writable = canWrite(sessionContext.user.role);
  const isOwner = canManageTeam(sessionContext.user.role);
  const labels = getOrgLabels(organization);

  // Owners drive the Candidate Care SLA — sweep lapsed follow-ups on load.
  if (isOwner) await sweepEscalations(organization.id);

  // Scope every count to the jobs this user may see (owners → unrestricted).
  const access = getJobAccess(organization.id, sessionContext.user);
  const jobs = listJobsByOrganization(organization.id).filter((job) => canSeeJob(access, job.id));
  const publishedJobs = jobs.filter((job) => job.status === "published");

  // The five action counts that drive the command center.
  const applicantsToReview = countApplicationsByOrganization(organization.id, undefined, access);
  const resumeOnlyCount = countApplicationsByOrganization(organization.id, undefined, access, true);
  const callQueueCount = getCallQueueCount(organization.id, access);
  const careAlerts = isOwner ? careAlertsForOwner(organization.id) : null;
  const careDueCount = careAlerts
    ? careAlerts.overdue.length + careAlerts.escalated.length
    : careTaskQueue(organization.id, sessionContext.user.id).filter((t) => t.overdue).length;

  const publishedSlug = (await searchParams).published;
  const publishedJob = publishedSlug ? jobs.find((job) => job.slug === publishedSlug) : undefined;

  const billing = getBillingState(organization);
  const showTrialBanner =
    billing.status === "trialing" && billing.trialDaysLeft !== null && !billing.hasSubscription;
  const noJobs = jobs.length === 0;

  return (
    <div className="page-shell space-y-6">
      {showTrialBanner ? (
        <section
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            billing.trialDaysLeft !== null && billing.trialDaysLeft <= 3
              ? "border-amber-200 bg-amber-50"
              : "border-brand-200 bg-brand-50"
          }`}
        >
          <p className="text-sm text-zinc-700">
            {billing.trialDaysLeft !== null && billing.trialDaysLeft > 0 ? (
              <>
                <span className="font-semibold">Free trial — {billing.trialDaysLeft} day
                  {billing.trialDaysLeft === 1 ? "" : "s"} left.</span> Full access to EAS Recruit.
              </>
            ) : (
              <span className="font-semibold">Your free trial has ended.</span>
            )}
          </p>
          <div className="flex gap-2">
            {noJobs ? (
              <Link href={`/o/${orgSlug}/admin/onboarding`} className="btn-secondary text-sm">
                Finish setup
              </Link>
            ) : null}
            {writable ? (
              <Link href={`/o/${orgSlug}/admin/settings`} className="btn-primary text-sm">
                {billing.trialDaysLeft !== null && billing.trialDaysLeft <= 0 ? "Add payment method" : "View plan"}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Publish success — shown right after a job is published. Honest about
          Google: eligible once crawled, never "posted"/"live on Google". */}
      {publishedJob ? (
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-base font-semibold text-brand-800">Job published</h2>
          <p className="mt-1 text-sm text-brand-800/80">
            <span className="font-medium">{publishedJob.title}</span> — candidates can now apply using the public link.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <a
              href={`/o/${orgSlug}/jobs/${publishedJob.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 underline"
            >
              Open public posting (where candidates apply)
            </a>
            <a
              href={`/o/${orgSlug}/jobs/${publishedJob.slug}/flyer`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 underline"
            >
              Print a flyer
            </a>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-brand-900/80 sm:grid-cols-2">
            <p>
              <span className="font-semibold">Sitemap:</span> Included
            </p>
            <p>
              <span className="font-semibold">Google Jobs:</span> Eligible once Google crawls it — placement isn&apos;t
              guaranteed.
            </p>
          </div>
          <p className="mt-2 text-xs text-brand-800/70">
            Tip: submit your sitemap in Google Search Console to speed up crawling.{" "}
            <Link href={`/o/${orgSlug}/admin/syndication`} className="underline">
              Job distribution
            </Link>
          </p>
        </section>
      ) : null}

      {/* Command center header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Who needs attention?</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Your action list — {applicantsToReview} {applicantsToReview === 1 ? labels.applicantSingular : labels.applicantSingular + "s"} in,
            ranked by demonstrated ability. Deeper numbers live in Reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {writable ? (
            <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary">
              + New {labels.jobSingular}
            </Link>
          ) : null}
          <a href={`/o/${orgSlug}`} target="_blank" rel="noreferrer" className="btn-secondary">
            View careers page
          </a>
        </div>
      </div>

      {noJobs ? (
        <section className="card space-y-3 py-8 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">Post your first {labels.jobSingular} in under a minute</h3>
          <p className="mx-auto max-w-md text-sm text-zinc-600">
            Pick a role template and a skills screen, publish, and start seeing who can actually do the work. It goes
            live on your careers page immediately, with structured data that makes it eligible for Google for Jobs once
            Google crawls the page.
          </p>
          {writable ? (
            <div>
              <Link href={`/o/${orgSlug}/admin/jobs/new`} className="btn-primary inline-block">
                Post your first {labels.jobSingular} →
              </Link>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href={`/o/${orgSlug}/admin/applicants`}
            label={`${labels.applicants} to review`}
            value={applicantsToReview}
            hint="Ranked by demonstrated ability →"
            accent
          />
          <ActionCard
            href={`/o/${orgSlug}/admin/queue`}
            label="Call first"
            value={callQueueCount}
            hint="Ranked by ability — phone one tap away →"
            accent
          />
          <ActionCard
            href={`/o/${orgSlug}/admin/applicants?screen=resume_only`}
            label={`Resume-only ${labels.applicantSingular}s`}
            value={resumeOnlyCount}
            hint="Applied without a skills screen — send one →"
          />
          <ActionCard
            href={`/o/${orgSlug}/admin/care`}
            label="Candidate Care due"
            value={careDueCount}
            hint="Follow-ups overdue or escalated →"
            accent
          />
          <ActionCard
            href={`/o/${orgSlug}/admin/jobs`}
            label={`Open ${labels.jobsLower}`}
            value={publishedJobs.length}
            hint="Live on your careers page →"
          />
        </section>
      )}
    </div>
  );
}
