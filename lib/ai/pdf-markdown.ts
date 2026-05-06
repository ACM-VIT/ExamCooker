import { z } from "zod";

const DEFAULT_PDF_MARKDOWN_MODEL = "openai/gpt-5.4-nano";

const NullableTextSchema = z.string().trim().nullable();

export const PdfPaperQuestionSchema = z.object({
  number: z.string().trim().describe("Question number exactly as shown."),
  text: z.string().trim().describe(
    "Complete question text in Markdown. Preserve subparts, options, equations, diagrams described in text, and tables that are part of the question. Use valid LaTeX in $...$ or $$...$$ for math.",
  ),
  marks: NullableTextSchema.describe(
    "Marks for this question from the paper, or null when not shown.",
  ),
});

export type PdfPaperQuestion = z.infer<typeof PdfPaperQuestionSchema>;

export const PdfPaperDocumentSchema = z.object({
  schemaVersion: z.literal("exam-questions-v1"),
  questions: z.array(PdfPaperQuestionSchema).describe(
    "Only the exam questions in reading order. Do not include metadata, instructions, CO values, or Bloom taxonomy values.",
  ),
});

export type PdfPaperDocument = z.infer<typeof PdfPaperDocumentSchema>;

export function getPdfMarkdownModel() {
  return process.env.AI_PDF_MARKDOWN_MODEL?.trim() || DEFAULT_PDF_MARKDOWN_MODEL;
}

export function buildPdfPaperMarkdown(paper: PdfPaperDocument) {
  const lines: string[] = ["# Questions", ""];

  for (const question of paper.questions) {
    const marks = question.marks?.trim();
    lines.push(
      `## ${question.number}${marks ? ` (${marks} marks)` : ""}`,
      "",
      question.text,
      "",
    );
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
