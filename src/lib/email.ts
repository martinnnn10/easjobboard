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

export async function sendApplicationEmail(input: ApplicationEmailInput): Promise<void> {
  const smtp = getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

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
