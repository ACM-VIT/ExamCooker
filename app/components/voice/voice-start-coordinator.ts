type VoiceSetupFeature = "voiceDocument" | "voice";

// A start attempt is pending from the click until connect() settles: first
// while AI keys are checked (which can open a dialog), then while the runtime
// connects. Cancelling releases the slot; a superseded attempt never connects
// or reports, and only the current attempt may clear the slot.
export function createVoiceStartCoordinator(options: {
  ensureAiReady: (feature: VoiceSetupFeature) => Promise<boolean>;
  connect: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  let activeAttempt: number | null = null;
  let nextAttempt = 0;
  const listeners = new Set<() => void>();
  const setActiveAttempt = (attempt: number | null) => {
    if (activeAttempt === attempt) return;
    activeAttempt = attempt;
    listeners.forEach((listener) => listener());
  };

  return {
    isPending: () => activeAttempt !== null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancel: () => setActiveAttempt(null),
    // Resolves true when this attempt reached connect() and was not superseded.
    async start(): Promise<boolean> {
      if (activeAttempt !== null) return false;
      const attempt = ++nextAttempt;
      setActiveAttempt(attempt);
      try {
        if (!await options.ensureAiReady("voiceDocument") || activeAttempt !== attempt) return false;
        if (!await options.ensureAiReady("voice") || activeAttempt !== attempt) return false;
        await options.connect();
        return activeAttempt === attempt;
      } catch (error) {
        if (activeAttempt === attempt) options.onError(error);
        return false;
      } finally {
        if (activeAttempt === attempt) setActiveAttempt(null);
      }
    },
  };
}
