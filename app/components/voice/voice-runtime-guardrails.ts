"use client";

import type { RealtimeOutputGuardrail } from "@openai/agents/realtime";
import type { ZodError } from "zod";
import type { VoiceTool } from "./voice-runtime-types";

type ToolGuardrailOutput =
  | {
      behavior: {
        type: "allow";
      };
      outputInfo?: unknown;
    }
  | {
      behavior: {
        type: "rejectContent";
        message: string;
      };
      outputInfo?: unknown;
    };

type ToolGuardrailData = {
  toolCall?: unknown;
  output?: unknown;
};

function allow(outputInfo?: unknown): ToolGuardrailOutput {
  return {
    behavior: { type: "allow" },
    ...(outputInfo !== undefined ? { outputInfo } : {}),
  };
}

function rejectContent(message: string, outputInfo?: unknown): ToolGuardrailOutput {
  return {
    behavior: {
      type: "rejectContent",
      message,
    },
    ...(outputInfo !== undefined ? { outputInfo } : {}),
  };
}

function readRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseToolCallArguments(toolCall: unknown) {
  const record = readRecord(toolCall);
  if (!record) {
    return {};
  }

  const rawArguments =
    record.arguments ?? record.args ?? record.input ?? record.parsedArguments;
  if (typeof rawArguments === "string") {
    if (!rawArguments.trim()) {
      return {};
    }

    try {
      return JSON.parse(rawArguments) as unknown;
    } catch {
      return rawArguments;
    }
  }

  return rawArguments ?? {};
}

function formatZodError(error: ZodError) {
  const issue = error.issues[0];
  if (!issue) {
    return "Tool input did not match its schema.";
  }

  const path = issue.path.length > 0 ? issue.path.join(".") : "input";
  return `Tool input is invalid at ${path}: ${issue.message}`;
}

function validateToolPolicy(toolName: string, args: unknown) {
  const record = readRecord(args);

  switch (toolName) {
    case "navigate_to_path": {
      const path = typeof record?.path === "string" ? record.path.trim() : "";
      if (!path.startsWith("/")) {
        return 'Use an internal ExamCooker path that starts with "/".';
      }
      if (path.startsWith("/api")) {
        return "API routes are not navigable website pages.";
      }
      return null;
    }
    case "activate_control":
    case "fill_input":
      return typeof record?.controlId === "string" && record.controlId.trim()
        ? null
        : "Inspect the current view and use a visible control ID before calling this tool.";
    case "go_to_pdf_page":
      return typeof record?.page === "number" && Number.isInteger(record.page) && record.page >= 1
        ? null
        : "PDF page numbers must be positive whole numbers.";
    case "answer_question_about_open_pdf":
      return typeof record?.question === "string" && record.question.trim()
        ? null
        : "Ask a concrete PDF question before using the PDF answer tool.";
    default:
      return null;
  }
}

function approximateOutputSize(output: unknown) {
  if (typeof output === "string") {
    return output.length;
  }

  try {
    return JSON.stringify(output).length;
  } catch {
    return 0;
  }
}

function readAgentOutputText(agentOutput: unknown) {
  if (typeof agentOutput === "string") {
    return agentOutput;
  }

  const record = readRecord(agentOutput);
  if (!record) {
    return "";
  }

  const value = record.text ?? record.output ?? record.finalOutput;
  return typeof value === "string" ? value : "";
}

function countSentences(text: string) {
  return text.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
}

export function parseVoiceToolInput<TArgs>(
  voiceTool: VoiceTool<TArgs>,
  input: unknown,
): TArgs {
  return voiceTool.parameters.parse(input);
}

export function createVoiceToolInputGuardrail<TArgs>(voiceTool: VoiceTool<TArgs>) {
  return {
    name: `${voiceTool.name}_input_policy`,
    run: async (data: ToolGuardrailData): Promise<ToolGuardrailOutput> => {
      const args = parseToolCallArguments(data.toolCall);
      const parsed = voiceTool.parameters.safeParse(args);
      if (!parsed.success) {
        return rejectContent(formatZodError(parsed.error), {
          toolName: voiceTool.name,
        });
      }

      const policyMessage = validateToolPolicy(voiceTool.name, parsed.data);
      if (policyMessage) {
        return rejectContent(policyMessage, {
          toolName: voiceTool.name,
        });
      }

      return allow({
        toolName: voiceTool.name,
      });
    },
  };
}

export const voiceToolOutputGuardrail = {
  name: "voice_tool_output_policy",
  run: async (data: ToolGuardrailData): Promise<ToolGuardrailOutput> => {
    const outputSize = approximateOutputSize(data.output);
    if (outputSize > 12000) {
      return rejectContent("The tool returned too much data. Inspect the page again and summarize only what is needed.", {
        outputSize,
      });
    }

    return allow({
      outputSize,
    });
  },
};

export const conciseVoiceOutputGuardrail: RealtimeOutputGuardrail = {
  name: "examcooker_voice_concise_output",
  policyHint:
    "Keep spoken replies brief. For navigation and UI actions, use at most 10 words. For PDF answers, use 1-3 short sentences.",
  execute: async ({ agentOutput }) => {
    const text = readAgentOutputText(agentOutput);
    const trimmed = text.trim();
    const sentenceCount = countSentences(trimmed);
    const tripwireTriggered =
      trimmed.length > 900 || (sentenceCount > 5 && trimmed.length > 360);

    return {
      tripwireTriggered,
      outputInfo: {
        charCount: trimmed.length,
        sentenceCount,
      },
    };
  },
};

export const DEFAULT_VOICE_OUTPUT_GUARDRAILS = [
  conciseVoiceOutputGuardrail,
] satisfies RealtimeOutputGuardrail[];
