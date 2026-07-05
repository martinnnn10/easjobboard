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
          "You write clear, compelling, inclusive job descriptions. Structure: a 2-3 sentence summary, " +
          "a 'Responsibilities' bulleted list, and a 'Requirements' bulleted list. Plain text with '- ' bullets, " +
          "no markdown headers or bold. Keep it realistic and specific; do not invent salary or company facts.",
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
