const DEFAULT_ERROR = "Voice study is unavailable. Please try again.";

// Error messages reach both the toast and telemetry. Never forward a proxy's
// HTML page or an RSC payload as a student-facing diagnostic.
export function voiceErrorMessage(value: unknown, fallback = DEFAULT_ERROR): string {
  if (typeof value !== "string") return fallback;
  const message = value.trim();
  if (
    !message ||
    message.length > 300 ||
    /<[^>]+>|_next\/|__next_f|\"\$|^\s*[\[{]/i.test(message)
  ) return fallback;
  return message;
}

export async function readVoiceSessionResponse(response: Response): Promise<{
  session: { id: string };
  transport: { type: "webrtc"; sdp: string };
}> {
  const fallback = response.redirected || response.status === 401
    ? "Sign in again, then start voice study."
    : response.status === 404 || response.status === 410
      ? "Voice study has been updated. Refresh this page, then start voice again."
      : response.status === 429
        ? "Voice study is busy. Please try again shortly."
        : DEFAULT_ERROR;
  if (response.redirected || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(fallback);
  }
  let result;
  try {
    result = await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(voiceErrorMessage(result?.error, fallback));
  if (
    typeof result?.session?.id !== "string" || !result.session.id.trim() ||
    result?.transport?.type !== "webrtc" ||
    typeof result.transport.sdp !== "string" || !result.transport.sdp.trim()
  ) {
    throw new Error("The voice service returned an invalid connection answer. Please try again.");
  }
  return result;
}
