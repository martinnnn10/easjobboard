import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignRecruiterSelect } from "@/components/AssignRecruiterSelect";
import { ConfirmCareTaskPanel } from "@/components/ConfirmCareTaskPanel";
import { ScheduleInterviewForm } from "@/components/ScheduleInterviewForm";
import { StatusBadge } from "@/components/StatusBadge";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/application-status";
import { requireOrgSession } from "@/lib/auth";
import { assignedCandidatesForJob, jobApplicants } from "@/lib/candidate-care";
import { careTaskTypeLabel } from "@/lib/care-meta";
import { getJobById } from "@/lib/jobs";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam, canWrite } from "@/lib/roles";
import { listUsersByOrganization } from "@/lib/users";

type PageProps = { params: Promise<{ orgSlug: string; id: string }> };

function whenLabel(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const isOwner = canManageTeam(user.role);

  const job = getJobById(id);
  if (!job || job.organization_id !== organization.id) notFound();

  const assigned = assignedCandidatesForJob(organization.id, id);
  const assignedIds = new Set(assigned.map((a) => a.candidateId));
  const applicants = jobApplicants(organization.id, id);
  const unassigned = applicants.filter((a) => !assignedIds.has(a.candidateId));
  const recruiters = listUsersByOrganization(organization.id)
    .filter((u) => u.role !== "viewer")
    .map((u) => ({ id: u.id, name: u.name }));
  const jobOption = [{ id: job.id, title: job.title }];

  return (
    <div className="page-shell space-y-6">
      <div>
        <Link href={`/o/${orgSlug}/admin/jobs`} className="text-sm text-brand-700 hover:underline">
          ← Back to jobs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{job.title}</h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="mt-1 text-sm text-zinc-600">{job.location}</p>
          </div>
          {writable ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/edit`} className="btn-secondary text-sm">
                Edit
              </Link>
              <Link href={`/o/${orgSlug}/admin/jobs/${job.id}/source`} className="btn-secondary text-sm">
                Source
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900">Assigned candidates</h2>

        {assigned.length === 0 ? (
          <div className="card text-sm text-zinc-500">
            No candidates assigned yet. Assign a recruiter to a candidate below to start Candidate Care.
          </div>
        ) : (
          <div className="space-y-3">
            {assigned.map((row) => (
              <div key={row.candidateId} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/o/${orgSlug}/admin/candidates/${row.candidateId}`}
                      className="font-semibold text-zinc-900 hover:text-brand-700"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {row.stage ? APPLICATION_STATUS_LABELS[row.stage as ApplicationStatus] ?? row.stage : "—"}
                      {row.lastContactedAt ? ` · last contacted ${new Date(row.lastContactedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-zinc-500">Recruiter</p>
                    {writable ? (
                      <AssignRecruiterSelect
                        orgSlug={orgSlug}
                        jobId={job.id}
                        candidateId={row.candidateId}
                        recruiters={recruiters}
                        currentRecruiterId={row.recruiterId}
                      />
                    ) : (
                      <p className="font-medium text-zinc-800">{row.recruiterName}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg bg-zinc-50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next interview</p>
                    {row.nextInterview ? (
                      <p className="text-zinc-800">
                        {whenLabel(row.nextInterview.interview_datetime)}
                        {row.nextInterview.interview_title ? ` · ${row.nextInterview.interview_title}` : ""}
                      </p>
                    ) : (
                      <p className="text-zinc-400">None scheduled</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next care task</p>
                    {row.nextTask ? (
                      <p className={row.overdue ? "font-medium text-red-600" : "text-zinc-800"}>
                        {careTaskTypeLabel(row.nextTask.task_type)} · due {whenLabel(row.nextTask.due_at)}
                        {row.overdue ? " (overdue)" : ""}
                      </p>
                    ) : (
                      <p className="text-zinc-400">No open tasks</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {writable ? (
                    <ScheduleInterviewForm orgSlug={orgSlug} candidateId={row.candidateId} jobs={jobOption} defaultJobId={job.id} compact />
                  ) : null}
                  {row.nextTask && writable ? (
                    <ConfirmCareTaskPanel
                      orgSlug={orgSlug}
                      taskId={row.nextTask.id}
                      canConfirm={isOwner || row.recruiterId === user.id}
                    />
                  ) : null}
                  <Link href={`/o/${orgSlug}/admin/candidates/${row.candidateId}`} className="text-sm text-brand-700 hover:underline">
                    View profile →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {writable && unassigned.length > 0 ? (
          <div className="card space-y-2">
            <p className="text-sm font-semibold text-zinc-800">Assign a candidate</p>
            <p className="text-xs text-zinc-500">Applicants on this req who don&apos;t have a recruiter yet.</p>
            <div className="space-y-2">
              {unassigned.map((c) => (
                <div key={c.candidateId} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-2 last:border-0">
                  <span className="text-sm text-zinc-800">{c.name}</span>
                  <AssignRecruiterSelect
                    orgSlug={orgSlug}
                    jobId={job.id}
                    candidateId={c.candidateId}
                    recruiters={recruiters}
                    currentRecruiterId=""
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
