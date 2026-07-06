import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeRow, ConfidencePill, RiskPill, ScreenScoreBadge } from "@/components/ScreenSignals";
import { listApplicationsByOrganization, REVIEW_FLOOR } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { badgesForApplication, deriveRecommendedAction, normalizeRiskLevel } from "@/lib/candidate-intel";
import { getOrganizationBySlug } from "@/lib/organizations";

type PageProps = { params: Promise<{ orgSlug: string }> };

function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  return cleaned.length >= 7 ? `tel:${cleaned}` : null;
}

export default async function CallQueuePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  // Everyone worth a call: a completed screen that cleared the review floor,
  // still in new/screening, ranked by practical score. Clear rejects (below the
  // floor) are excluded — this matches the dashboard "N to work" count exactly.
  const all = listApplicationsByOrganization(organization.id, { orderBy: "score" });
  const queue = all.filter(
    (a) =>
      a.screen_status === "completed" &&
      a.screen_score !== null &&
      a.screen_score >= REVIEW_FLOOR &&
      (a.status === "new" || a.status === "screening"),
  );

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Call queue</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Everyone worth a call, best practical score first. Work top-down — the phone number is one tap away.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="card text-zinc-600">
          Nothing in the queue. Once applicants complete their skills screen, the strongest ones show up here ready to
          call.
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((app, index) => {
            const risk = normalizeRiskLevel(app.risk_level);
            const action = app.screen_summary?.recommendedAction ??
              deriveRecommendedAction(app.screen_score, app.screen_status, risk);
            const tel = telHref(app.applicant_phone);
            return (
              <div key={app.id} className="card flex flex-wrap items-center gap-4">
                <span className="hidden w-6 text-lg font-bold text-zinc-300 sm:block">{index + 1}</span>
                <div className="flex-none">
                  <ScreenScoreBadge score={app.screen_score} status={app.screen_status} size="lg" />
                </div>
                <div className="min-w-[12rem] flex-1">
                  <Link
                    href={`/o/${orgSlug}/admin/applications/${app.id}`}
                    className="font-semibold text-zinc-900 hover:text-blue-700"
                  >
                    {app.applicant_name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {app.job_title}
                    {app.applicant_location ? ` · ${app.applicant_location}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-zinc-800">{action}</span>
                    {app.screen_summary?.confidence ? (
                      <ConfidencePill level={app.screen_summary.confidence} />
                    ) : null}
                  </div>
                  <div className="mt-1.5">
                    <BadgeRow badges={badgesForApplication(app)} max={3} />
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  {risk !== "low" ? <RiskPill level={risk} /> : null}
                  {tel ? (
                    <a href={tel} className="btn-primary text-sm">
                      📞 Call
                    </a>
                  ) : null}
                  <a href={`mailto:${app.applicant_email}`} className="btn-secondary text-sm">
                    ✉ Email
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
