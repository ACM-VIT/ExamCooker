export type AiTextProvider = "openai" | "anthropic";
export type AiTextTask =
  | "commandIntent"
  | "moderation"
  | "contentCorrection"
  | "pastPaperTitle"
  | "pdfMarkdown"
  | "voiceDocument";

// OpenAI Live delegates through OpenAI Responses and cannot use a text provider.
export const VOICE_MODEL = "gpt-live-1";
export const VOICE_BACKEND_MODEL = "gpt-6-luna";
export const DEFAULT_COMMAND_EMBEDDING_MODEL = "text-embedding-3-small";

export function getCommandEmbeddingModel(env: object) {
  const variables = env as { OPENAI_EMBEDDING_MODEL?: string };
  return variables.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_COMMAND_EMBEDDING_MODEL;
}

type ModelEnvironment = {
  AI_PROVIDER?: string;
  AI_COMMAND_MODEL?: string;
  AI_MODERATION_MODEL?: string;
  AI_CONTENT_CORRECTION_MODEL?: string;
  AI_PAST_PAPER_TITLE_MODEL?: string;
  AI_PDF_MARKDOWN_MODEL?: string;
  AI_VOICE_DOCUMENT_MODEL?: string;
  OPENAI_COMMAND_MODEL?: string;
  OPENAI_PDF_QA_MODEL?: string;
};

const TASK_MODELS: Record<AiTextTask, {
  environmentKey: keyof ModelEnvironment;
  openai: string;
  anthropic: string;
}> = {
  commandIntent: {
    environmentKey: "AI_COMMAND_MODEL",
    openai: "gpt-6-luna",
    anthropic: "claude-haiku-5-5",
  },
  moderation: {
    environmentKey: "AI_MODERATION_MODEL",
    openai: "gpt-6-luna",
    anthropic: "claude-sonnet-5-5",
  },
  contentCorrection: {
    environmentKey: "AI_CONTENT_CORRECTION_MODEL",
    openai: "gpt-6-luna",
    anthropic: "claude-sonnet-5-5",
  },
  pastPaperTitle: {
    environmentKey: "AI_PAST_PAPER_TITLE_MODEL",
    openai: "gpt-6-luna",
    anthropic: "claude-haiku-5-5",
  },
  pdfMarkdown: {
    environmentKey: "AI_PDF_MARKDOWN_MODEL",
    openai: "gpt-6-luna",
    anthropic: "claude-sonnet-5-5",
  },
  voiceDocument: {
    environmentKey: "AI_VOICE_DOCUMENT_MODEL",
    openai: "gpt-6-luna",
    anthropic: "claude-sonnet-5-5",
  },
};

export type AiModelSelection = {
  provider: string;
  modelId: string;
  qualifiedModelId: string;
};

export function resolveAiTextModel(
  task: AiTextTask,
  env: object,
): AiModelSelection {
  const variables = env as ModelEnvironment;
  const configuredProvider = variables.AI_PROVIDER?.trim() || "openai";
  if (configuredProvider !== "openai" && configuredProvider !== "anthropic") {
    throw new Error(`Unsupported AI_PROVIDER: ${configuredProvider}`);
  }

  const config = TASK_MODELS[task];
  const legacyModel = configuredProvider === "openai"
    ? task === "commandIntent"
      ? variables.OPENAI_COMMAND_MODEL
      : task === "voiceDocument"
        ? variables.OPENAI_PDF_QA_MODEL
        : undefined
    : undefined;
  const configuredModel = variables[config.environmentKey]?.trim() || legacyModel?.trim();
  const defaultModel = config[configuredProvider];
  const selected = configuredModel || defaultModel;
  const separator = selected.indexOf("/");
  const provider = separator === -1 ? configuredProvider : selected.slice(0, separator);
  const modelId = separator === -1 ? selected : selected.slice(separator + 1);

  if (!provider || !modelId) {
    throw new Error(`Invalid ${config.environmentKey}: ${selected}`);
  }

  return {
    provider,
    modelId,
    qualifiedModelId: `${provider}/${modelId}`,
  };
}
