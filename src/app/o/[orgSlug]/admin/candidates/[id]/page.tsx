import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateCrmPanel } from "@/components/CandidateCrmPanel";
import { CandidateNoteForm } from "@/components/CandidateNoteForm";
import { ScreenScoreBadge } from "@/components/ScreenSignals";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { getCandidateWithApplications } from "@/lib/candidates";
import { listEventsByCandidate, type CandidateEventType } from "@/lib/candidate-events";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canWrite } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

const EVENT_ICON: Record<CandidateEventType, string> = {
  applied: "📥",
  stage_change: "↕",
  note: "📝",
  email_sent: "✉",
};

export default async function CandidateProfilePage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);

  const candidate = getCandidateWithApplications(id, organization.id);
  if (!candidate) notFound();

  const events = listEventsByCandidate(candidate.id, organization.id);
  const members = listUsersByOrganization(organization.id).map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/candidates`} className="text-sm text-blue-600 hover:underline">
          ← Back to candidate pool
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{candidate.name || candidate.email}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              <a href={`mailto:${candidate.email}`} className="text-blue-600 hover:underline">
                {candidate.email}
              </a>
              {candidate.phone ? (
                <>
                  {" · "}
                  <a href={`tel:${candidate.phone}`} className="text-blue-600 hover:underline">
                    {candidate.phone}
                  </a>
                </>
              ) : null}
              {candidate.location ? ` · ${candidate.location}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {candidate.applications.length} application{candidate.applications.length === 1 ? "" : "s"} · in pool since{" "}
              {new Date(candidate.first_applied_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {candidate.bestScreenScore !== null ? (
              <ScreenScoreBadge score={candidate.bestScreenScore} status="completed" size="lg" />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Applications</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Job</th>
                    <th className="py-2 pr-4 font-medium">Stage</th>
                    <th className="py-2 pr-4 font-medium">Screen</th>
                    <th className="py-2 pr-4 font-medium">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {candidate.applications.map((a) => (
                    <tr key={a.applicationId} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/o/${orgSlug}/admin/applications/${a.applicationId}`}
                          className="font-medium text-zinc-900 hover:text-blue-700"
                        >
                          {a.jobTitle}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-zinc-600">
                        {APPLICATION_STATUS_LABELS[a.status] ?? a.status}
                      </td>
                      <td className="py-2 pr-4">
                        <ScreenScoreBadge score={a.screenScore} status={a.screenStatus} />
                      </td>
                      <td className="py-2 pr-4 text-zinc-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Timeline</h2>
            {writable ? <CandidateNoteForm orgSlug={orgSlug} candidateId={candidate.id} /> : null}
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 text-base">
                      {EVENT_ICON[event.type] ?? "•"}
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm text-zinc-800">{event.detail}</p>
                      <p className="text-xs text-zinc-400">
                        {event.actor ? `${event.actor} · ` : ""}
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <CandidateCrmPanel
              orgSlug={orgSlug}
              candidateId={candidate.id}
              initialTags={candidate.tags}
              initialOwnerId={candidate.owner_user_id}
              members={members}
              canEdit={writable}
            />
          </section>

          {candidate.skills.length > 0 ? (
            <section className="card space-y-2">
              <p className="section-label">Skills seen on resumes</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
