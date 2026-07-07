import Link from "next/link";
import { notFound } from "next/navigation";
import { CallLogPanel } from "@/components/CallLogPanel";
import { RiskPill, ScreenScoreBadge } from "@/components/ScreenSignals";
import { listApplicationsByOrganization, REVIEW_FLOOR } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { deriveRecommendedAction, normalizeRiskLevel } from "@/lib/candidate-intel";
import { getCandidateContactStates } from "@/lib/candidates";
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

export default async function CallQueuePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);

  // Everyone worth a call: a completed screen that cleared the review floor,
  // still in new/screening, ranked by practical score.
  const all = listApplicationsByOrganization(organization.id, { orderBy: "score" });
  const base = all.filter(
    (a) =>
      a.screen_status === "completed" &&
      a.screen_score !== null &&
      a.screen_score >= REVIEW_FLOOR &&
      (a.status === "new" || a.status === "screening"),
  );

  const contact = getCandidateContactStates(organization.id, base.map((a) => a.candidate_id));
  const today = new Date().toISOString().slice(0, 10);

  // Priority: never-contacted first, then follow-ups that are due, then the
  // rest (already contacted, not yet due) — each group keeps score order.
  const queue = base
    .map((a) => {
      const state = contact[a.candidate_id] ?? { last_contacted_at: "", follow_up_at: "" };
      const contacted = Boolean(state.last_contacted_at);
      const followDue = Boolean(state.follow_up_at && state.follow_up_at <= today);
      const priority = !contacted ? 0 : followDue ? 1 : 2;
      return { a, state, contacted, followDue, priority };
    })
    .sort((x, y) => x.priority - y.priority);

  return (
    <div className="page-shell space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Call queue</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Who&apos;s worth calling first, best practical score up top. Log the outcome to track follow-ups and clear the
          queue.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="card space-y-1 py-8 text-center">
          <p className="font-medium text-zinc-800">Nothing to call yet.</p>
          <p className="text-sm text-zinc-600">
            Once applicants complete their skills screen, the strongest ones show up here ranked and ready to call.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(({ a, state, contacted, followDue }, index) => {
            const risk = normalizeRiskLevel(a.risk_level);
            const action =
              a.screen_summary?.recommendedAction ?? deriveRecommendedAction(a.screen_score, a.screen_status, risk);
            const topSignal = a.screen_summary?.strengths?.[0] ?? null;
            const topRisk = a.risk_flags?.[0]?.label ?? null;

            return (
              <div key={a.id} className="card space-y-3">
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
          })}
        </div>
      )}
    </div>
  );
}
