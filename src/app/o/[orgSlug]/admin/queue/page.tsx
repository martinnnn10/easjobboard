import Link from "next/link";
import { notFound } from "next/navigation";
import { CallLogPanel } from "@/components/CallLogPanel";
import { DemoBadge } from "@/components/DemoBadge";
import { RiskPill, ScreenScoreBadge, ScreenSignalBadges } from "@/components/ScreenSignals";
import { listApplicationsByOrganization, REVIEW_FLOOR, type ApplicationWithJob } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { deriveRecommendedAction, normalizeRiskLevel } from "@/lib/candidate-intel";
import { getCandidateContactStates, type CandidateContactState } from "@/lib/candidates";
import { getJobAccess } from "@/lib/job-visibility";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

function relativeDays(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

type QueueItem = {
  a: ApplicationWithJob;
  state: CandidateContactState;
  contacted: boolean;
  followDue: boolean;
  priority: number;
};

function QueueCard({
  item,
  index,
  orgSlug,
  writable,
  resumeOnly,
}: {
  item: QueueItem;
  index: number;
  orgSlug: string;
  writable: boolean;
  resumeOnly: boolean;
}) {
  const { a, state, contacted, followDue } = item;
  const risk = normalizeRiskLevel(a.risk_level);
  const action = resumeOnly
    ? "Needs phone screen — no skills screen completed."
    : a.screen_summary?.recommendedAction ?? deriveRecommendedAction(a.screen_score, a.screen_status, risk);
  const topSignal = resumeOnly ? null : a.screen_summary?.strengths?.[0] ?? null;
  const topRisk = a.risk_flags?.[0]?.label ?? null;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <span className="hidden w-5 pt-1 text-lg font-bold text-zinc-300 sm:block">{index + 1}</span>
        <div className="flex-none pt-0.5">
          <ScreenScoreBadge score={a.screen_score} status={a.screen_status} size="lg" />
        </div>

        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/o/${orgSlug}/admin/candidates/${a.candidate_id}`}
              className="font-semibold text-zinc-900 hover:text-brand-700"
            >
              {a.applicant_name}
            </Link>
            {a.is_demo ? <DemoBadge /> : null}
            <ScreenSignalBadges status={a.screen_status} score={a.screen_score} />
            {risk !== "low" ? <RiskPill level={risk} /> : null}
            {followDue ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Follow-up due
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            {a.job_title}
            {a.applicant_location ? ` · ${a.applicant_location}` : ""}
            {" · applied "}
            {relativeDays(a.created_at)}
          </p>
          <p className="text-sm font-medium text-zinc-800">{action}</p>
          {!resumeOnly ? (
            <p className="text-xs text-brand-700">Skills screen completed — practical signal available.</p>
          ) : null}
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
          <p className="text-xs text-zinc-400">
            {a.applicant_phone ? `${a.applicant_phone} · ` : ""}
            {a.applicant_email}
            {contacted ? ` · last contacted ${relativeDays(state.last_contacted_at)}` : ""}
            {state.follow_up_at ? ` · follow-up ${state.follow_up_at}` : ""}
          </p>
        </div>

        <div className="flex-none">
          {writable ? (
            <CallLogPanel
              orgSlug={orgSlug}
              candidateId={a.candidate_id}
              applicationId={a.id}
              phone={a.applicant_phone}
              email={a.applicant_email}
              currentStatus={a.status}
            />
          ) : (
            <div className="flex gap-2">
              {a.applicant_phone ? (
                <a href={`tel:${a.applicant_phone.replace(/[^0-9+]/g, "")}`} className="btn-secondary text-sm">
                  Call
                </a>
              ) : null}
              <a href={`mailto:${a.applicant_email}`} className="btn-secondary text-sm">
                Email
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function CallQueuePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);

  const all = listApplicationsByOrganization(organization.id, {
    orderBy: "score",
    access: getJobAccess(organization.id, user),
  });
  const active = all.filter((a) => a.status === "new" || a.status === "screening");

  // Screened: a completed screen that cleared the review floor — the practical
  // signal is in, so rank these first (best score up top).
  const screened = active.filter(
    (a) => a.screen_status === "completed" && a.screen_score !== null && a.screen_score >= REVIEW_FLOOR,
  );
  // Resume-only: applied with a resume but no completed screen yet — still worth
  // a call, just lower confidence, so they rank below the screened candidates.
  const resumeOnly = active.filter((a) => a.screen_status !== "completed" && Boolean(a.resume_filename));

  const contact = getCandidateContactStates(
    organization.id,
    [...screened, ...resumeOnly].map((a) => a.candidate_id),
  );
  const today = new Date().toISOString().slice(0, 10);

  function decorate(a: ApplicationWithJob): QueueItem {
    const state = contact[a.candidate_id] ?? { last_contacted_at: "", follow_up_at: "" };
    const contacted = Boolean(state.last_contacted_at);
    const followDue = Boolean(state.follow_up_at && state.follow_up_at <= today);
    const priority = !contacted ? 0 : followDue ? 1 : 2;
    return { a, state, contacted, followDue, priority };
  }

  // Screened: never-contacted first, then due follow-ups, each keeping score order.
  const screenedQueue = screened.map(decorate).sort((x, y) => x.priority - y.priority);
  // Resume-only: most recent applicants first (no score to rank on).
  const resumeOnlyQueue = resumeOnly
    .map(decorate)
    .sort((x, y) => y.a.created_at.localeCompare(x.a.created_at));

  const total = screenedQueue.length + resumeOnlyQueue.length;

  return (
    <div className="page-shell space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Call queue</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Screened candidates first, best practical score up top; resume-only applicants follow. Log the outcome to
          track follow-ups and clear the queue.
        </p>
      </div>

      {total === 0 ? (
        <div className="card space-y-1 py-8 text-center">
          <p className="font-medium text-zinc-800">No candidates to call yet.</p>
          <p className="text-sm text-zinc-600">
            As applicants come in and complete skills screens, EAS Recruit will rank who is worth calling first.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {screenedQueue.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Screened — practical signal available ({screenedQueue.length})
              </h2>
              {screenedQueue.map((item, index) => (
                <QueueCard
                  key={item.a.id}
                  item={item}
                  index={index}
                  orgSlug={orgSlug}
                  writable={writable}
                  resumeOnly={false}
                />
              ))}
            </section>
          ) : null}

          {resumeOnlyQueue.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Resume only — needs a phone screen ({resumeOnlyQueue.length})
              </h2>
              <p className="-mt-1 text-xs text-zinc-500">
                These applicants haven&apos;t completed a skills screen. Send them one to rank by demonstrated ability,
                or verify on the phone screen.
              </p>
              {resumeOnlyQueue.map((item, index) => (
                <QueueCard
                  key={item.a.id}
                  item={item}
                  index={screenedQueue.length + index}
                  orgSlug={orgSlug}
                  writable={writable}
                  resumeOnly
                />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
