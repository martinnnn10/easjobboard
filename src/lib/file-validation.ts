/**
 * Content-based (magic byte) validation for uploaded resumes.
 *
 * The apply route already checks the client-supplied MIME type, but that value
 * is trivially spoofable. This inspects the actual file header so a renamed
 * executable or script cannot be stored as a "resume".
 */

export type ResumeKind = "pdf" | "doc" | "docx";

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Returns the detected resume kind, or null if the bytes do not match an
 * allowed format. DOCX is a ZIP container (PK\x03\x04); legacy DOC is an OLE2
 * compound file (D0 CF 11 E0); PDF starts with "%PDF".
 */
export function detectResumeKind(buffer: Buffer): ResumeKind | null {
  const bytes = new Uint8Array(buffer.subarray(0, 8));

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc"; // OLE2
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "docx"; // ZIP (PK\x03\x04)
  if (startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return "docx"; // empty ZIP
  if (startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])) return "docx"; // spanned ZIP

  return null;
}

// Control chars (U+0000–U+001F), double-quote, and backslash. Built via RegExp
// from \u escapes so the source stays plain ASCII (no literal control bytes).
const UNSAFE_FILENAME_CHARS = new RegExp('[\\u0000-\\u001f"\\\\]', "g");

/**
 * Strips characters that could break out of a Content-Disposition header
 * (quotes, control chars, path separators) and falls back to a safe default.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "_")
    .replace(UNSAFE_FILENAME_CHARS, "")
    .trim();
  return cleaned || "resume";
}
