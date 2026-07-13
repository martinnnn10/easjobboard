import Link from "next/link";
import { notFound } from "next/navigation";
import { SourcingUnavailable } from "@/components/SourcingUnavailable";
import { requireOrgSession } from "@/lib/auth";
import {
  CANDIDATE_CRM_STATUS_LABELS,
  CANDIDATE_SOURCE_LABELS,
  isCandidateSource,
  type CandidateCrmStatus,
} from "@/lib/candidate-meta";
import { getOutreachCounts, listCandidates, type CandidateWithApps } from "@/lib/candidates";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam } from "@/lib/roles";
import { isSourcingConfigured } from "@/lib/sourcing";

type PageProps = { params: Promise<{ orgSlug: string }> };

// Worklist order: hottest first. "Replied" needs a fast human response;
// "needs outreach" is the fresh backlog; contacted is waiting on them.
const ACTIVE_STATUSES: CandidateCrmStatus[] = ["replied", "needs_outreach", "interested", "contacted"];
const QUIET_STATUSES: CandidateCrmStatus[] = ["internal_record", "not_interested", "do_not_contact"];

const STATUS_ACCENT: Record<string, string> = {
  replied: "border-l-emerald-500",
  needs_outreach: "border-l-amber-500",
  interested: "border-l-blue-500",
  contacted: "border-l-zinc-400",
};

function CandidateRow({ orgSlug, candidate }: { orgSlug: string; candidate: CandidateWithApps }) {
  const subtitle = [candidate.title, candidate.company].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 py-3 last:border-0">
      <div className="min-w-0">
        <Link
          href={`/o/${orgSlug}/admin/candidates/${candidate.id}`}
          className="font-medium text-zinc-900 hover:text-blue-700 hover:underline"
        >
          {candidate.name || candidate.email}
        </Link>
        {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          {candidate.source !== "applied" ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              {isCandidateSource(candidate.source) ? CANDIDATE_SOURCE_LABELS[candidate.source] : candidate.source}
              {candidate.source_provider ? ` · ${candidate.source_provider}` : ""}
            </span>
          ) : null}
          {candidate.ownerName ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
              {candidate.ownerName}
            </span>
          ) : null}
          {candidate.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-white">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <a href={`mailto:${candidate.email}`} className="btn-secondary px-2.5 py-1 text-xs">
          Email
        </a>
        {candidate.phone ? (
          <a href={`tel:${candidate.phone}`} className="btn-secondary px-2.5 py-1 text-xs">
            Call
          </a>
        ) : null}
        <Link href={`/o/${orgSlug}/admin/candidates/${candidate.id}`} className="text-blue-600 hover:underline">
          Open →
        </Link>
      </div>
    </div>
  );
}

export default async function OutreachPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);

  // Outreach is the outbound-sourcing worklist; hide it entirely until a
  // sourcing provider is connected so buyers never hit an unconfigured feature.
  if (!isSourcingConfigured()) {
    return <SourcingUnavailable orgSlug={orgSlug} canManage={canManageTeam(user.role)} title="Outreach" />;
  }

  const counts = getOutreachCounts(organization.id);
  const buckets = ACTIVE_STATUSES.map((status) => ({
    status,
    candidates: listCandidates(organization.id, { crmStatus: status }),
  })).filter((b) => b.candidates.length > 0);

  const totalActive = ACTIVE_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Back to admin
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Outreach</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Your nurture worklist — sourced and passive candidates by outreach status. Logging a call, email, or text
              on a profile moves a fresh prospect to “Contacted”.
            </p>
          </div>
          <Link href={`/o/${orgSlug}/admin/candidates/new`} className="btn-primary shrink-0">
            + Add candidate
          </Link>
        </div>
      </div>

      {totalActive === 0 ? (
        <div className="card space-y-2 text-zinc-600">
          <p>No candidates are in an active outreach stage yet.</p>
          <p className="text-sm text-zinc-500">
            <Link href={`/o/${orgSlug}/admin/candidates/new`} className="text-blue-600 hover:underline">
              Add a sourced candidate
            </Link>{" "}
            to start building your pipeline of passive prospects.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {buckets.map((bucket) => (
            <section
              key={bucket.status}
              className={`card border-l-4 ${STATUS_ACCENT[bucket.status] ?? "border-l-zinc-300"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {CANDIDATE_CRM_STATUS_LABELS[bucket.status]}
                </h2>
                <span className="text-sm text-zinc-500">{bucket.candidates.length}</span>
              </div>
              <div>
                {bucket.candidates.map((candidate) => (
                  <CandidateRow key={candidate.id} orgSlug={orgSlug} candidate={candidate} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {QUIET_STATUSES.some((s) => counts[s]) ? (
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          {QUIET_STATUSES.filter((s) => counts[s]).map((s) => (
            <Link
              key={s}
              href={`/o/${orgSlug}/admin/candidates?cstatus=${s}`}
              className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600 hover:bg-zinc-200"
            >
              {CANDIDATE_CRM_STATUS_LABELS[s]}: {counts[s]}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
