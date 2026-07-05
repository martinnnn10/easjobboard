import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationStatusSelect } from "@/components/ApplicationStatusSelect";
import { MatchScore } from "@/components/MatchScore";
import { NoteForm } from "@/components/NoteForm";
import { getApplicationDetail } from "@/lib/applications";
import { requireOrgSession } from "@/lib/auth";
import { listCandidateEvents, type CandidateEvent } from "@/lib/candidate-events";
import { getOrganizationBySlug } from "@/lib/organizations";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

const EVENT_ICONS: Record<CandidateEvent["type"], string> = {
  applied: "📥",
  stage_change: "➡️",
  note: "📝",
  email_sent: "✉️",
};

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  await requireOrgSession(orgSlug);

  const application = getApplicationDetail(id, organization.id);
  if (!application) notFound();

  const events = listCandidateEvents(id, organization.id);

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/pipeline`} className="text-sm text-blue-600 hover:underline">
          ← Back to pipeline
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">{application.applicant_name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              {application.applicant_email}
              {application.applicant_phone ? ` · ${application.applicant_phone}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Applied to <span className="font-medium text-zinc-700">{application.job_title}</span> on{" "}
              {new Date(application.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ApplicationStatusSelect
              orgSlug={orgSlug}
              applicationId={application.id}
              initialStatus={application.status}
            />
            <a
              href={`/api/o/${orgSlug}/applications/${application.id}/resume`}
              className="text-sm text-blue-600 hover:underline"
            >
              ⬇ {application.resume_filename}
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Match</h2>
            <MatchScore score={application.match_score} skills={application.resume_skills} />
          </section>

          {application.cover_letter ? (
            <section className="card space-y-2">
              <h2 className="text-lg font-semibold text-zinc-900">Cover letter</h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-700">{application.cover_letter}</p>
            </section>
          ) : null}

          <section className="card space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">Notes</h2>
            <NoteForm orgSlug={orgSlug} applicationId={application.id} />
          </section>
        </div>

        <section className="card space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Activity</h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">No activity yet.</p>
          ) : (
            <ol className="space-y-4">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="text-lg leading-6">{EVENT_ICONS[event.type] ?? "•"}</span>
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm text-zinc-800">{event.detail}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {new Date(event.created_at).toLocaleString()}
                      {event.actor ? ` · ${event.actor}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
