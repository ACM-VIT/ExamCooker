"use client";

import { useCallback, useEffect } from "react";
import { useGuestPrompt } from "@/app/components/auth-gate";
import type { VoiceAgentEntryPoint } from "@/lib/posthog/client";
import VoiceAgentButton from "./voice-agent-button";
import VoiceAgentProvider, { useVoiceAgent } from "./voice-agent-provider";

function ConnectedVoiceAgentButton({
  children,
  className,
  iconClassName,
  onStartRequestHandled,
  startRequested,
}: {
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  onStartRequestHandled: () => void;
  startRequested: boolean;
}) {
  const { isAuthed, requireAuth } = useGuestPrompt();
  const { buttonLabel, runtime, startPending, startVoiceAgent, toggleVoiceAgent } =
    useVoiceAgent();

  const handleClick = useCallback(() => {
    if (!isAuthed) {
      requireAuth("use the voice guide");
      return;
    }

    toggleVoiceAgent();
  }, [isAuthed, requireAuth, toggleVoiceAgent]);

  // The request lives in the parent, so remounting this entry (for example
  // when its feature flag reloads) never starts a session nobody asked for.
  useEffect(() => {
    if (!isAuthed || !startRequested) {
      return;
    }

    // Defer the auto-start so React Strict Mode's throwaway mount can cancel the timer
    // without consuming the request before the real mounted effect runs.
    const timeout = window.setTimeout(() => {
      onStartRequestHandled();
      startVoiceAgent();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isAuthed, onStartRequestHandled, startRequested, startVoiceAgent]);

  return (
    <VoiceAgentButton
      buttonLabel={buttonLabel}
      className={className}
      disabled={runtime.activity === "closing"}
      iconClassName={iconClassName}
      pending={startPending}
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
  onStartRequestHandled,
  startRequested,
}: {
  children?: React.ReactNode;
  className?: string;
  entryPoint: VoiceAgentEntryPoint;
  iconClassName?: string;
  onStartRequestHandled: () => void;
  startRequested: boolean;
}) {
  return (
    <VoiceAgentProvider entryPoint={entryPoint}>
      <ConnectedVoiceAgentButton
        className={className}
        iconClassName={iconClassName}
        onStartRequestHandled={onStartRequestHandled}
        startRequested={startRequested}
      >
        {children}
      </ConnectedVoiceAgentButton>
    </VoiceAgentProvider>
  );
}
