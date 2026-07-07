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
  // pdf-parse v1's bundled pdf.js runs headless in Node. (v2 pulls in
  // pdfjs-dist, which references browser globals like DOMMatrix and throws in
  // the standalone/production Node runtime.) Import the internal lib entry to
  // skip the package's index.js debug self-test, which reads a sample file on
  // import. Dynamic import keeps the heavy library out of the initial bundle.
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = mod.default;
  const result = await pdfParse(buffer);
  return normalize(result.text ?? "");
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
