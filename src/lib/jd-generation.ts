import { completeText, isLlmConfigured } from "./anthropic";
import { matchTemplateByTitle } from "./jd-templates";

export type GeneratedDescription = {
  description: string;
  source: "llm" | "template" | "none";
};

/**
 * Generates a job description for a title. Uses Claude when ANTHROPIC_API_KEY is
 * configured; otherwise falls back to the closest offline template, and finally
 * to nothing. Server-only (imports the Anthropic client).
 */
export async function generateJobDescription(params: {
  title: string;
  notes?: string;
  location?: string;
  companyName?: string;
}): Promise<GeneratedDescription> {
  const title = params.title.trim();
  if (!title) return { description: "", source: "none" };

  if (isLlmConfigured()) {
    try {
      const description = await completeText({
        system:
          "You write complete, compelling, inclusive job postings. Structure: a warm 2-3 sentence intro that sells " +
          "the role, then 'Responsibilities:' with 5-7 bullets, 'Requirements:' with 4-6 bullets, and 'What we offer:' " +
          "with 3-4 realistic benefits (growth, stability, team — never invent specific salary, PTO days, or insurance " +
          "details). Plain text with '- ' bullets, no markdown headers or bold. Specific and credible, not fluffy.",
        prompt: [
          `Write a job description for: ${title}`,
          params.companyName ? `Company: ${params.companyName}` : "",
          params.location ? `Location: ${params.location}` : "",
          params.notes ? `Extra context from the hiring manager: ${params.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        maxTokens: 1200,
      });
      if (description.trim()) return { description: description.trim(), source: "llm" };
    } catch (error) {
      console.error("LLM JD generation failed, using template:", error);
    }
  }

  const template = matchTemplateByTitle(title);
  if (template) return { description: template.description, source: "template" };
  return { description: "", source: "none" };
}
