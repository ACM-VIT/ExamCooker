"use client";

import React, {
  addTransitionType,
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
import {
  GhostCursorOverlay,
  createVoiceControlController,
  defineVoiceTool,
  useGhostCursor,
  useVoiceControl,
  type UseVoiceControlOptions,
  type UseVoiceControlReturn,
  type VoiceControlController,
} from "./voiceRuntime";
import { z } from "zod";
import { toast } from "@/components/ui/use-toast";
import {
  collectVoicePageSnapshot,
  findRegistryEntryById,
  setFormControlValue,
  submitFormControl,
  type VoiceControlRegistryEntry,
  type VoicePageSnapshot,
} from "./voiceDom";
import { getActivePdfSnapshot } from "./pdfVoiceContext";
import {
  NAVIGATION_EVENT,
  currentBrowserPath,
  currentBrowserRoutePath,
  currentRenderedRoutePath,
} from "./voiceNavigation";
import VoiceAgentDock from "./VoiceAgentDock";
import {
  examSlugToType,
  examTypeLabel,
  examTypeToSlug,
} from "@/lib/examSlug";

const MAX_VISIBLE_CONTROLS = 48;
const ROUTE_RENDER_TIMEOUT_MS = 5000;
const COURSE_EXAM_REQUEST_ALIASES: Record<
  string,
  Parameters<typeof examTypeToSlug>[0]
> = {
  cat1: "CAT_1",
  "cat 1": "CAT_1",
  "cat-1": "CAT_1",
  cat2: "CAT_2",
  "cat 2": "CAT_2",
  "cat-2": "CAT_2",
  fat: "FAT",
  quiz: "QUIZ",
  mid: "MID",
  cia: "CIA",
  other: "OTHER",
  "model cat1": "MODEL_CAT_1",
  "model cat 1": "MODEL_CAT_1",
  "model-cat-1": "MODEL_CAT_1",
  "model cat2": "MODEL_CAT_2",
  "model cat 2": "MODEL_CAT_2",
  "model-cat-2": "MODEL_CAT_2",
  "model fat": "MODEL_FAT",
  "model-fat": "MODEL_FAT",
};

type NavigationEventAction = "push" | "replace" | "pop" | "hash";
type NavigationEventDetail = {
  action: NavigationEventAction;
  path: string;
};

const VOICE_GUIDE_INSTRUCTIONS = `You are ExamCooker's voice guide for this website.

Stay inside ExamCooker and help the user navigate or control visible UI.

Primary sections:
- Home: /
- Past papers: /past_papers
- Notes: /notes
- Syllabus: /syllabus
- Resources: /resources
- Quiz: /quiz

Rules:
- Use navigate_to_path for direct route changes.
- On a course past papers page like "/past_papers/CSE1001", use filter_course_papers_by_exam for requests such as "open CAT-1 papers" or "open FAT papers".
- Use inspect_current_view before a multi-step interaction or when the page may have changed.
- Use activate_control and fill_input only with control IDs returned by inspect_current_view.
- If an ExamCooker PDF is open and the user asks about its contents, use answer_question_about_open_pdf with the user's question.
- Use inspect_open_pdf for page-number or document-status questions.
- Use go_to_pdf_page when the user asks to jump to a PDF page.
- Do not guess what a PDF says without using the PDF tools.
- Prefer tools over narration when the user asks you to move around the site or interact with it.
- Keep spoken replies brief and action-oriented.
- For navigation, filtering, clicking, scrolling, or opening papers, reply with one short sentence only.
- Do not read out full past paper titles, paths, or long metadata unless the user explicitly asks for those details or they are required to disambiguate between two visible options.
- Only give a longer explanation when answering a real course-content question from an open past paper or other open PDF.
- If something is ambiguous or missing, ask one short clarifying question.`;

const DEFAULT_VOICE = "sage" as const;

type VoiceOpenPdfView = {
  currentPage: number;
  fileName: string;
  totalPages: number;
};

type VoiceGuideSnapshot = VoicePageSnapshot & {
  openPdf: VoiceOpenPdfView | null;
};

type VoiceAgentContextValue = {
  buttonLabel: string;
  controller: VoiceControlController;
  lastError: string | null;
  runtime: UseVoiceControlReturn;
  startVoiceAgent: () => void;
  toggleVoiceAgent: () => void;
};

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

function dispatchNavigationEvent(action: NavigationEventAction) {
  window.dispatchEvent(
    new CustomEvent<NavigationEventDetail>(NAVIGATION_EVENT, {
      detail: {
        action,
        path: currentBrowserPath(),
      },
    }),
  );
}

function useBrowserPath() {
  const [browserPath, setBrowserPath] = useState(() =>
    typeof window === "undefined" ? "" : currentBrowserPath(),
  );

  useEffect(() => {
    let navigationFrameId: number | null = null;

    const update = () => {
      setBrowserPath(currentBrowserPath());
    };

    const scheduleNavigationEvent = (action: NavigationEventAction) => {
      if (navigationFrameId !== null) {
        return;
      }

      navigationFrameId = window.requestAnimationFrame(() => {
        navigationFrameId = null;
        dispatchNavigationEvent(action);
      });
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      scheduleNavigationEvent("push");
      return result;
    };

    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      scheduleNavigationEvent("replace");
      return result;
    };

    const handleHashChange = () => {
      scheduleNavigationEvent("hash");
    };

    const handlePopState = () => {
      scheduleNavigationEvent("pop");
    };

    update();
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener(NAVIGATION_EVENT, update);

    return () => {
      if (navigationFrameId !== null) {
        window.cancelAnimationFrame(navigationFrameId);
      }

      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);

  return browserPath;
}

async function waitForCondition(condition: () => boolean, timeoutMs = 2500) {
  if (condition()) {
    return true;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await wait(50);
    if (condition()) {
      return true;
    }
  }

  return false;
}

async function settleUi(options?: {
  delayMs?: number;
  previousPath?: string;
  targetPath?: string;
}) {
  const isNavigationWait = Boolean(options?.targetPath || options?.previousPath);

  if (options?.targetPath) {
    await waitForCondition(() => currentBrowserPath() === options.targetPath);
  } else if (options?.previousPath) {
    await waitForCondition(() => currentBrowserPath() !== options.previousPath);
  }

  if (isNavigationWait) {
    const renderedRouteSettled = await waitForCondition(
      () => currentRenderedRoutePath() === currentBrowserRoutePath(),
      ROUTE_RENDER_TIMEOUT_MS,
    );

    if (!renderedRouteSettled) {
      throw new Error("I could not confirm the new page finished rendering yet.");
    }
  }

  await waitForAnimationFrame();
  await wait(options?.delayMs ?? 220);
  await waitForAnimationFrame();
}

function getInternalPathFromHref(rawHref: string | null) {
  if (!rawHref) {
    return null;
  }

  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawHref.startsWith("/") || rawHref.startsWith("#") ? rawHref : null;
  }
}

function resolveInternalPath(rawPath: string) {
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error('Use an internal ExamCooker path that starts with "/".');
  }

  const url = new URL(trimmed, window.location.origin);
  if (url.origin !== window.location.origin) {
    throw new Error("Only ExamCooker routes are allowed.");
  }

  if (url.pathname.startsWith("/api")) {
    throw new Error("API routes are not part of the navigable website.");
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function getCoursePastPapersContext(path = currentBrowserRoutePath()) {
  try {
    const url = new URL(path, window.location.origin);
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "past_papers") {
      return null;
    }

    const rawCode = segments[1];
    if (!rawCode || rawCode.toLowerCase() === "exam") {
      return null;
    }

    const code = decodeURIComponent(rawCode);
    return {
      code,
      basePath: `/past_papers/${encodeURIComponent(code)}`,
    };
  } catch {
    return null;
  }
}

function normalizeCourseExamRequest(rawExam: string) {
  return rawExam
    .trim()
    .toLowerCase()
    .replace(/\b(past\s+papers?|papers?|question\s+papers?)\b/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/[^\w-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCourseExam(rawExam: string) {
  const normalizedExam = normalizeCourseExamRequest(rawExam);
  const aliasMatch = COURSE_EXAM_REQUEST_ALIASES[normalizedExam];
  if (aliasMatch) {
    return {
      label: examTypeLabel(aliasMatch),
      slug: examTypeToSlug(aliasMatch),
    };
  }

  const slugCandidate = normalizedExam.replace(/\s+/g, "-");
  const directSlugMatch = examSlugToType(slugCandidate);
  if (directSlugMatch) {
    return {
      label: examTypeLabel(directSlugMatch),
      slug: examTypeToSlug(directSlugMatch),
    };
  }

  throw new Error(
    'I could not match that exam type. Try CAT-1, CAT-2, FAT, Model CAT-1, Model CAT-2, Model FAT, Mid, Quiz, CIA, or Other.',
  );
}

function buildCourseExamFilterPath(basePath: string, examSlug: string) {
  const currentUrl = new URL(window.location.href);
  const searchParams =
    currentUrl.pathname === basePath
      ? new URLSearchParams(currentUrl.search)
      : new URLSearchParams();

  searchParams.set("exam", examSlug);
  searchParams.delete("page");

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function getOpenPdfView(): VoiceOpenPdfView | null {
  const activePdf = getActivePdfSnapshot();
  if (!activePdf) {
    return null;
  }

  return {
    currentPage: activePdf.currentPage,
    fileName: activePdf.fileName,
    totalPages: activePdf.totalPages,
  };
}

function buildPageContextMessage(snapshot: VoiceGuideSnapshot) {
  const parts = [
    `Current page title: ${snapshot.title || "ExamCooker"}.`,
    `Current path: ${snapshot.path}.`,
  ];

  if (snapshot.headings.length > 0) {
    parts.push(`Visible headings: ${snapshot.headings.join(" | ")}.`);
  }

  if (snapshot.openPdf) {
    parts.push(
      `Open PDF: ${snapshot.openPdf.fileName}, page ${snapshot.openPdf.currentPage} of ${snapshot.openPdf.totalPages}.`,
    );
    parts.push(
      "Use inspect_open_pdf or answer_question_about_open_pdf for document questions.",
    );
  }

  const coursePastPapersContext = getCoursePastPapersContext(snapshot.path);
  if (coursePastPapersContext) {
    parts.push(
      `Course past papers page for ${coursePastPapersContext.code}. Use filter_course_papers_by_exam for requests like CAT-1 or FAT collections.`,
    );
  }

  parts.push("Use inspect_current_view if you need the live list of visible controls.");
  return parts.join(" ");
}

export function useVoiceAgent() {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error("useVoiceAgent must be used inside VoiceAgentProvider.");
  }

  return context;
}

export default function VoiceAgentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const browserPath = useBrowserPath();
  const [controller] = useState(() =>
    createVoiceControlController({
      activationMode: "vad",
      auth: { sessionEndpoint: "/api/realtime/session" },
      instructions: "Voice guide is preparing.",
      model: "gpt-realtime-mini",
      outputMode: "audio",
      postToolResponse: true,
      tools: [],
    }),
  );
  const [lastError, setLastError] = useState<string | null>(null);
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

    const response = await fetch("/api/realtime/pdf-answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPage: activePdf.currentPage,
        fileName: activePdf.fileName,
        fileUrl: new URL(activePdf.fileUrl, window.location.origin).toString(),
        question,
        title: document.title,
        totalPages: activePdf.totalPages,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          answer?: unknown;
          error?: unknown;
        }
      | null;

    if (!response.ok) {
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : "Unable to answer that PDF question right now.",
      );
    }

    if (typeof payload?.answer !== "string" || !payload.answer.trim()) {
      throw new Error("The PDF answer service returned an empty answer.");
    }

    return {
      answer: payload.answer.trim(),
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
          "Answer a question about the currently open ExamCooker PDF. Use this whenever the user asks about the contents of a past paper, notes PDF, syllabus PDF, or another open document.",
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
              addTransitionType("filter-results");
              router.replace(nextPath);
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
              router.push(nextPath);
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
      router,
      run,
    ],
  );

  const controllerOptions = useMemo<UseVoiceControlOptions>(
    () => ({
      activationMode: "vad",
      audio: {
        output: {
          voice: DEFAULT_VOICE,
        },
      },
      auth: { sessionEndpoint: "/api/realtime/session" },
      instructions: VOICE_GUIDE_INSTRUCTIONS,
      maxOutputTokens: 400,
      model: "gpt-realtime-mini",
      onError: (error) => {
        setLastError(error.message);
        toast({
          title: "Voice guide unavailable",
          description: error.message,
          variant: "destructive",
        });
      },
      outputMode: "audio",
      postToolResponse: true,
      tools,
    }),
    [tools],
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
      controller.sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildPageContextMessage(snapshot),
            },
          ],
        },
      });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [browserPath, controller, getFreshSnapshot, runtime.connected]);

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

    void controller.connect();
  }, [controller, hide, runtime.activity, runtime.connected]);

  const dismissLastError = useCallback(() => {
    setLastError(null);
  }, []);

  const toggleVoiceAgent = useCallback(() => {
    if (runtime.connected || runtime.activity === "connecting") {
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
