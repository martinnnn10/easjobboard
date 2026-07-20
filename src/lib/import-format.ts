/**
 * Candidate Import Center — format definitions shared by the client wizard and
 * the server importer. Kept free of any database/server imports (like
 * candidate-meta) so the client bundle stays clean.
 *
 * This sprint supports CSV / manual-export import ONLY. There are no native
 * API integrations, no scraping, and no stored third-party credentials. Every
 * "source" below is a file the recruiter exports from that platform.
 */
import type { CandidateSource } from "./candidate-meta";

export type ImportPlatformKind = "jobboard" | "ats" | "custom";

export type ImportPlatform = {
  key: string;
  label: string;
  kind: ImportPlatformKind;
  /** Candidate `source` enum value stored on each imported candidate. */
  source: CandidateSource;
  /** Short helper copy shown on the upload step. No "Connect X" claims. */
  guidance: string;
};

/**
 * Supported export sources. All are CSV/manual exports the user downloads from
 * the platform — never a live/API connection.
 */
export const IMPORT_PLATFORMS: ImportPlatform[] = [
  { key: "indeed", label: "Indeed Employer", kind: "jobboard", source: "indeed",
    guidance: "Export candidates from Indeed Employer, then upload the CSV here. EAS Recruit will map the file, dedupe candidates, and let you attach them to jobs or send skills screens." },
  { key: "linkedin", label: "LinkedIn", kind: "jobboard", source: "linkedin",
    guidance: "Export or build a CSV of your LinkedIn candidates, then upload it here. We never log in to LinkedIn or scrape it — this is a file you provide." },
  { key: "ziprecruiter", label: "ZipRecruiter", kind: "jobboard", source: "ziprecruiter",
    guidance: "Export your ZipRecruiter candidates as CSV, then upload the file here." },
  { key: "loxo", label: "Loxo", kind: "ats", source: "imported",
    guidance: "Export candidates from Loxo as CSV, then upload the file here." },
  { key: "manatal", label: "Manatal", kind: "ats", source: "imported",
    guidance: "Export candidates from Manatal as CSV, then upload the file here." },
  { key: "greenhouse", label: "Greenhouse", kind: "ats", source: "imported",
    guidance: "Export candidates from Greenhouse as CSV, then upload the file here." },
  { key: "lever", label: "Lever", kind: "ats", source: "imported",
    guidance: "Export candidates from Lever as CSV, then upload the file here." },
  { key: "workable", label: "Workable", kind: "ats", source: "imported",
    guidance: "Export candidates from Workable as CSV, then upload the file here." },
  { key: "icims", label: "iCIMS", kind: "ats", source: "imported",
    guidance: "Export candidates from iCIMS as CSV, then upload the file here." },
  { key: "other_ats", label: "Other ATS", kind: "ats", source: "imported",
    guidance: "Export candidates from your ATS as CSV, then upload the file here." },
  { key: "custom", label: "Custom CSV", kind: "custom", source: "imported",
    guidance: "Upload any CSV or use our template. Map your columns to EAS fields on the next step." },
];

export function getImportPlatform(key: string): ImportPlatform | undefined {
  return IMPORT_PLATFORMS.find((p) => p.key === key);
}

/** EAS candidate fields an import can populate. `key` matches the CSV template. */
export type EasImportField = {
  key: string;
  label: string;
  /** Part of the "must have name/first-last AND (email or phone)" minimum. */
  contact?: "name" | "first" | "last" | "email" | "phone";
};

export const EAS_IMPORT_FIELDS: EasImportField[] = [
  { key: "first_name", label: "First name", contact: "first" },
  { key: "last_name", label: "Last name", contact: "last" },
  { key: "email", label: "Email", contact: "email" },
  { key: "phone", label: "Phone", contact: "phone" },
  { key: "location", label: "Location" },
  { key: "current_title", label: "Current title" },
  { key: "current_company", label: "Current company" },
  { key: "source", label: "Source" },
  { key: "job_title", label: "Job title" },
  { key: "job_reference", label: "Job reference" },
  { key: "resume_filename", label: "Resume filename" },
  { key: "notes", label: "Notes" },
  { key: "desired_pay", label: "Desired pay" },
  { key: "shift_preference", label: "Shift preference" },
  { key: "relocation", label: "Relocation" },
  { key: "tags", label: "Tags" },
];

/** Columns (and order) of the downloadable CSV template. */
export const TEMPLATE_COLUMNS = EAS_IMPORT_FIELDS.map((f) => f.key);

/** Common header aliases → EAS field key, for auto-mapping an uploaded file. */
const HEADER_ALIASES: Record<string, string> = {
  "first name": "first_name", firstname: "first_name", "given name": "first_name", fname: "first_name",
  "last name": "last_name", lastname: "last_name", surname: "last_name", "family name": "last_name", lname: "last_name",
  name: "first_name", "full name": "first_name", "candidate name": "first_name", "contact name": "first_name",
  email: "email", "email address": "email", "e-mail": "email", "work email": "email",
  phone: "phone", "phone number": "phone", mobile: "phone", "mobile phone": "phone", "cell": "phone", telephone: "phone",
  location: "location", city: "location", "city, state": "location", address: "location", region: "location",
  title: "current_title", "current title": "current_title", "job title": "job_title", headline: "current_title", position: "current_title",
  company: "current_company", "current company": "current_company", employer: "current_company", organization: "current_company",
  source: "source", channel: "source",
  "job reference": "job_reference", "req id": "job_reference", requisition: "job_reference", "job req": "job_reference",
  resume: "resume_filename", "resume filename": "resume_filename", cv: "resume_filename", "resume file": "resume_filename",
  notes: "notes", note: "notes", comments: "notes",
  "desired pay": "desired_pay", "salary expectation": "desired_pay", "pay": "desired_pay", "desired salary": "desired_pay",
  "shift": "shift_preference", "shift preference": "shift_preference",
  relocation: "relocation", relocate: "relocation",
  tags: "tags", labels: "tags", skills: "tags",
};

/** Best-guess mapping of uploaded headers → EAS field keys. */
export function autoDetectMapping(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const norm = h.trim().toLowerCase();
    const direct = EAS_IMPORT_FIELDS.find((f) => f.key === norm.replace(/\s+/g, "_"));
    const guess = direct?.key ?? HEADER_ALIASES[norm];
    // Don't map two columns to "first_name" just because both look like a name.
    if (guess && !(guess === "first_name" && used.has("first_name"))) {
      mapping[i] = guess;
      used.add(guess);
    }
  });
  return mapping;
}

/**
 * Minimal, dependency-free CSV parser (RFC-4180-ish): handles quoted fields,
 * escaped quotes (""), commas and newlines inside quotes, and CRLF. Good enough
 * for the ATS/job-board exports this Import Center accepts.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM if present.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      // Skip fully blank lines.
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}
