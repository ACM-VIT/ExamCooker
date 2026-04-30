"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";
import type { VoiceAgentEntryPoint } from "@/lib/posthog/client";
import VoiceAgentButton from "./VoiceAgentButton";
import VoiceAgentProvider, { useVoiceAgent } from "./VoiceAgentProvider";

function ConnectedVoiceAgentButton({
  startToken,
}: {
  startToken: number;
}) {
  const { isAuthed, requireAuth } = useGuestPrompt();
  const { buttonLabel, runtime, startVoiceAgent, toggleVoiceAgent } = useVoiceAgent();
  const lastStartedTokenRef = useRef(0);

  const handleClick = useCallback(() => {
    if (!isAuthed) {
      requireAuth("use the voice guide");
      return;
    }

    toggleVoiceAgent();
  }, [isAuthed, requireAuth, toggleVoiceAgent]);

  useEffect(() => {
    if (!isAuthed || startToken <= lastStartedTokenRef.current) {
      return;
    }

    // Defer the auto-start so React Strict Mode's throwaway mount can cancel the timer
    // without consuming the token before the real mounted effect runs.
    const timeout = window.setTimeout(() => {
      lastStartedTokenRef.current = startToken;
      startVoiceAgent();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isAuthed, startToken, startVoiceAgent]);

  return (
    <VoiceAgentButton
      buttonLabel={buttonLabel}
      runtime={runtime}
      onClick={handleClick}
    />
  );
}

export default function VoiceAgentEntry({
  entryPoint,
  startToken,
}: {
  entryPoint: VoiceAgentEntryPoint;
  startToken: number;
}) {
  return (
    <VoiceAgentProvider entryPoint={entryPoint}>
      <ConnectedVoiceAgentButton startToken={startToken} />
    </VoiceAgentProvider>
  );
}
