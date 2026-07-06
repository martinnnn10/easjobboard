import nodemailer from "nodemailer";
import { getPlatformName, getSmtpConfig } from "./env";
import type { Job, Organization } from "./db";

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

/**
 * Team invite: emails a teammate a link to join the organization. Best-effort —
 * the admin also gets a copyable link in the UI in case email is slow/unreachable.
 */
export async function sendInviteEmail(input: {
  organization: Organization;
  toEmail: string;
  inviterName: string;
  inviteUrl: string;
}): Promise<void> {
  const { smtp, transporter } = createTransport();
  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: input.toEmail,
    subject: `${input.inviterName || input.organization.name} invited you to ${input.organization.name} on ${getPlatformName()}`,
    text: [
      `${input.inviterName || "A teammate"} invited you to join ${input.organization.name} on ${getPlatformName()}.`,
      "",
      "Accept your invitation and set up your account here:",
      input.inviteUrl,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
  });
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
