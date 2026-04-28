"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGuestPrompt } from "@/app/components/GuestPromptProvider";
import VoiceAgentButton from "./VoiceAgentButton";
import VoiceAgentProvider, { useVoiceAgent } from "./VoiceAgentProvider";

function ConnectedVoiceAgentButton({
  startToken,
}: {
  startToken: number;
}) {
  const { isAuthed, requireAuth } = useGuestPrompt();
  const { buttonLabel, runtime, toggleVoiceAgent } = useVoiceAgent();
  const lastAutoStartTokenRef = useRef(0);

  const handleClick = useCallback(() => {
    if (!isAuthed) {
      requireAuth("use the voice guide");
      return;
    }

    toggleVoiceAgent();
  }, [isAuthed, requireAuth, toggleVoiceAgent]);

  useEffect(() => {
    if (!isAuthed || startToken <= lastAutoStartTokenRef.current) {
      return;
    }

    lastAutoStartTokenRef.current = startToken;

    if (!runtime.connected && runtime.activity !== "connecting") {
      toggleVoiceAgent();
    }
  }, [isAuthed, runtime.activity, runtime.connected, startToken, toggleVoiceAgent]);

  return (
    <VoiceAgentButton
      buttonLabel={buttonLabel}
      runtime={runtime}
      onClick={handleClick}
    />
  );
}

export default function VoiceAgentEntry({
  startToken,
}: {
  startToken: number;
}) {
  return (
    <VoiceAgentProvider>
      <ConnectedVoiceAgentButton startToken={startToken} />
    </VoiceAgentProvider>
  );
}
