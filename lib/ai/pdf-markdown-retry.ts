export class AiSetupRequiredError extends Error {
  constructor() {
    super("Add an AI provider key to convert this PDF.");
  }
}

export async function requestPdfMarkdownWithSetup<T>(
  request: () => Promise<T>,
  ensureAiReady: () => Promise<boolean>,
  signal: AbortSignal,
): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof AiSetupRequiredError) || signal.aborted) throw error;
    if (!await ensureAiReady() || signal.aborted) return null;
    return request();
  }
}
