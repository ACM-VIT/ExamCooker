"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGuestPrompt } from "@/app/components/auth-gate";
import type { VoiceAgentEntryPoint } from "@/lib/posthog/client";
import VoiceAgentButton from "./voice-agent-button";
import VoiceAgentProvider, { useVoiceAgent } from "./voice-agent-provider";

function ConnectedVoiceAgentButton({
  children,
  className,
  iconClassName,
  startToken,
}: {
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
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
      className={className}
      iconClassName={iconClassName}
      runtime={runtime}
      onClick={handleClick}
      variant="nav"
    >
      {children}
    </VoiceAgentButton>
  );
}

export default function VoiceAgentEntry({
  children,
  className,
  entryPoint,
  iconClassName,
  startToken,
}: {
  children?: React.ReactNode;
  className?: string;
  entryPoint: VoiceAgentEntryPoint;
  iconClassName?: string;
  startToken: number;
}) {
  return (
    <VoiceAgentProvider entryPoint={entryPoint}>
      <ConnectedVoiceAgentButton
        className={className}
        iconClassName={iconClassName}
        startToken={startToken}
      >
        {children}
      </ConnectedVoiceAgentButton>
    </VoiceAgentProvider>
  );
}
