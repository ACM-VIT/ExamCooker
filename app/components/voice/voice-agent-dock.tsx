"use client";

import { Loader2, Mic, MicOff, RefreshCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type {
  UseVoiceControlReturn,
  VoiceToolCallRecord,
} from "./voice-runtime";

type VoiceAgentDockProps = {
  lastError: string | null;
  onDismissError: () => void;
  onRetry: () => void;
  onToggleVoiceAgent: () => void;
  runtime: UseVoiceControlReturn;
};

const TOOL_ACTION_HOLD_MS = 4500;
const DOCK_EXIT_MS = 220;
const LISTENING_TIP_INTERVAL_MS = 3200;

const LISTENING_TIPS = [
  "Say hi, I'm listening",
  'Try "take me to notes"',
  'Try "show me previous papers"',
  'Try "open the schedule"',
  "Ask me anything on this page",
  'Try "scroll down"',
  'Try "go back"',
];

function splitWords(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

function describeToolArgs(name: string, args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const record = args as Record<string, unknown>;

  switch (name) {
    case "navigate_to_path":
      return typeof record.path === "string" ? record.path : null;
    case "go_to_pdf_page":
      return typeof record.page === "number" ? `page ${record.page}` : null;
    case "scroll_view":
      return typeof record.direction === "string" ? record.direction : null;
    default:
      return null;
  }
}

function describeToolOutput(name: string, output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;

  switch (name) {
    case "activate_control":
    case "fill_input": {
      const control =
        (record.activated as Record<string, unknown> | undefined) ??
        (record.control as Record<string, unknown> | undefined);
      return control && typeof control.label === "string" ? control.label : null;
    }
    default:
      return null;
  }
}

function formatToolAction(toolCall: VoiceToolCallRecord): string | null {
  if (
    toolCall.name === "inspect_current_view" ||
    toolCall.name === "inspect_open_pdf"
  ) {
    return null;
  }

  const verbs = (() => {
    switch (toolCall.name) {
      case "navigate_to_path":
        return { running: "Navigating to", done: "Navigated to" };
      case "go_back":
        return { running: "Going back", done: "Went back" };
      case "scroll_view":
        return { running: "Scrolling", done: "Scrolled" };
      case "activate_control":
        return { running: "Activating", done: "Activated" };
      case "fill_input":
        return { running: "Filling", done: "Filled" };
      case "go_to_pdf_page":
        return { running: "Jumping to", done: "Jumped to" };
      case "answer_question_about_open_pdf":
        return { running: "Reading PDF", done: "Read PDF" };
      default:
        return null;
    }
  })();

  if (!verbs) return null;

  if (toolCall.status === "skipped") return null;
  if (toolCall.status === "error") {
    return `Couldn't finish ${verbs.running.toLowerCase()}`;
  }

  const detail =
    describeToolOutput(toolCall.name, toolCall.output) ??
    describeToolArgs(toolCall.name, toolCall.args);
  const verb = toolCall.status === "running" ? verbs.running : verbs.done;
  return detail ? `${verb} ${detail}` : verb;
}

function useToolActionCaption(runtime: UseVoiceControlReturn) {
  const [caption, setCaption] = useState<string | null>(null);

  useEffect(() => {
    const tool = runtime.latestToolCall;
    if (!tool) return;

    const text = formatToolAction(tool);
    if (!text) return;

    setCaption(text);
    if (tool.status === "running") return;

    const timer = window.setTimeout(() => {
      setCaption((current) => (current === text ? null : current));
    }, TOOL_ACTION_HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [runtime.latestToolCall]);

  useEffect(() => {
    if (!runtime.connected && runtime.activity !== "connecting") {
      setCaption(null);
    }
  }, [runtime.connected, runtime.activity]);

  return caption;
}

function useListeningTip(active: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LISTENING_TIPS.length);
    }, LISTENING_TIP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active]);

  return active ? LISTENING_TIPS[index] : null;
}

function getStatusFallback(
  runtime: UseVoiceControlReturn,
  lastError: string | null,
  listeningTip: string | null,
): { text: string; tone: "default" | "error" | "muted" } | null {
  if (lastError) return { text: "Couldn't reach voice", tone: "error" };
  if (!runtime.connected) {
    return runtime.activity === "connecting"
      ? { text: "Getting ready…", tone: "default" }
      : null;
  }
  if (runtime.muted) return { text: "Muted. Tap mic to talk", tone: "muted" };
  if (runtime.activity === "processing") return { text: "Thinking…", tone: "default" };
  return { text: listeningTip ?? "Say hi, I'm listening", tone: "default" };
}

function StatusCaption({
  text,
  tone,
}: {
  text: string;
  tone: "default" | "error" | "muted";
}) {
  return (
    <div
      className={cn(
        "h-5 overflow-hidden text-[12.5px] font-medium leading-5 tracking-[-0.005em] transition-colors duration-200",
        tone === "error"
          ? "text-red-500/90 dark:text-red-400/90"
          : tone === "muted"
            ? "text-black/45 dark:text-[#D5D5D5]/45"
            : "text-black/60 dark:text-[#D5D5D5]/65",
      )}
    >
      <span key={text} className="voice-caption-line block truncate">
        {text}
      </span>
    </div>
  );
}

function LyricLine({ text }: { text: string }) {
  const words = useMemo(() => splitWords(text), [text]);

  return (
    <p className="text-balance text-center text-[15px] sm:text-[17px] font-semibold leading-snug tracking-[-0.005em] text-[#0E5876] dark:text-[#3BF4C7]">
      {words.map((word, i) => (
        <span key={i} className="voice-lyric-word inline-block whitespace-pre">
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

export default function VoiceAgentDock({
  lastError,
  onDismissError,
  onRetry,
  onToggleVoiceAgent,
  runtime,
}: VoiceAgentDockProps) {
  const toolCaption = useToolActionCaption(runtime);

  const showListeningTip =
    runtime.connected &&
    !runtime.muted &&
    runtime.activity === "listening" &&
    !toolCaption &&
    runtime.transcript.trim().length === 0;
  const listeningTip = useListeningTip(showListeningTip);

  const visible =
    runtime.connected ||
    runtime.activity === "connecting" ||
    lastError !== null;

  const [mounted, setMounted] = useState(visible);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), DOCK_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  const currentTranscript = runtime.transcript.trim();
  const fallback = getStatusFallback(runtime, lastError, listeningTip);
  const captionText = toolCaption ?? fallback?.text ?? "";
  const captionTone =
    lastError != null
      ? "error"
      : toolCaption
        ? "default"
        : (fallback?.tone ?? "default");
  const showSpinner = !runtime.connected && !lastError;

  return createPortal(
    <div
      data-voice-agent-ignore="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[75]"
      aria-live="polite"
    >
      <style>{`
        @keyframes voice-lyric-word-in {
          from { opacity: 0; transform: translateY(5px); filter: blur(3px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .voice-lyric-word {
          animation: voice-lyric-word-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes voice-caption-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .voice-caption-line {
          animation: voice-caption-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .voice-lyric-word, .voice-caption-line { animation: none; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 h-48 transition-opacity duration-300 ease-out",
          "bg-gradient-to-t from-white via-white/55 to-transparent",
          "dark:from-[#0C1222] dark:via-[#0C1222]/55 dark:to-transparent",
          entered ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={cn(
          "pointer-events-auto relative mx-auto flex w-full max-w-[440px] flex-col items-center gap-3 px-5 pt-7 transition-[opacity,transform] duration-200 ease-out will-change-transform",
          entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        }}
      >
        <StatusCaption text={captionText} tone={captionTone} />

        <div className="min-h-[24px] w-full">
          {currentTranscript ? <LyricLine text={currentTranscript} /> : null}
        </div>

        <div className="flex items-center gap-1.5">
          {lastError ? (
            <button
              type="button"
              aria-label="Retry voice mode"
              title="Retry voice mode"
              onClick={onRetry}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-black/70 ring-1 ring-inset ring-black/[0.06] transition-all duration-150 hover:bg-black/[0.09] hover:text-black/90 active:scale-[0.97] dark:bg-white/[0.05] dark:text-[#D5D5D5]/75 dark:ring-white/[0.06] dark:hover:bg-white/[0.09] dark:hover:text-[#D5D5D5]"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={runtime.muted ? "Unmute microphone" : "Mute microphone"}
              title={runtime.muted ? "Unmute microphone" : "Mute microphone"}
              onClick={() => runtime.setMuted(!runtime.muted)}
              disabled={!runtime.connected}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset transition-all duration-150 active:scale-[0.97]",
                runtime.muted
                  ? "bg-[#0E5876] text-white ring-transparent hover:bg-[#0B4359] dark:bg-[#12314B] dark:text-[#D8F8EE] dark:hover:bg-[#16415F]"
                  : "bg-black/[0.05] text-black/70 ring-black/[0.06] hover:bg-black/[0.09] hover:text-black/90 dark:bg-white/[0.05] dark:text-[#D5D5D5]/80 dark:ring-white/[0.06] dark:hover:bg-white/[0.09] dark:hover:text-[#D5D5D5]",
                !runtime.connected && "cursor-not-allowed opacity-50",
              )}
            >
              {showSpinner ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : runtime.muted ? (
                <MicOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Mic className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            aria-label={lastError ? "Dismiss voice guide" : "End voice mode"}
            title={lastError ? "Dismiss voice guide" : "End voice mode"}
            onClick={lastError ? onDismissError : onToggleVoiceAgent}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-black/65 ring-1 ring-inset ring-black/[0.06] transition-all duration-150 hover:bg-black/[0.09] hover:text-black/85 active:scale-[0.97] dark:bg-white/[0.05] dark:text-[#D5D5D5]/70 dark:ring-white/[0.06] dark:hover:bg-white/[0.09] dark:hover:text-[#D5D5D5]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
