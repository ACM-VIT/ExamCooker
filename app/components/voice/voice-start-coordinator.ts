type VoiceSetupFeature = "voiceDocument" | "voice";

export function createVoiceStartCoordinator(options: {
  ensureAiReady: (feature: VoiceSetupFeature) => Promise<boolean>;
  connect: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  let activeAttempt: number | null = null;
  let nextAttempt = 0;

  return {
    isPending: () => activeAttempt !== null,
    cancel: () => { activeAttempt = null; },
    async start(): Promise<boolean> {
      if (activeAttempt !== null) return false;
      const attempt = ++nextAttempt;
      activeAttempt = attempt;
      try {
        if (!await options.ensureAiReady("voiceDocument") || activeAttempt !== attempt) return false;
        if (!await options.ensureAiReady("voice") || activeAttempt !== attempt) return false;
        await options.connect();
        return activeAttempt === attempt;
      } catch (error) {
        if (activeAttempt === attempt) options.onError(error);
        return false;
      } finally {
        if (activeAttempt === attempt) activeAttempt = null;
      }
    },
  };
}
