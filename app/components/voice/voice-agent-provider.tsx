"use client";

import React, {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { addOptionalTransitionType } from "@/app/components/common/react-transition";
import {
  createVoiceControlController,
  defineVoiceTool,
  useVoiceControl,
  type UseVoiceControlOptions,
  type UseVoiceControlReturn,
  type VoiceControlController,
} from "./voice-runtime";
import { GhostCursorOverlay, useGhostCursor } from "./voice-ghost-cursor";
import { answerVisiblePdfPageQuestionAction } from "./voice-agent-actions";
import {
  DEFAULT_VOICE,
  MAX_VISIBLE_CONTROLS,
  VOICE_GUIDE_INSTRUCTIONS,
  VOICE_SESSION_MAX_MS,
  buildCourseExamFilterPath,
  buildCoursePastPapersPath,
  buildPageContextMessage,
  captureCurrentVisualContext,
  getCoursePastPapersContext,
  getInternalPathFromHref,
  getOpenPdfView,
  resolveCourseCodeForNavigation,
  resolveCourseExam,
  resolveInternalPath,
  settleUi,
  useBrowserPath,
  waitForCondition,
  type NavigationEventDetail,
  type VoiceGuideSnapshot,
} from "./voice-agent-helpers";
import { z } from "zod";
import { toast } from "@/app/components/ui/use-toast";
import {
  collectVoicePageSnapshot,
  findRegistryEntryById,
  setFormControlValue,
  submitFormControl,
  type VoiceControlRegistryEntry,
} from "./voice-dom";
import { getActivePdfSnapshot } from "./pdf-voice-context";
import {
  NAVIGATION_EVENT,
  currentBrowserPath,
  currentBrowserRoutePath,
} from "./voice-navigation";
import VoiceAgentDock from "./voice-agent-dock";
import {
  captureVoiceAgentLlmGeneration,
  captureVoiceAgentError,
  captureVoiceAgentSessionEnded,
  captureVoiceAgentSessionStarted,
  getPostHogSessionId,
  type VoiceAgentEntryPoint,
} from "@/lib/posthog/client";
const VOICE_DEBUG = process.env.NODE_ENV !== "production";

type VoiceAgentContextValue = {
  buttonLabel: string;
  controller: VoiceControlController;
  lastError: string | null;
  runtime: UseVoiceControlReturn;
  startVoiceAgent: () => void;
  toggleVoiceAgent: () => void;
};

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

export function useVoiceAgent() {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error("useVoiceAgent must be used inside VoiceAgentProvider.");
  }

  return context;
}

export default function VoiceAgentProvider({
  entryPoint,
  children,
}: {
  entryPoint: VoiceAgentEntryPoint;
  children: React.ReactNode;
}) {
  const { push, replace } = useRouter();
  const browserPath = useBrowserPath();
  const [controller] = useState(() =>
    createVoiceControlController({
      activationMode: "vad",
      auth: { sessionEndpoint: "/api/realtime/session" },
      debug: VOICE_DEBUG,
      instructions: "Voice guide is preparing.",
      model: "gpt-realtime-2",
      maxOutputTokens: 90,
      outputMode: "audio",
      postToolResponse: true,
      tools: [],
    }),
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionEntryPointRef = useRef<VoiceAgentEntryPoint>(entryPoint);
  const voiceAnalyticsSessionIdRef = useRef<string | null>(null);
  const pendingDisconnectReasonRef = useRef<
    "manual" | "timeout" | "error" | "unexpected_disconnect" | null
  >(null);
  const controlRegistryRef = useRef<VoiceControlRegistryEntry[]>([]);
  const inAppHistoryRef = useRef<{ entries: string[]; index: number }>({
    entries: [],
    index: -1,
  });
  const runtime = useVoiceControl(controller);
  const { cursorState, run, hide } = useGhostCursor();

  useEffect(() => {
    return () => controller.disconnect();
  }, [controller]);

  const getFreshSnapshot = useCallback((maxControls = MAX_VISIBLE_CONTROLS) => {
    const { snapshot, registry } = collectVoicePageSnapshot(maxControls);
    controlRegistryRef.current = registry;
    return {
      ...snapshot,
      openPdf: getOpenPdfView(),
    } satisfies VoiceGuideSnapshot;
  }, []);

  const resolveRegistryEntry = useCallback(
    (controlId: string) => {
      const currentMatch = findRegistryEntryById(controlRegistryRef.current, controlId);
      if (currentMatch) {
        return currentMatch;
      }

      const snapshot = getFreshSnapshot();
      const refreshedMatch = findRegistryEntryById(controlRegistryRef.current, controlId);
      if (refreshedMatch) {
        return refreshedMatch;
      }

      const available = snapshot.controls
        .map((control) => `${control.id}: ${control.label}`)
        .join(", ");
      throw new Error(
        available
          ? `Control "${controlId}" is no longer visible. Inspect the current view again. Available controls: ${available}`
          : `Control "${controlId}" is no longer visible. Inspect the current view again.`,
      );
    },
    [getFreshSnapshot],
  );

  const buildToolFailure = useCallback(
    (message: string) => ({
      ok: false as const,
      message,
      currentView: getFreshSnapshot(),
    }),
    [getFreshSnapshot],
  );

  const requestOpenPdfAnswer = useCallback(async (question: string) => {
    const activePdf = getActivePdfSnapshot();
    if (!activePdf) {
      throw new Error("There is no open PDF right now.");
    }

    const voiceSessionId =
      voiceAnalyticsSessionIdRef.current ?? crypto.randomUUID();
    voiceAnalyticsSessionIdRef.current = voiceSessionId;

    const visualContext = await captureCurrentVisualContext();
    if (!visualContext) {
      throw new Error("I could not capture the visible PDF page.");
    }

    if (VOICE_DEBUG) {
      console.debug("[voice-agent] visible PDF capture", {
        height: visualContext.height,
        source: visualContext.source,
        width: visualContext.width,
      });
    }

    const result = await answerVisiblePdfPageQuestionAction({
      currentPage: activePdf.currentPage,
      fileName: activePdf.fileName,
      imageDataUrl: visualContext.image,
      imageHeight: visualContext.height,
      imageSource: visualContext.source,
      imageWidth: visualContext.width,
      posthogSessionId: getPostHogSessionId(),
      question,
      title: document.title,
      totalPages: activePdf.totalPages,
      voiceEntryPoint: sessionEntryPointRef.current,
      voiceSessionId,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    if (!result.answer.trim()) {
      throw new Error("The visible PDF answer service returned an empty answer.");
    }

    return {
      answer: result.answer.trim(),
      openPdf: getOpenPdfView(),
    };
  }, []);

  useEffect(() => {
    const historyState = inAppHistoryRef.current;
    if (historyState.index !== -1) {
      return;
    }

    historyState.entries = [browserPath];
    historyState.index = 0;
  }, [browserPath]);

  useEffect(() => {
    const handleNavigationEvent = (event: Event) => {
      const { detail } = event as CustomEvent<NavigationEventDetail>;
      const nextPath =
        typeof detail?.path === "string" && detail.path.length > 0
          ? detail.path
          : currentBrowserPath();
      const action = detail?.action ?? "push";
      const historyState = inAppHistoryRef.current;

      if (historyState.index === -1) {
        historyState.entries = [nextPath];
        historyState.index = 0;
        return;
      }

      if (action === "replace") {
        historyState.entries[historyState.index] = nextPath;
        return;
      }

      if (action === "push") {
        if (historyState.entries[historyState.index] === nextPath) {
          return;
        }

        historyState.entries = [
          ...historyState.entries.slice(0, historyState.index + 1),
          nextPath,
        ];
        historyState.index = historyState.entries.length - 1;
        return;
      }

      const previousPath =
        historyState.index > 0 ? historyState.entries[historyState.index - 1] : null;
      const nextForwardPath =
        historyState.index + 1 < historyState.entries.length
          ? historyState.entries[historyState.index + 1]
          : null;

      if (previousPath === nextPath) {
        historyState.index -= 1;
        return;
      }

      if (nextForwardPath === nextPath) {
        historyState.index += 1;
        return;
      }

      const knownIndex = historyState.entries.lastIndexOf(nextPath);
      if (knownIndex !== -1) {
        historyState.index = knownIndex;
        return;
      }

      historyState.entries = [nextPath];
      historyState.index = 0;
    };

    window.addEventListener(NAVIGATION_EVENT, handleNavigationEvent);
    return () => {
      window.removeEventListener(NAVIGATION_EVENT, handleNavigationEvent);
    };
  }, []);

  const tools = useMemo(
    () => [
      defineVoiceTool({
        name: "inspect_current_view",
        description:
          "Inspect the current page before acting. Use this to see the current route, headings, scroll position, and visible controls with their control IDs.",
        parameters: z.object({}),
        execute: async () => ({
          ok: true as const,
          currentView: getFreshSnapshot(),
        }),
      }),
      defineVoiceTool({
        name: "inspect_open_pdf",
        description:
          "Inspect the currently open ExamCooker PDF. Use this for the file name, current page, and total page count.",
        parameters: z.object({}),
        execute: async () => {
          const openPdf = getOpenPdfView();
          if (!openPdf) {
            return buildToolFailure("There is no open PDF on the current page.");
          }

          return {
            ok: true as const,
            openPdf,
            currentView: getFreshSnapshot(),
          };
        },
      }),
      defineVoiceTool({
        name: "go_to_pdf_page",
        description:
          "Jump to a page inside the currently open ExamCooker PDF.",
        parameters: z.object({
          page: z.number().int().min(1).max(10000),
        }),
        execute: async ({ page }) => {
          const activePdf = getActivePdfSnapshot();
          if (!activePdf) {
            return buildToolFailure("There is no open PDF on the current page.");
          }

          const targetPage = Math.min(Math.max(page, 1), activePdf.totalPages);
          activePdf.navigateToPage(targetPage);
          const reachedTarget = await waitForCondition(() => {
            const currentPdf = getActivePdfSnapshot();
            return (
              currentPdf?.viewerId === activePdf.viewerId &&
              currentPdf.currentPage === targetPage
            );
          }, 2500);

          if (!reachedTarget) {
            return buildToolFailure(
              `I could not confirm navigation to PDF page ${targetPage}.`,
            );
          }

          await settleUi({ delayMs: 260 });

          return {
            ok: true as const,
            currentView: getFreshSnapshot(),
            openPdf: getOpenPdfView(),
            page: targetPage,
          };
        },
      }),
      defineVoiceTool({
        name: "answer_question_about_open_pdf",
        description:
          "Answer a question about the currently visible page of the open ExamCooker PDF by reading its rendered page image.",
        parameters: z.object({
          question: z.string().min(1).max(1200),
        }),
        execute: async ({ question }) => {
          try {
            const result = await requestOpenPdfAnswer(question);
            return {
              ok: true as const,
              answer: result.answer,
              openPdf: result.openPdf,
            };
          } catch (error) {
            return buildToolFailure(
              error instanceof Error
                ? error.message
                : "Unable to answer that question from the open PDF.",
            );
          }
        },
      }),
      defineVoiceTool({
        name: "filter_course_papers_by_exam",
        description:
          "Apply a course-specific exam filter on the current past papers page, like pressing the CAT-1 or FAT filter chip without leaving the page.",
        parameters: z.object({
          exam: z.string().min(1).max(80),
        }),
        execute: async ({ exam }) => {
          try {
            const courseContext = getCoursePastPapersContext();
            if (!courseContext) {
              return buildToolFailure(
                'Open a course-specific past papers page first, such as "/past_papers/CSE1001".',
              );
            }

            const resolvedExam = resolveCourseExam(exam);
            const nextPath = buildCourseExamFilterPath(
              courseContext.basePath,
              resolvedExam.slug,
            );

            if (currentBrowserPath() === nextPath) {
              return {
                ok: true as const,
                changed: false,
                exam: resolvedExam.label,
                path: nextPath,
                currentView: getFreshSnapshot(),
              };
            }

            startTransition(() => {
              addOptionalTransitionType("filter-results");
              replace(nextPath);
            });
            await settleUi({ targetPath: nextPath });

            return {
              ok: true as const,
              changed: currentBrowserPath() === nextPath,
              exam: resolvedExam.label,
              path: nextPath,
              currentView: getFreshSnapshot(),
            };
          } catch (error) {
            return buildToolFailure(
              error instanceof Error
                ? error.message
                : "Unable to apply that course paper filter.",
            );
          }
        },
      }),
      defineVoiceTool({
        name: "navigate_to_course_past_papers",
        description:
          "Navigate directly to a specific course's past papers page. Accepts course codes like BCSE302L or CSE1001, common aliases like DBMS when unambiguous, and can optionally apply an exam filter such as CAT-1 or FAT.",
        parameters: z.object({
          course: z
            .string()
            .min(1)
            .max(120)
            .describe("Course code or course alias from the user's request."),
          exam: z
            .string()
            .min(1)
            .max(80)
            .optional()
            .describe("Optional exam filter, such as CAT-1, CAT-2, FAT, Quiz, or Model FAT."),
        }),
        execute: async ({ course, exam }) => {
          try {
            const courseCode = resolveCourseCodeForNavigation(course);
            const { exam: examLabel, path: nextPath } = buildCoursePastPapersPath(
              courseCode,
              exam,
            );

            if (currentBrowserPath() === nextPath) {
              return {
                ok: true as const,
                changed: false,
                courseCode,
                exam: examLabel,
                path: nextPath,
                currentView: getFreshSnapshot(),
              };
            }

            startTransition(() => {
              push(nextPath);
            });
            await settleUi({ targetPath: nextPath });

            return {
              ok: true as const,
              changed: currentBrowserPath() === nextPath,
              courseCode,
              exam: examLabel,
              path: nextPath,
              currentView: getFreshSnapshot(),
            };
          } catch (error) {
            return buildToolFailure(
              error instanceof Error
                ? error.message
                : "Unable to open that course's past papers.",
            );
          }
        },
      }),
      defineVoiceTool({
        name: "navigate_to_path",
        description:
          'Navigate to an internal ExamCooker route such as "/", "/notes", or "/past_papers". Use only internal paths that start with "/".',
        parameters: z.object({
          path: z.string().min(1),
        }),
        execute: async ({ path }) => {
          try {
            const nextPath = resolveInternalPath(path);
            if (currentBrowserPath() === nextPath) {
              return {
                ok: true as const,
                changed: false,
                path: nextPath,
                currentView: getFreshSnapshot(),
              };
            }

            startTransition(() => {
              push(nextPath);
            });
            await settleUi({ targetPath: nextPath });

            return {
              ok: true as const,
              changed: currentBrowserPath() === nextPath,
              path: nextPath,
              currentView: getFreshSnapshot(),
            };
          } catch (error) {
            return buildToolFailure(
              error instanceof Error ? error.message : "Unable to navigate to that path.",
            );
          }
        },
      }),
      defineVoiceTool({
        name: "go_back",
        description: "Go back one step in the browser history inside the current tab.",
        parameters: z.object({}),
        execute: async () => {
          const historyState = inAppHistoryRef.current;
          const previousPath =
            historyState.index > 0 ? historyState.entries[historyState.index - 1] : null;
          if (!previousPath) {
            return buildToolFailure(
              "There is no earlier ExamCooker page in this tab to go back to.",
            );
          }

          window.history.back();
          const reachedPreviousPath = await waitForCondition(
            () => currentBrowserPath() === previousPath,
            2500,
          );
          if (!reachedPreviousPath) {
            return buildToolFailure(
              "I could not confirm an in-app back navigation without leaving ExamCooker.",
            );
          }

          await settleUi({ targetPath: previousPath });
          return {
            ok: true as const,
            changed: true,
            currentView: getFreshSnapshot(),
          };
        },
      }),
      defineVoiceTool({
        name: "scroll_view",
        description:
          "Scroll the current page when the target content is not visible yet.",
        parameters: z.object({
          direction: z.enum(["up", "down", "top", "bottom"]),
          amount: z.enum(["small", "medium", "large"]).optional(),
        }),
        execute: async ({ direction, amount = "medium" }) => {
          const distance = {
            small: window.innerHeight * 0.45,
            medium: window.innerHeight * 0.9,
            large: window.innerHeight * 1.3,
          }[amount];

          if (direction === "top") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else if (direction === "bottom") {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          } else {
            window.scrollBy({
              top: direction === "down" ? distance : -distance,
              behavior: "smooth",
            });
          }

          await settleUi({ delayMs: 300 });
          return {
            ok: true as const,
            direction,
            amount,
            currentView: getFreshSnapshot(),
          };
        },
      }),
      defineVoiceTool({
        name: "activate_control",
        description:
          "Click or focus a visible control by its control ID from inspect_current_view.",
        parameters: z.object({
          controlId: z.string().min(1),
        }),
        execute: async ({ controlId }) => {
          try {
            const entry = resolveRegistryEntry(controlId);
            if (entry.control.disabled) {
              return buildToolFailure(`"${entry.control.label}" is currently disabled.`);
            }

            const internalPath =
              entry.element instanceof HTMLAnchorElement
                ? getInternalPathFromHref(entry.element.getAttribute("href"))
                : null;

            if (entry.element instanceof HTMLAnchorElement && internalPath === null) {
              return buildToolFailure(
                `"${entry.control.label}" leaves ExamCooker. Ask the user before opening external destinations.`,
              );
            }

            await run(
              {
                element: entry.element,
                pulseElement: entry.element,
              },
              async () => {
                entry.element.focus();

                if (entry.element instanceof HTMLInputElement) {
                  const inputType = entry.element.type.toLowerCase();
                  if (!["checkbox", "radio", "button", "submit", "reset"].includes(inputType)) {
                    return;
                  }
                }

                entry.element.click();
              },
              {
                easing: "smooth",
                from: "previous",
              },
            );

            await settleUi({ targetPath: internalPath ?? undefined });
            return {
              ok: true as const,
              activated: entry.control,
              currentView: getFreshSnapshot(),
            };
          } catch (error) {
            return buildToolFailure(
              error instanceof Error ? error.message : "Unable to activate that control.",
            );
          }
        },
      }),
      defineVoiceTool({
        name: "fill_input",
        description:
          "Fill a visible text input, search field, textarea, or select using a control ID from inspect_current_view. Use submit=true if the change should also submit the surrounding form.",
        parameters: z.object({
          controlId: z.string().min(1),
          submit: z.boolean().optional(),
          value: z.string().max(240),
        }),
        execute: async ({ controlId, submit = false, value }) => {
          try {
            const entry = resolveRegistryEntry(controlId);
            if (entry.control.disabled) {
              return buildToolFailure(`"${entry.control.label}" is currently disabled.`);
            }

            if (
              !(
                entry.element instanceof HTMLInputElement ||
                entry.element instanceof HTMLTextAreaElement ||
                entry.element instanceof HTMLSelectElement
              )
            ) {
              return buildToolFailure(
                `"${entry.control.label}" cannot be filled. Inspect the current view again and choose an input control.`,
              );
            }

            const formControl = entry.element;
            let appliedValue = value;
            await run(
              {
                element: formControl,
                pulseElement: formControl,
              },
              async () => {
                formControl.focus();
                const result = setFormControlValue(formControl, value);
                appliedValue = result.appliedValue;

                if (submit) {
                  submitFormControl(formControl);
                }
              },
              {
                easing: "smooth",
                from: "previous",
              },
            );

            await settleUi({ delayMs: submit ? 320 : 260 });
            return {
              ok: true as const,
              appliedValue,
              control: entry.control,
              submitted: submit,
              currentView: getFreshSnapshot(),
            };
          } catch (error) {
            return buildToolFailure(
              error instanceof Error ? error.message : "Unable to fill that control.",
            );
          }
        },
      }),
    ],
    [
      buildToolFailure,
      getFreshSnapshot,
      requestOpenPdfAnswer,
      resolveRegistryEntry,
      push,
      replace,
      run,
    ],
  );

  const controllerOptions = useMemo<UseVoiceControlOptions>(
    () => ({
      activationMode: "vad",
      audio: {
        input: {
          capture: {
            autoGainControl: { ideal: false },
            channelCount: { ideal: 1 },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
          },
          noiseReduction: { type: "near_field" },
          turnDetection: {
            type: "semantic_vad",
            createResponse: true,
            interruptResponse: true,
            eagerness: "low",
          },
        },
        output: {
          voice: DEFAULT_VOICE,
        },
      },
      auth: { sessionEndpoint: "/api/realtime/session" },
      debug: VOICE_DEBUG,
      instructions: VOICE_GUIDE_INSTRUCTIONS,
      maxOutputTokens: 400,
      model: "gpt-realtime-2",
      onGenerationCompleted: (generation) => {
        const voiceSessionId = voiceAnalyticsSessionIdRef.current;
        if (!voiceSessionId) {
          return;
        }

        captureVoiceAgentLlmGeneration({
          browserPath: currentBrowserPath(),
          conversationId: generation.conversationId ?? null,
          entryPoint: sessionEntryPointRef.current,
          errorMessage: generation.errorMessage ?? null,
          inputText: generation.inputText,
          inputTokens: generation.inputTokens,
          latencySeconds: generation.latencyMs / 1000,
          model: generation.model,
          outputText: generation.outputText,
          outputTokens: generation.outputTokens,
          responseId: generation.responseId ?? null,
          status: generation.status,
          stopReason: generation.stopReason ?? null,
          timeToFirstTokenSeconds:
            generation.timeToFirstTokenMs !== undefined
              ? generation.timeToFirstTokenMs / 1000
              : undefined,
          voiceSessionId,
        });
      },
      onError: (error) => {
        if (error.code === "active_response") {
          return;
        }

        pendingDisconnectReasonRef.current = "error";
        setLastError(error.message);
        captureVoiceAgentError({
          entryPoint,
          message: error.message,
        });
        toast({
          title: "Voice guide unavailable",
          description: error.message,
          variant: "destructive",
        });
      },
      outputMode: "audio",
      postToolResponse: true,
      trace: () => ({
        workflowName: "ExamCooker Voice Guide",
        groupId: voiceAnalyticsSessionIdRef.current ?? undefined,
        metadata: {
          browserPath: currentBrowserPath(),
          entryPoint: sessionEntryPointRef.current,
          posthogSessionId: getPostHogSessionId() ?? undefined,
          surface: "voice_agent",
        },
      }),
      tools,
    }),
    [entryPoint, tools],
  );

  useEffect(() => {
    controller.configure(controllerOptions);
  }, [controller, controllerOptions]);

  useEffect(() => {
    if (!runtime.connected) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const snapshot = getFreshSnapshot();
      controller.sendContextMessage(buildPageContextMessage(snapshot));
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [browserPath, controller, getFreshSnapshot, runtime.connected]);

  useEffect(() => {
    if (runtime.connected) {
      if (sessionStartedAtRef.current === null) {
        sessionStartedAtRef.current = Date.now();
        sessionEntryPointRef.current = entryPoint;
        voiceAnalyticsSessionIdRef.current ??= crypto.randomUUID();
        captureVoiceAgentSessionStarted(sessionEntryPointRef.current);
      }

      return;
    }

    if (sessionStartedAtRef.current === null) {
      return;
    }

    captureVoiceAgentSessionEnded({
      entryPoint: sessionEntryPointRef.current,
      reason:
        pendingDisconnectReasonRef.current ??
        (lastError ? "error" : "unexpected_disconnect"),
      startedAt: sessionStartedAtRef.current,
    });
    sessionStartedAtRef.current = null;
    voiceAnalyticsSessionIdRef.current = null;
    pendingDisconnectReasonRef.current = null;
  }, [entryPoint, lastError, runtime.connected]);

  useEffect(() => {
    if (!runtime.connected) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setLastError(null);
      pendingDisconnectReasonRef.current = "timeout";
      controller.disconnect();
      hide();
      toast({
        title: "Voice session ended",
        description: "Voice sessions are limited to 3 minutes. Start it again to continue.",
      });
    }, VOICE_SESSION_MAX_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [controller, hide, runtime.connected]);

  const startVoiceAgent = useCallback(() => {
    if (runtime.activity === "connecting") {
      return;
    }

    setLastError(null);

    if (runtime.connected) {
      if (runtime.activity !== "error") {
        return;
      }

      controller.disconnect();
      hide();
    }

    voiceAnalyticsSessionIdRef.current = crypto.randomUUID();
    void controller.connect();
  }, [controller, hide, runtime.activity, runtime.connected]);

  const dismissLastError = useCallback(() => {
    setLastError(null);
  }, []);

  const toggleVoiceAgent = useCallback(() => {
    if (runtime.connected || runtime.activity === "connecting") {
      pendingDisconnectReasonRef.current = "manual";
      controller.disconnect();
      hide();
      return;
    }

    startVoiceAgent();
  }, [controller, hide, runtime.activity, runtime.connected, startVoiceAgent]);

  const buttonLabel =
    runtime.connected
      ? "Disconnect the voice guide"
      : runtime.activity === "connecting"
        ? "Stop the voice guide while it connects"
        : runtime.activity === "error"
          ? "Retry the voice guide"
          : "Start the voice guide";

  const contextValue = useMemo<VoiceAgentContextValue>(
    () => ({
      buttonLabel,
      controller,
      lastError,
      runtime,
      startVoiceAgent,
      toggleVoiceAgent,
    }),
    [buttonLabel, controller, lastError, runtime, startVoiceAgent, toggleVoiceAgent],
  );

  return (
    <VoiceAgentContext.Provider value={contextValue}>
      {children}
      <GhostCursorOverlay state={cursorState} />
      <VoiceAgentDock
        lastError={lastError}
        onDismissError={dismissLastError}
        onRetry={startVoiceAgent}
        onToggleVoiceAgent={toggleVoiceAgent}
        runtime={runtime}
      />
    </VoiceAgentContext.Provider>
  );
}
