/**
 * Pipeline stage definitions for candidate applications.
 *
 * Kept free of any database/server imports so both server code and client
 * components (e.g. the stage selector) can share these values without pulling
 * better-sqlite3 into the browser bundle.
 */

export type ApplicationStatus =
  | "new"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};
