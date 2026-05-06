import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const DEFAULT_PDF_MARKDOWN_MODEL = "gpt-5.4-mini";

function normalizeOpenAiModelId(modelId: string) {
  return modelId.replace(/^openai\//, "");
}

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

export function getPdfMarkdownLanguageModel() {
  const modelId = getPdfMarkdownModel();

  const isOpenAiModel = !modelId.includes("/") || modelId.startsWith("openai/");
  if (isOpenAiModel && process.env.OPENAI_API_KEY?.trim()) {
    return openai.responses(normalizeOpenAiModelId(modelId));
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    return modelId.includes("/") ? modelId : `openai/${modelId}`;
  }

  return openai.responses(normalizeOpenAiModelId(modelId));
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
