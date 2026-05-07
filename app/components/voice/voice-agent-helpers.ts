"use client";

import { useEffect, useState } from "react";
import {
  examSlugToType,
  examTypeLabel,
  examTypeToSlug,
} from "@/lib/exam-slug";
import { getAliasCourseCodes } from "@/lib/course-aliases";
import { normalizeCourseCode } from "@/lib/course-tags";
import { getActivePdfSnapshot } from "./pdf-voice-context";
import {
  NAVIGATION_EVENT,
  currentBrowserPath,
  currentBrowserRoutePath,
  currentRenderedRoutePath,
} from "./voice-navigation";
import type { VoicePageSnapshot } from "./voice-dom";

export const MAX_VISIBLE_CONTROLS = 48;
export const VOICE_SESSION_MAX_MS = 3 * 60 * 1000;
export const DEFAULT_VOICE = "sage" as const;

const ROUTE_RENDER_TIMEOUT_MS = 5000;
const COURSE_CODE_PATTERN = /[A-Z]{2,7}\s?\d{2,5}[A-Z]{0,3}/i;
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
export type NavigationEventDetail = {
  action: NavigationEventAction;
  path: string;
};

export const VOICE_GUIDE_INSTRUCTIONS = `You are ExamCooker's voice guide for this website.

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
- Use navigate_to_course_past_papers when the user asks for a particular course's past papers, such as "open BCSE302L papers", "DBMS past papers", or "show FAT papers for CSE1001".
- On a course past papers page like "/past_papers/CSE1001", use filter_course_papers_by_exam for requests such as "open CAT-1 papers" or "open FAT papers".
- Use inspect_current_view before a multi-step interaction or when the page may have changed.
- Use activate_control and fill_input only with control IDs returned by inspect_current_view.
- If an ExamCooker PDF is open and the user asks about its contents, use answer_question_about_open_pdf with the user's question.
- If the user says "this question", "that question", "this page", or similar while a PDF is open, treat it as a question about the currently visible PDF page and use answer_question_about_open_pdf.
- Use inspect_open_pdf for page-number or document-status questions.
- Use go_to_pdf_page when the user asks to jump to a PDF page.
- Do not guess what a PDF says without using the PDF tools.
- Prefer tools over narration when the user asks you to move around the site or interact with it.
- Keep spoken replies very brief and action-oriented.
- For navigation, filtering, clicking, scrolling, or opening papers, reply with at most 10 words.
- Do not read out full past paper titles, paths, or long metadata unless the user explicitly asks for those details or they are required to disambiguate between two visible options.
- For PDF answers, say the answer directly in 1-3 short sentences. Do not explain that you used a tool and do not say you cannot read the PDF unless the PDF tool fails.
- Only give a longer explanation when the user explicitly asks for detail.
- If something is ambiguous or missing, ask one short clarifying question.`;

export type VoiceOpenPdfView = {
  currentPage: number;
  fileName: string;
  totalPages: number;
};

export type VoiceGuideSnapshot = VoicePageSnapshot & {
  openPdf: VoiceOpenPdfView | null;
};

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

export function useBrowserPath() {
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

export async function waitForCondition(condition: () => boolean, timeoutMs = 2500) {
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

export async function settleUi(options?: {
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

export function getInternalPathFromHref(rawHref: string | null) {
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

export function resolveInternalPath(rawPath: string) {
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

export function getCoursePastPapersContext(path = currentBrowserRoutePath()) {
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

function cleanCourseRequest(rawCourse: string) {
  return rawCourse
    .trim()
    .replace(/\b(past\s+papers?|papers?|question\s+papers?|course|subject|for|of|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCourseCodeForNavigation(rawCourse: string) {
  const cleanedCourse = cleanCourseRequest(rawCourse);
  if (!cleanedCourse) {
    throw new Error("Tell me which course to open.");
  }

  const codeMatch = cleanedCourse.match(COURSE_CODE_PATTERN);
  if (codeMatch) {
    return normalizeCourseCode(codeMatch[0]);
  }

  const aliasMatches = getAliasCourseCodes(cleanedCourse);
  if (aliasMatches.length === 1) {
    return aliasMatches[0];
  }

  if (aliasMatches.length > 1) {
    throw new Error(
      `That course name matches multiple codes: ${aliasMatches.join(", ")}. Which one should I open?`,
    );
  }

  const compactCandidate = normalizeCourseCode(cleanedCourse);
  if (COURSE_CODE_PATTERN.test(compactCandidate)) {
    return compactCandidate;
  }

  throw new Error("I need a course code or a clearer course alias to open past papers.");
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

export function resolveCourseExam(rawExam: string) {
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
    "I could not match that exam type. Try CAT-1, CAT-2, FAT, Model CAT-1, Model CAT-2, Model FAT, Mid, Quiz, CIA, or Other.",
  );
}

export function buildCourseExamFilterPath(basePath: string, examSlug: string) {
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

export function buildCoursePastPapersPath(courseCode: string, exam?: string | null) {
  const basePath = `/past_papers/${encodeURIComponent(courseCode)}`;
  if (!exam?.trim()) {
    return {
      exam: null,
      path: basePath,
    };
  }

  const resolvedExam = resolveCourseExam(exam);
  return {
    exam: resolvedExam.label,
    path: buildCourseExamFilterPath(basePath, resolvedExam.slug),
  };
}

export function getOpenPdfView(): VoiceOpenPdfView | null {
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

export function buildPageContextMessage(snapshot: VoiceGuideSnapshot) {
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
