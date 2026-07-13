import nodemailer from "nodemailer";
import { getPlatformEmail, getPlatformName, getSmtpConfig } from "./env";
import type { Job, Organization } from "./db";

/** True when SMTP is fully configured (so best-effort notifications can send). */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Notify the platform team of an inbound "Book a demo" request. Best-effort. */
export async function sendDemoRequestNotification(input: {
  name: string;
  email: string;
  company: string;
  role: string;
  challenge: string;
  notes: string;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  const { smtp, transporter } = createTransport();
  await transporter.sendMail({
    from: `"${getPlatformName()}" <${smtp.fromEmail}>`,
    to: getPlatformEmail(),
    replyTo: input.email,
    subject: `New demo request — ${input.company || input.name}`,
    text: [
      `Name: ${input.name}`,
      `Work email: ${input.email}`,
      `Company: ${input.company || "—"}`,
      `Role: ${input.role || "—"}`,
      `Hiring challenge: ${input.challenge || "—"}`,
      `Preferred time / notes: ${input.notes || "—"}`,
    ].join("\n"),
  });
}

type ApplicationEmailInput = {
  organization: Organization;
  job: Job;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  coverLetter: string;
  resume: {
    filename: string;
    content: Buffer;
    contentType: string;
  };
};

function createTransport() {
  const smtp = getSmtpConfig();
  return {
    smtp,
    transporter: nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    }),
  };
}

export async function sendApplicationEmail(input: ApplicationEmailInput): Promise<void> {
  const { smtp, transporter } = createTransport();

  const subject = `[${input.organization.name}] Application: ${input.job.title} — ${input.applicantName}`;

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: input.organization.application_email,
    replyTo: input.applicantEmail,
    subject,
    text: [
      `New application via ${getPlatformName()}`,
      `Organization: ${input.organization.name}`,
      `Job: ${input.job.title}`,
      `Reference: ${input.job.reference_number}`,
      `Location: ${input.job.location}`,
      "",
      `Name: ${input.applicantName}`,
      `Email: ${input.applicantEmail}`,
      `Phone: ${input.applicantPhone || "Not provided"}`,
      "",
      "Cover letter:",
      input.coverLetter || "(none)",
    ].join("\n"),
    attachments: [
      {
        filename: input.resume.filename,
        content: input.resume.content,
        contentType: input.resume.contentType,
      },
    ],
  });
}

/**
 * Recruiter-composed email to a candidate, sent from the platform on behalf of
 * the organization. Replies go to the org's hiring inbox.
 */
export async function sendCandidateEmail(input: {
  organization: Organization;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const { smtp, transporter } = createTransport();

  await transporter.sendMail({
    from: `"${input.organization.name}" <${smtp.fromEmail}>`,
    to: input.to,
    replyTo: input.organization.application_email,
    subject: input.subject,
    text: input.body,
  });
}

/**
 * Skills-screen invitation to a candidate: a short, respectful ask with the
 * secure link. Sent from the org; replies route to the org's hiring inbox.
 */
export async function sendScreenInviteEmail(input: {
  organization: Organization;
  to: string;
  candidateName: string;
  jobTitle: string;
  link: string;
  message?: string;
}): Promise<void> {
  const { smtp, transporter } = createTransport();
  const firstName = input.candidateName.split(/\s+/)[0] || "there";
  const roleSuffix = input.jobTitle ? ` for ${input.jobTitle}` : "";

  await transporter.sendMail({
    from: `"${input.organization.name}" <${smtp.fromEmail}>`,
    to: input.to,
    replyTo: input.organization.application_email,
    subject: `Complete your ${getPlatformName()} skills screen${input.jobTitle ? ` for ${input.jobTitle}` : ""}`,
    text: [
      `Hi ${firstName},`,
      "",
      `This short screen helps show your real-world skills${roleSuffix}. It should only take a few minutes.`,
      input.message ? "" : null,
      input.message || null,
      "",
      `Complete it here: ${input.link}`,
      "",
      `— ${input.organization.name}`,
    ]
      .filter((line) => line !== null)
      .join("\n"),
  });
}

/**
 * Invite email for a newly added teammate: their sign-in link + temporary
 * password. Sent from the org; replies route to the org's hiring inbox.
 */
export async function sendTeamInviteEmail(input: {
  organization: Organization;
  to: string;
  name: string;
  tempPassword: string;
  loginUrl: string;
  inviterName: string;
}): Promise<void> {
  const { smtp, transporter } = createTransport();
  const firstName = input.name.split(/\s+/)[0] || "there";

  await transporter.sendMail({
    from: `"${input.organization.name}" <${smtp.fromEmail}>`,
    to: input.to,
    replyTo: input.organization.application_email,
    subject: `You've been added to ${input.organization.name} on ${getPlatformName()}`,
    text: [
      `Hi ${firstName},`,
      "",
      `${input.inviterName} added you to ${input.organization.name} on ${getPlatformName()}.`,
      "",
      `Sign in here: ${input.loginUrl}`,
      `Email: ${input.to}`,
      `Temporary password: ${input.tempPassword}`,
      "",
      "Keep this password private. You can sign in with it right away.",
      "",
      `— ${input.organization.name}`,
    ].join("\n"),
  });
}

/**
 * Escalation to the owner/director when a required Candidate Care follow-up
 * wasn't confirmed within the SLA window.
 */
export async function sendCareEscalationEmail(input: {
  organization: Organization;
  to: string[];
  candidateName: string;
  jobTitle: string;
  interviewWhen: string;
  recruiterName: string;
  taskLabel: string;
  dueAt: string;
  profileUrl: string;
  careUrl: string;
}): Promise<void> {
  const { smtp, transporter } = createTransport();
  const dueLocal = (() => {
    const t = Date.parse(input.dueAt);
    return Number.isFinite(t) ? new Date(t).toLocaleString() : input.dueAt;
  })();

  await transporter.sendMail({
    from: `"${input.organization.name}" <${smtp.fromEmail}>`,
    to: input.to.join(", "),
    replyTo: input.organization.application_email,
    subject: `Candidate Care overdue: ${input.candidateName}${input.jobTitle ? ` — ${input.jobTitle}` : ""}`,
    text: [
      "A required Candidate Care follow-up wasn't confirmed within the SLA window.",
      "",
      `Candidate: ${input.candidateName}`,
      input.jobTitle ? `Job req: ${input.jobTitle}` : "",
      input.interviewWhen ? `Interview: ${input.interviewWhen}` : "",
      `Assigned recruiter: ${input.recruiterName}`,
      `Missed task: ${input.taskLabel}`,
      `Due: ${dueLocal}`,
      "",
      `Candidate profile: ${input.profileUrl}`,
      `Candidate Care queue: ${input.careUrl}`,
      "",
      `— ${getPlatformName()}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

type ConfirmationEmailInput = {
  organization: Organization;
  job: Job;
  applicantName: string;
  applicantEmail: string;
};

/**
 * Confirmation sent to the candidate so their experience doesn't dead-end at
 * "submitted". Replies route to the org's hiring inbox.
 */
export async function sendApplicantConfirmationEmail(input: ConfirmationEmailInput): Promise<void> {
  const { smtp, transporter } = createTransport();
  const firstName = input.applicantName.split(/\s+/)[0] || "there";

  await transporter.sendMail({
    from: `"${input.organization.name}" <${smtp.fromEmail}>`,
    to: input.applicantEmail,
    replyTo: input.organization.application_email,
    subject: `We received your application — ${input.job.title}`,
    text: [
      `Hi ${firstName},`,
      "",
      `Thanks for applying for ${input.job.title} at ${input.organization.name}. We've received your application and the hiring team will review it.`,
      "",
      "If your background is a match, someone will be in touch about next steps. You can reply to this email if you have any questions.",
      "",
      `— ${input.organization.name}`,
      `via ${getPlatformName()}`,
    ].join("\n"),
  });
}
