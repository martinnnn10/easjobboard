import { randomUUID } from "crypto";
import { recordCandidateEvent } from "./candidate-events";
import {
  careOutcomeLabel,
  careTaskTypeLabel,
  contactMethodLabel,
  interviewTypeLabel,
  CARE_SLA_HOURS,
  type CareOutcome,
  type CareTaskType,
  type ContactMethod,
} from "./care-meta";
import { getDb } from "./db";
import { sendCareEscalationEmail } from "./email";
import { getPublicBaseUrl } from "./env";
import { getJobById } from "./jobs";
import { getCandidateById } from "./candidates";
import { getOrganizationById } from "./organizations";
import { getUserById, listUsersByOrganization } from "./users";

/**
 * Candidate Care: keeps a recruiter accountable for engaging a candidate around
 * every interview. Scheduling an interview auto-creates the required follow-up
 * tasks; each has an SLA, and un-confirmed tasks escalate to the owner.
 */

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type CandidateAssignment = {
  id: string;
  candidate_id: string;
  job_id: string;
  assigned_recruiter_id: string;
  assigned_by: string;
  assigned_at: string;
  status: string;
};

export type Interview = {
  id: string;
  candidate_id: string;
  job_id: string;
  application_id: string | null;
  client: string;
  interview_title: string;
  interview_type: string;
  interview_datetime: string;
  timezone: string;
  location: string;
  hiring_manager: string;
  stage: string;
  notes: string;
  created_by: string;
  created_at: string;
};

export type CareTask = {
  id: string;
  candidate_id: string;
  job_id: string;
  application_id: string | null;
  interview_id: string | null;
  assigned_recruiter_id: string;
  task_type: string;
  due_at: string;
  escalation_at: string;
  status: string;
  confirmed_at: string;
  confirmed_by: string;
  contact_method: string;
  outcome: string;
  notes: string;
  escalated_at: string;
  escalated_to: string;
  created_at: string;
  updated_at: string;
};

// ─── Assignment ────────────────────────────────────────────────────────────

/** Assign (or reassign) the recruiter responsible for a candidate on a job. */
export function assignRecruiter(input: {
  organization_id: string;
  candidate_id: string;
  job_id: string;
  assigned_recruiter_id: string;
  assigned_by: string;
  actor: string;
}): CandidateAssignment {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT * FROM candidate_assignments WHERE organization_id = ? AND candidate_id = ? AND job_id = ? AND status = 'active'",
    )
    .get(input.organization_id, input.candidate_id, input.job_id) as CandidateAssignment | undefined;

  const now = nowIso();
  if (existing) {
    db.prepare("UPDATE candidate_assignments SET assigned_recruiter_id = ?, assigned_by = ?, assigned_at = ? WHERE id = ?")
      .run(input.assigned_recruiter_id, input.assigned_by, now, existing.id);
    // Re-point any open tasks to the new owner.
    db.prepare(
      "UPDATE care_tasks SET assigned_recruiter_id = ?, updated_at = ? WHERE candidate_id = ? AND job_id = ? AND status IN ('open','snoozed','escalated')",
    ).run(input.assigned_recruiter_id, now, input.candidate_id, input.job_id);
  } else {
    db.prepare(
      `INSERT INTO candidate_assignments (id, organization_id, candidate_id, job_id, assigned_recruiter_id, assigned_by, assigned_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    ).run(randomUUID(), input.organization_id, input.candidate_id, input.job_id, input.assigned_recruiter_id, input.assigned_by, now);
  }

  const recruiter = getUserById(input.assigned_recruiter_id);
  const job = getJobById(input.job_id);
  recordCandidateEvent({
    organization_id: input.organization_id,
    candidate_id: input.candidate_id,
    type: "care",
    detail: `Assigned to ${recruiter?.name ?? "a recruiter"}${job ? ` for ${job.title}` : ""}`,
    actor: input.actor,
  });

  return getActiveAssignment(input.organization_id, input.candidate_id, input.job_id)!;
}

export function getActiveAssignment(orgId: string, candidateId: string, jobId: string): CandidateAssignment | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM candidate_assignments WHERE organization_id = ? AND candidate_id = ? AND job_id = ? AND status = 'active'",
    )
    .get(orgId, candidateId, jobId) as CandidateAssignment | undefined;
  return row ?? null;
}

// ─── Interview + automatic tasks ─────────────────────────────────────────────

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function escalationFrom(dueIso: string): string {
  return new Date(Date.parse(dueIso) + CARE_SLA_HOURS * HOUR_MS).toISOString();
}

/**
 * Schedule an interview and auto-create the three required follow-ups:
 * pre-interview check-in (24h before), day-of confirmation (morning of), and
 * post-interview follow-up (2h after). Each gets a 12h escalation SLA.
 */
export function scheduleInterview(input: {
  organization_id: string;
  candidate_id: string;
  job_id: string;
  application_id?: string | null;
  client?: string;
  interview_title?: string;
  interview_type?: string;
  interview_datetime: string; // local ISO from a datetime-local input
  timezone?: string;
  location?: string;
  hiring_manager?: string;
  stage?: string;
  notes?: string;
  created_by: string;
  actor: string;
}): Interview {
  const db = getDb();
  const id = randomUUID();
  const now = nowIso();

  db.prepare(
    `INSERT INTO interviews (id, organization_id, candidate_id, job_id, application_id, client, interview_title,
       interview_type, interview_datetime, timezone, location, hiring_manager, stage, notes, created_by, created_at)
     VALUES (@id, @organization_id, @candidate_id, @job_id, @application_id, @client, @interview_title,
       @interview_type, @interview_datetime, @timezone, @location, @hiring_manager, @stage, @notes, @created_by, @created_at)`,
  ).run({
    id,
    organization_id: input.organization_id,
    candidate_id: input.candidate_id,
    job_id: input.job_id,
    application_id: input.application_id || null,
    client: input.client ?? "",
    interview_title: input.interview_title ?? "",
    interview_type: input.interview_type ?? "",
    interview_datetime: input.interview_datetime,
    timezone: input.timezone ?? "",
    location: input.location ?? "",
    hiring_manager: input.hiring_manager ?? "",
    stage: input.stage ?? "",
    notes: input.notes ?? "",
    created_by: input.created_by,
    created_at: now,
  });

  // Owner of the follow-ups: the active assignment's recruiter, else the creator.
  const assignment = getActiveAssignment(input.organization_id, input.candidate_id, input.job_id);
  const recruiterId = assignment?.assigned_recruiter_id || input.created_by;

  const interviewMs = Date.parse(input.interview_datetime);
  const datePart = input.interview_datetime.slice(0, 10);
  const tasks: Array<{ type: CareTaskType; due: string }> = [];
  if (Number.isFinite(interviewMs)) {
    tasks.push({ type: "pre_interview_checkin", due: new Date(interviewMs - DAY_MS).toISOString() });
    tasks.push({ type: "day_of_confirmation", due: new Date(`${datePart}T08:00:00`).toISOString() });
    tasks.push({ type: "post_interview_followup", due: new Date(interviewMs + 2 * HOUR_MS).toISOString() });
  }

  const insertTask = db.prepare(
    `INSERT INTO care_tasks (id, organization_id, candidate_id, job_id, application_id, interview_id,
       assigned_recruiter_id, task_type, due_at, escalation_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
  );
  for (const t of tasks) {
    insertTask.run(
      randomUUID(),
      input.organization_id,
      input.candidate_id,
      input.job_id,
      input.application_id || null,
      id,
      recruiterId,
      t.type,
      t.due,
      escalationFrom(t.due),
      now,
      now,
    );
  }

  const when = Number.isFinite(interviewMs) ? new Date(interviewMs).toLocaleString() : input.interview_datetime;
  const typeLabel = input.interview_type ? interviewTypeLabel(input.interview_type) : "Interview";
  recordCandidateEvent({
    organization_id: input.organization_id,
    candidate_id: input.candidate_id,
    application_id: input.application_id || undefined,
    type: "interview",
    detail: `Interview scheduled — ${input.interview_title || typeLabel} on ${when}`,
    actor: input.actor,
  });
  if (tasks.length > 0) {
    recordCandidateEvent({
      organization_id: input.organization_id,
      candidate_id: input.candidate_id,
      type: "care",
      detail: `${tasks.length} Candidate Care follow-ups created (pre-interview, day-of, post-interview)`,
      actor: input.actor,
    });
  }

  return getInterview(id, input.organization_id)!;
}

export function getInterview(id: string, orgId: string): Interview | null {
  const row = getDb()
    .prepare("SELECT * FROM interviews WHERE id = ? AND organization_id = ?")
    .get(id, orgId) as Interview | undefined;
  return row ?? null;
}

// ─── Task confirmation / lifecycle ───────────────────────────────────────────

export function getCareTask(id: string, orgId: string): CareTask | null {
  const row = getDb().prepare("SELECT * FROM care_tasks WHERE id = ? AND organization_id = ?").get(id, orgId) as
    | CareTask
    | undefined;
  return row ?? null;
}

const OUTCOME_STATUS: Partial<Record<CareOutcome, string>> = {
  candidate_withdrew: "cancelled",
};

/** Recruiter confirms they reached out. Records the outcome + a timeline event. */
export function confirmCareTask(input: {
  organization_id: string;
  task: CareTask;
  contact_method: ContactMethod;
  outcome: CareOutcome;
  notes?: string;
  actor: string;
  actor_id: string;
}): void {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `UPDATE care_tasks SET status = 'confirmed', confirmed_at = ?, confirmed_by = ?, contact_method = ?, outcome = ?, notes = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
  ).run(now, input.actor_id, input.contact_method, input.outcome, input.notes ?? "", now, input.task.id, input.organization_id);

  // Confirming outreach counts as contact — keep last_contacted fresh.
  db.prepare("UPDATE candidates SET last_contacted_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?").run(
    now,
    now,
    input.task.candidate_id,
    input.organization_id,
  );

  const detail = `${careTaskTypeLabel(input.task.task_type)} confirmed via ${contactMethodLabel(
    input.contact_method,
  )} · ${careOutcomeLabel(input.outcome)}${input.notes ? ` — ${input.notes}` : ""}`;
  recordCandidateEvent({
    organization_id: input.organization_id,
    candidate_id: input.task.candidate_id,
    application_id: input.task.application_id || undefined,
    type: "care",
    detail,
    actor: input.actor,
  });

  // A couple of outcomes change the assignment lifecycle.
  const nextAssignmentStatus = OUTCOME_STATUS[input.outcome];
  if (nextAssignmentStatus === "cancelled") {
    db.prepare(
      "UPDATE candidate_assignments SET status = 'withdrawn' WHERE organization_id = ? AND candidate_id = ? AND job_id = ? AND status = 'active'",
    ).run(input.organization_id, input.task.candidate_id, input.task.job_id);
    // Cancel remaining open tasks for this candidate+job.
    db.prepare(
      "UPDATE care_tasks SET status = 'cancelled', updated_at = ? WHERE organization_id = ? AND candidate_id = ? AND job_id = ? AND status IN ('open','snoozed','escalated')",
    ).run(now, input.organization_id, input.task.candidate_id, input.task.job_id);
  }
}

export function snoozeCareTask(orgId: string, task: CareTask, days: number, actor: string): void {
  const db = getDb();
  const now = nowIso();
  const newDue = new Date(Date.now() + Math.max(1, days) * DAY_MS).toISOString();
  db.prepare(
    "UPDATE care_tasks SET status = 'snoozed', due_at = ?, escalation_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
  ).run(newDue, escalationFrom(newDue), now, task.id, orgId);
  recordCandidateEvent({
    organization_id: orgId,
    candidate_id: task.candidate_id,
    type: "care",
    detail: `${careTaskTypeLabel(task.task_type)} snoozed ${days} day${days === 1 ? "" : "s"}`,
    actor,
  });
}

export function cancelCareTask(orgId: string, task: CareTask, actor: string): void {
  getDb()
    .prepare("UPDATE care_tasks SET status = 'cancelled', updated_at = ? WHERE id = ? AND organization_id = ?")
    .run(nowIso(), task.id, orgId);
  recordCandidateEvent({
    organization_id: orgId,
    candidate_id: task.candidate_id,
    type: "care",
    detail: `${careTaskTypeLabel(task.task_type)} cancelled`,
    actor,
  });
}

// ─── Escalation sweep ────────────────────────────────────────────────────────

/**
 * Escalate every Open/Snoozed task whose SLA has lapsed (past escalation_at,
 * still unconfirmed). Marks them escalated, logs the timeline, and emails the
 * org owners (or records that email delivery isn't configured). Idempotent —
 * a task escalates once. Runs lazily on owner/care page loads and via
 * POST /care/sweep. Returns the number escalated.
 */
export async function sweepEscalations(orgId: string): Promise<number> {
  const db = getDb();
  const now = nowIso();
  const due = db
    .prepare(
      "SELECT * FROM care_tasks WHERE organization_id = ? AND status IN ('open','snoozed') AND escalation_at != '' AND escalation_at <= ?",
    )
    .all(orgId, now) as CareTask[];
  if (due.length === 0) return 0;

  const organization = getOrganizationById(orgId);
  const owners = listUsersByOrganization(orgId).filter((u) => u.role === "owner");
  const ownerEmails = owners.map((o) => o.email).filter(Boolean);
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const base = getPublicBaseUrl();

  for (const task of due) {
    db.prepare(
      "UPDATE care_tasks SET status = 'escalated', escalated_at = ?, escalated_to = ?, updated_at = ? WHERE id = ?",
    ).run(now, ownerEmails.join(", "), now, task.id);

    const candidate = getCandidateById(task.candidate_id, orgId);
    const recruiter = task.assigned_recruiter_id ? getUserById(task.assigned_recruiter_id) : null;
    const job = task.job_id ? getJobById(task.job_id) : null;
    const interview = task.interview_id ? getInterview(task.interview_id, orgId) : null;

    recordCandidateEvent({
      organization_id: orgId,
      candidate_id: task.candidate_id,
      type: "care",
      detail: `Escalated: ${careTaskTypeLabel(task.task_type)} not confirmed within ${CARE_SLA_HOURS}h${
        ownerEmails.length ? ` — notified ${ownerEmails.join(", ")}` : ""
      }`,
      actor: "System",
    });

    if (smtpConfigured && ownerEmails.length > 0 && organization) {
      try {
        await sendCareEscalationEmail({
          organization,
          to: ownerEmails,
          candidateName: candidate?.name || candidate?.email || "Candidate",
          jobTitle: job?.title ?? "",
          interviewWhen: interview ? interview.interview_datetime : "",
          recruiterName: recruiter?.name ?? "Unassigned",
          taskLabel: careTaskTypeLabel(task.task_type),
          dueAt: task.due_at,
          profileUrl: `${base}/o/${organization.slug}/admin/candidates/${task.candidate_id}`,
          careUrl: `${base}/o/${organization.slug}/admin/care`,
        });
      } catch (e) {
        console.error("Care escalation email failed:", e);
      }
    }
  }
  return due.length;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const OPEN_STATUSES = "('open','snoozed','escalated')";

export function careForCandidate(orgId: string, candidateId: string): {
  assignments: Array<CandidateAssignment & { recruiterName: string; jobTitle: string }>;
  interviews: Interview[];
  tasks: CareTask[];
} {
  const db = getDb();
  const assignments = (
    db
      .prepare("SELECT * FROM candidate_assignments WHERE organization_id = ? AND candidate_id = ? ORDER BY assigned_at DESC")
      .all(orgId, candidateId) as CandidateAssignment[]
  ).map((a) => ({
    ...a,
    recruiterName: getUserById(a.assigned_recruiter_id)?.name ?? "Unassigned",
    jobTitle: getJobById(a.job_id)?.title ?? "—",
  }));
  const interviews = db
    .prepare("SELECT * FROM interviews WHERE organization_id = ? AND candidate_id = ? ORDER BY interview_datetime DESC")
    .all(orgId, candidateId) as Interview[];
  const tasks = db
    .prepare("SELECT * FROM care_tasks WHERE organization_id = ? AND candidate_id = ? ORDER BY due_at ASC")
    .all(orgId, candidateId) as CareTask[];
  return { assignments, interviews, tasks };
}

/** Candidates who applied to a job (for the assign picker). */
export function jobApplicants(orgId: string, jobId: string): Array<{ candidateId: string; name: string }> {
  const rows = getDb()
    .prepare("SELECT DISTINCT candidate_id FROM applications WHERE organization_id = ? AND job_id = ? AND candidate_id != ''")
    .all(orgId, jobId) as Array<{ candidate_id: string }>;
  return rows
    .map((r) => {
      const c = getCandidateById(r.candidate_id, orgId);
      return c ? { candidateId: c.id, name: c.name || c.email } : null;
    })
    .filter((x): x is { candidateId: string; name: string } => x !== null);
}

export type AssignedCandidateRow = {
  candidateId: string;
  name: string;
  email: string;
  phone: string;
  recruiterId: string;
  recruiterName: string;
  stage: string;
  nextInterview: Interview | null;
  nextTask: CareTask | null;
  lastContactedAt: string;
  overdue: boolean;
};

/** The "Assigned Candidates" table for a job req. */
export function assignedCandidatesForJob(orgId: string, jobId: string): AssignedCandidateRow[] {
  const db = getDb();
  const assignments = db
    .prepare("SELECT * FROM candidate_assignments WHERE organization_id = ? AND job_id = ? AND status = 'active' ORDER BY assigned_at DESC")
    .all(orgId, jobId) as CandidateAssignment[];
  const now = nowIso();

  return assignments.map((a) => {
    const candidate = getCandidateById(a.candidate_id, orgId);
    const nextInterview = db
      .prepare(
        "SELECT * FROM interviews WHERE organization_id = ? AND candidate_id = ? AND job_id = ? AND interview_datetime >= ? ORDER BY interview_datetime ASC LIMIT 1",
      )
      .get(orgId, a.candidate_id, jobId, now) as Interview | undefined;
    const nextTask = db
      .prepare(
        `SELECT * FROM care_tasks WHERE organization_id = ? AND candidate_id = ? AND job_id = ? AND status IN ${OPEN_STATUSES} ORDER BY due_at ASC LIMIT 1`,
      )
      .get(orgId, a.candidate_id, jobId) as CareTask | undefined;
    const app = db
      .prepare("SELECT status FROM applications WHERE candidate_id = ? AND job_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(a.candidate_id, jobId) as { status?: string } | undefined;

    return {
      candidateId: a.candidate_id,
      name: candidate?.name || candidate?.email || "—",
      email: candidate?.email ?? "",
      phone: candidate?.phone ?? "",
      recruiterId: a.assigned_recruiter_id,
      recruiterName: getUserById(a.assigned_recruiter_id)?.name ?? "Unassigned",
      stage: app?.status ?? "",
      nextInterview: nextInterview ?? null,
      nextTask: nextTask ?? null,
      lastContactedAt: candidate?.last_contacted_at ?? "",
      overdue: Boolean(nextTask && nextTask.due_at <= now),
    };
  });
}

export type CareTaskView = CareTask & {
  candidateName: string;
  jobTitle: string;
  recruiterName: string;
  interviewWhen: string;
  overdue: boolean;
};

function decorateTask(orgId: string, t: CareTask, now: string): CareTaskView {
  const candidate = getCandidateById(t.candidate_id, orgId);
  const interview = t.interview_id ? getInterview(t.interview_id, orgId) : null;
  return {
    ...t,
    candidateName: candidate?.name || candidate?.email || "—",
    jobTitle: t.job_id ? getJobById(t.job_id)?.title ?? "—" : "—",
    recruiterName: t.assigned_recruiter_id ? getUserById(t.assigned_recruiter_id)?.name ?? "Unassigned" : "Unassigned",
    interviewWhen: interview?.interview_datetime ?? "",
    overdue: (t.status === "open" || t.status === "snoozed" || t.status === "escalated") && t.due_at <= now,
  };
}

/**
 * Recruiter task queue. `all` (owner view) returns everyone's open tasks;
 * otherwise just the recruiter's. Ordered overdue/soonest first.
 */
export function careTaskQueue(orgId: string, recruiterId: string | null): CareTaskView[] {
  const db = getDb();
  const now = nowIso();
  const rows = recruiterId
    ? (db
        .prepare(
          `SELECT * FROM care_tasks WHERE organization_id = ? AND assigned_recruiter_id = ? AND status IN ${OPEN_STATUSES} ORDER BY due_at ASC`,
        )
        .all(orgId, recruiterId) as CareTask[])
    : (db
        .prepare(`SELECT * FROM care_tasks WHERE organization_id = ? AND status IN ${OPEN_STATUSES} ORDER BY due_at ASC`)
        .all(orgId) as CareTask[]);
  return rows.map((t) => decorateTask(orgId, t, now));
}

export type CareAlerts = {
  overdue: CareTaskView[];
  escalated: CareTaskView[];
  interviewsSoonNoCheckin: Array<{ interview: Interview; candidateName: string; recruiterName: string }>;
  recruiterLoad: Array<{ recruiterId: string; recruiterName: string; open: number }>;
  totalOpen: number;
};

/** Owner dashboard "Candidate Care Alerts". */
export function careAlertsForOwner(orgId: string): CareAlerts {
  const db = getDb();
  const now = nowIso();
  const soon = new Date(Date.now() + 2 * DAY_MS).toISOString();

  const openTasks = (
    db.prepare(`SELECT * FROM care_tasks WHERE organization_id = ? AND status IN ${OPEN_STATUSES}`).all(orgId) as CareTask[]
  ).map((t) => decorateTask(orgId, t, now));

  const overdue = openTasks.filter((t) => t.status !== "escalated" && t.overdue).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const escalated = openTasks.filter((t) => t.status === "escalated").sort((a, b) => a.due_at.localeCompare(b.due_at));

  const upcoming = db
    .prepare(
      "SELECT * FROM interviews WHERE organization_id = ? AND interview_datetime >= ? AND interview_datetime <= ? ORDER BY interview_datetime ASC",
    )
    .all(orgId, now, soon) as Interview[];
  const interviewsSoonNoCheckin = upcoming
    .filter((iv) => {
      const confirmed = db
        .prepare(
          "SELECT COUNT(*) AS c FROM care_tasks WHERE interview_id = ? AND task_type IN ('pre_interview_checkin','day_of_confirmation') AND status = 'confirmed'",
        )
        .get(iv.id) as { c: number };
      return confirmed.c === 0;
    })
    .map((iv) => {
      const candidate = getCandidateById(iv.candidate_id, orgId);
      const assignment = getActiveAssignment(orgId, iv.candidate_id, iv.job_id);
      return {
        interview: iv,
        candidateName: candidate?.name || candidate?.email || "—",
        recruiterName: assignment ? getUserById(assignment.assigned_recruiter_id)?.name ?? "Unassigned" : "Unassigned",
      };
    });

  const loadMap = new Map<string, number>();
  for (const t of openTasks) loadMap.set(t.assigned_recruiter_id, (loadMap.get(t.assigned_recruiter_id) ?? 0) + 1);
  const recruiterLoad = [...loadMap.entries()]
    .map(([recruiterId, open]) => ({
      recruiterId,
      recruiterName: recruiterId ? getUserById(recruiterId)?.name ?? "Unassigned" : "Unassigned",
      open,
    }))
    .sort((a, b) => b.open - a.open);

  return { overdue, escalated, interviewsSoonNoCheckin, recruiterLoad, totalOpen: openTasks.length };
}
