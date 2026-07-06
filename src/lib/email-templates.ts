import type { ApplicationStatus } from "./application-status";

/**
 * Candidate email templates, keyed to pipeline stages.
 *
 * Client-safe (no server imports): the compose panel renders previews in the
 * browser by substituting tokens, and the send API receives the final text.
 * Tokens: {{firstName}} {{candidateName}} {{jobTitle}} {{orgName}} {{recruiterName}}
 */

export type EmailTemplate = {
  id: string;
  label: string;
  /** Stage this email usually accompanies; used to offer "move & send". */
  stage: ApplicationStatus | null;
  subject: string;
  body: string;
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "screening",
    label: "Screening — request a quick call",
    stage: "screening",
    subject: "Next steps on your {{jobTitle}} application",
    body: [
      "Hi {{firstName}},",
      "",
      "Thanks for applying for the {{jobTitle}} role at {{orgName}} — your background looks like a promising fit.",
      "",
      "I'd love to set up a quick 15-minute phone call to learn more about your experience and tell you about the role. Just reply to this email with a couple of times that work for you this week.",
      "",
      "Best regards,",
      "{{recruiterName}}",
      "{{orgName}}",
    ].join("\n"),
  },
  {
    id: "interview",
    label: "Interview — send an invitation",
    stage: "interview",
    subject: "Interview invitation — {{jobTitle}} at {{orgName}}",
    body: [
      "Hi {{firstName}},",
      "",
      "Great news — we'd like to invite you to interview for the {{jobTitle}} position at {{orgName}}.",
      "",
      "Reply with a few days and times that work for you over the next week and we'll get it on the calendar. If you have any questions before then, just ask.",
      "",
      "Looking forward to meeting you,",
      "{{recruiterName}}",
      "{{orgName}}",
    ].join("\n"),
  },
  {
    id: "offer",
    label: "Offer — share the good news",
    stage: "offer",
    subject: "An offer from {{orgName}}",
    body: [
      "Hi {{firstName}},",
      "",
      "Congratulations! We're excited to extend you an offer for the {{jobTitle}} position at {{orgName}}.",
      "",
      "We'll follow up with the full details shortly. In the meantime, feel free to reply with any questions.",
      "",
      "Welcome aboard,",
      "{{recruiterName}}",
      "{{orgName}}",
    ].join("\n"),
  },
  {
    id: "rejection",
    label: "Not moving forward — decline kindly",
    stage: "rejected",
    subject: "Update on your {{jobTitle}} application",
    body: [
      "Hi {{firstName}},",
      "",
      "Thank you for taking the time to apply for the {{jobTitle}} role at {{orgName}}. After careful review, we've decided to move forward with other candidates for this position.",
      "",
      "We were impressed by your background and will keep your application on file for future openings that match your experience.",
      "",
      "We wish you the very best in your search,",
      "{{recruiterName}}",
      "{{orgName}}",
    ].join("\n"),
  },
  {
    id: "followup",
    label: "General follow-up",
    stage: null,
    subject: "Checking in — {{jobTitle}} at {{orgName}}",
    body: [
      "Hi {{firstName}},",
      "",
      "Just checking in on your application for the {{jobTitle}} role at {{orgName}}. ",
      "",
      "Best regards,",
      "{{recruiterName}}",
      "{{orgName}}",
    ].join("\n"),
  },
];

export type TemplateTokens = {
  candidateName: string;
  jobTitle: string;
  orgName: string;
  recruiterName: string;
};

export function renderTemplate(text: string, tokens: TemplateTokens): string {
  const firstName = tokens.candidateName.split(/\s+/)[0] || "there";
  return text
    .replaceAll("{{firstName}}", firstName)
    .replaceAll("{{candidateName}}", tokens.candidateName)
    .replaceAll("{{jobTitle}}", tokens.jobTitle)
    .replaceAll("{{orgName}}", tokens.orgName)
    .replaceAll("{{recruiterName}}", tokens.recruiterName);
}
