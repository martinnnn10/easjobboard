import type { ResumeKind } from "./file-validation";

/**
 * Best-effort plain-text extraction from an uploaded resume.
 *
 * Returns "" when the format is unsupported (legacy .doc) or extraction fails —
 * callers treat empty text as "unparseable" and skip scoring rather than error.
 * Kept isolated so the heavy PDF/DOCX libraries are only loaded on demand.
 */
export async function extractResumeText(buffer: Buffer, kind: ResumeKind): Promise<string> {
  try {
    if (kind === "pdf") return await extractPdfText(buffer);
    if (kind === "docx") return await extractDocxText(buffer);
    // Legacy binary .doc is not supported by our extractors.
    return "";
  } catch (error) {
    console.error("Resume text extraction failed:", error);
    return "";
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return normalize(result.text ?? "");
  } finally {
    // Release the worker/document resources if the library exposes a cleanup.
    await parser.destroy?.();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalize(result.value ?? "");
}

/**
 * Strips pdf-parse page markers ("-- 1 of 3 --") and collapses whitespace so
 * downstream keyword matching sees clean text.
 */
function normalize(text: string): string {
  return text
    .replace(/^--\s*\d+\s*of\s*\d+\s*--$/gim, " ")
    .replace(/\s+/g, " ")
    .trim();
}
