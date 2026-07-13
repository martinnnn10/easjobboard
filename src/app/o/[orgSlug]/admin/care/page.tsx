import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmCareTaskPanel } from "@/components/ConfirmCareTaskPanel";
import { requireOrgSession } from "@/lib/auth";
import {
  careAlertsForOwner,
  careTaskQueue,
  sweepEscalations,
  type CareTaskView,
} from "@/lib/candidate-care";
import { careTaskTypeLabel } from "@/lib/care-meta";
import { getOrganizationBySlug } from "@/lib/organizations";
import { canManageTeam, canWrite } from "@/lib/roles";

type PageProps = { params: Promise<{ orgSlug: string }> };

function whenLabel(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : iso;
}

function TaskRow({
  task,
  orgSlug,
  canConfirm,
}: {
  task: CareTaskView;
  orgSlug: string;
  canConfirm: boolean;
}) {
  return (
    <div className="card space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/o/${orgSlug}/admin/candidates/${task.candidate_id}`}
              className="font-semibold text-zinc-900 hover:text-brand-700"
            >
              {task.candidateName}
            </Link>
            {task.status === "escalated" ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                Escalated
              </span>
            ) : task.overdue ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Overdue
              </span>
            ) : task.status === "snoozed" ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                Snoozed
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">
            {careTaskTypeLabel(task.task_type)}
            {task.jobTitle && task.jobTitle !== "—" ? ` · ${task.jobTitle}` : ""}
            {task.interviewWhen ? ` · interview ${whenLabel(task.interviewWhen)}` : ""}
          </p>
          <p className={`text-xs ${task.overdue ? "font-medium text-red-600" : "text-zinc-500"}`}>
            Due {whenLabel(task.due_at)} · owner {task.recruiterName}
          </p>
        </div>
        <div className="flex-none">
          <ConfirmCareTaskPanel orgSlug={orgSlug} taskId={task.id} canConfirm={canConfirm} />
        </div>
      </div>
    </div>
  );
}

export default async function CandidateCarePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const organization = getOrganizationBySlug(orgSlug);
  if (!organization) notFound();

  const { user } = await requireOrgSession(orgSlug);
  const writable = canWrite(user.role);
  const isOwner = canManageTeam(user.role);

  // Lazy escalation sweep on load (owners drive the SLA); returns count escalated.
  if (isOwner) {
    await sweepEscalations(organization.id);
  }

  // Owners see the whole org's queue; recruiters see only their own tasks.
  const tasks = careTaskQueue(organization.id, isOwner ? null : user.id);
  const alerts = isOwner ? careAlertsForOwner(organization.id) : null;

  const overdue = tasks.filter((t) => t.overdue || t.status === "escalated");
  const upcoming = tasks.filter((t) => !t.overdue && t.status !== "escalated");

  function canConfirm(task: CareTaskView): boolean {
    return writable && (isOwner || task.assigned_recruiter_id === user.id);
  }

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Candidate Care</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Interview follow-ups that keep candidates warm. Confirm each outreach to clear it — anything unconfirmed past
          its {""}
          {12}-hour SLA escalates to the owner.
        </p>
      </div>

      {isOwner && alerts ? (
        <section className="grid gap-3 sm:grid-cols-4">
          <div className="card text-center">
            <p className="text-2xl font-bold text-zinc-900">{alerts.totalOpen}</p>
            <p className="text-xs text-zinc-500">Open tasks</p>
          </div>
          <div className="card text-center">
            <p className={`text-2xl font-bold ${alerts.overdue.length ? "text-amber-600" : "text-zinc-900"}`}>
              {alerts.overdue.length}
            </p>
            <p className="text-xs text-zinc-500">Overdue</p>
          </div>
          <div className="card text-center">
            <p className={`text-2xl font-bold ${alerts.escalated.length ? "text-red-600" : "text-zinc-900"}`}>
              {alerts.escalated.length}
            </p>
            <p className="text-xs text-zinc-500">Escalated</p>
          </div>
          <div className="card text-center">
            <p className={`text-2xl font-bold ${alerts.interviewsSoonNoCheckin.length ? "text-amber-600" : "text-zinc-900"}`}>
              {alerts.interviewsSoonNoCheckin.length}
            </p>
            <p className="text-xs text-zinc-500">Interviews ≤48h, no check-in</p>
          </div>
        </section>
      ) : null}

      {overdue.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">
            Needs attention ({overdue.length})
          </h2>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} orgSlug={orgSlug} canConfirm={canConfirm(t)} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {isOwner ? "All open follow-ups" : "My follow-ups"} ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="card py-8 text-center text-sm text-zinc-500">
            {overdue.length > 0
              ? "Nothing else on deck — clear the items above."
              : "No open follow-ups. Schedule an interview from a candidate profile and tasks appear here."}
          </div>
        ) : (
          upcoming.map((t) => <TaskRow key={t.id} task={t} orgSlug={orgSlug} canConfirm={canConfirm(t)} />)
        )}
      </section>

      {isOwner && alerts && alerts.recruiterLoad.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recruiter load</h2>
          <div className="card divide-y divide-zinc-100">
            {alerts.recruiterLoad.map((r) => (
              <div key={r.recruiterId || "unassigned"} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-700">{r.recruiterName}</span>
                <span className="font-semibold text-zinc-900">{r.open} open</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
