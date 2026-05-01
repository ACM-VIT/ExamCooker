"use client";

import { AudioLines, Loader2, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoiceAgentButtonRuntime = {
  activity: "connecting" | "error" | "idle" | "listening" | "processing" | "executing";
  connected: boolean;
  muted: boolean;
};

type VoiceAgentButtonProps = {
  buttonLabel: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  iconClassName?: string;
  onClick: () => void;
  runtime: VoiceAgentButtonRuntime;
};

export default function VoiceAgentButton({
  buttonLabel,
  children,
  className,
  disabled = false,
  iconClassName,
  onClick,
  runtime,
}: VoiceAgentButtonProps) {
  const Icon =
    runtime.connected
      ? runtime.muted
        ? MicOff
        : AudioLines
      : runtime.activity === "connecting"
        ? Loader2
        : runtime.activity === "error"
          ? MicOff
          : Mic;

  return (
    <button
      type="button"
      title={buttonLabel}
      aria-label={buttonLabel}
      aria-pressed={runtime.connected}
      data-voice-agent-ignore="true"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-transparent text-black/70 transition-colors duration-200 hover:bg-black/5 hover:text-black disabled:cursor-wait disabled:opacity-70 dark:text-[#D5D5D5]/70 dark:hover:bg-white/5 dark:hover:text-[#3BF4C7]",
        className,
        runtime.connected &&
          "text-[#0D5875] dark:border-[#3BF4C7]/25 dark:bg-[#0F2431] dark:text-[#3BF4C7]",
        runtime.activity === "error" &&
          "text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300",
      )}
    >
      {runtime.connected ? (
        <span className="absolute inset-0 rounded-full border border-[#4DB3D6]/40 dark:border-[#3BF4C7]/35" />
      ) : null}
      <Icon
        className={cn(
          "h-4 w-4",
          !runtime.connected && runtime.activity === "connecting" && "animate-spin",
          iconClassName,
        )}
        aria-hidden="true"
      />
      {children}
    </button>
  );
}
