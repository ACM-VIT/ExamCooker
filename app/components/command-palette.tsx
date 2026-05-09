"use client";

import React, {
  Activity,
  addTransitionType,
  startTransition,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { useAgent } from "agents/react";
import { usePathname, useRouter } from "next/navigation";
import {
  invalidateAuthSessionCache,
  useGuestPrompt,
} from "@/app/components/auth-gate";
import {
  getCommandCatalogAction,
  getCommandSessionAction,
  rememberCommandPreferenceAction,
  resolveCommandIntentAction,
} from "@/app/actions/command";
import {
  loadCourseVisitRecords,
  subscribeToCourseVisitChanges,
  type CourseVisitRecord,
} from "@/app/components/past_papers/course-visit-ranking";
import { getAliasCourseCodes } from "@/lib/course-aliases";
import {
  getCommandActionCapability,
  type CommandActionCapability,
  type CommandGeneratedAction,
  type CommandSurfaceContext,
} from "@/lib/command/actions";
import {
  isCommandResourceQueryTerm,
  normalizeCommandSearch,
  resolveCommandIntent,
  type CommandIntent,
  type CommandResourceIntent,
} from "@/lib/command/intent";
import { normalizeCourseCode } from "@/lib/course-tags";
import { examTypeLabel, examTypeToSlug } from "@/lib/exam-slug";
import { captureUserSignedOut } from "@/lib/posthog/client";
import { POSTHOG_FEATURE_FLAGS } from "@/lib/posthog/shared";
import { usePostHogFeatureFlagEnabled } from "@/lib/posthog/use-feature-flag-enabled";
import {
  getCourseExamPath,
  getCourseNotesPath,
  getCoursePastPapersPath,
  getCourseSyllabusPath,
  getExamHubPath,
} from "@/lib/seo";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CommandCourse = {
  id: string;
  code: string;
  title: string;
  aliases: string[];
  paperCount: number;
  noteCount: number;
  syllabusId: string | null;
};

type CommandPaper = {
  id: string;
  title: string;
  courseCode: string | null;
  courseTitle: string | null;
  examType: string | null;
  slot: string | null;
  year: number | null;
  href: string;
};

type CourseResponse = {
  courses: CommandCourse[];
  recentPapers: CommandPaper[];
};

type CommandAction = {
  id: string;
  title: string;
  meta: string;
  href?: string;
  tone?: string;
  keywords?: string[];
  courseCode?: string;
  courseTitle?: string;
  resource?: CommandResourceIntent;
  capability?: CommandActionCapability;
  generatedAction?: CommandGeneratedAction;
};

type CommandCoursePreference = {
  courseCode: string;
  courseTitle: string | null;
  resource: CommandResourceIntent | null;
  weight: number;
  updatedAt: number;
};

type CommandIntentResponse = {
  intent: CommandIntent;
  courseQuery: string | null;
  actions: CommandGeneratedAction[];
  preferences: CommandCoursePreference[];
  source: "cloudflare-agent" | "local";
  resolver?: "openai" | "local" | "semantic-cache";
  transport?: "websocket" | "http" | "local";
};

type CommandAgentState = {
  requests: number;
  lastQuery: string | null;
  lastIntent: CommandIntent | null;
  lastCourseQuery: string | null;
  lastResolver: "openai" | "local" | "semantic-cache" | null;
  updatedAt: string | null;
};

type CommandAgentIntentInput = {
  query: string;
  preferenceQuery: string;
  userKey: string;
  userToken: string;
  surfaceContext: Partial<CommandSurfaceContext>;
};

type CommandAgentPreferenceInput = {
  query: string;
  courseCode: string;
  courseTitle: string;
  resource: CommandResourceIntent | null;
  userKey: string;
  userToken: string;
};

type CommandUserContextResponse = {
  userKey: string;
  userToken: string | null;
  surfaceContext: Pick<
    CommandSurfaceContext,
    "authenticated" | "role"
  >;
};

type RecentCourseCandidate = {
  course: CommandCourse;
  record: CourseVisitRecord;
};

const COMMAND_PALETTE_MEDIA_QUERY = "(min-width: 768px)";
const COMMAND_AGENT_HOST =
  process.env.NEXT_PUBLIC_CLOUDFLARE_COMMAND_AGENT_HOST?.trim() || "";
const COMMAND_AGENT_NAME =
  process.env.NEXT_PUBLIC_CLOUDFLARE_COMMAND_AGENT_NAME?.trim() ||
  "ExamCookerCommandAgent";
const COMMAND_AGENT_INSTANCE =
  process.env.NEXT_PUBLIC_CLOUDFLARE_COMMAND_AGENT_INSTANCE?.trim() ||
  "global";
const COMMAND_AGENT_READY_TIMEOUT_MS = 3_500;
const COMMAND_AGENT_INTENT_TIMEOUT_MS = 9_000;
const COMMAND_AGENT_PREFERENCE_TIMEOUT_MS = 5_000;

const GENERAL_RESOURCE_QUERIES = new Set([
  "not",
  "note",
  "notes",
  "lec",
  "lecture",
  "study material",
  "syl",
  "sylla",
  "syllab",
  "syllabus",
  "course outline",
  "pap",
  "paper",
  "papers",
  "past papers",
  "pyq",
  "question paper",
  "question papers",
  "cat 1",
  "cat1",
  "cat 2",
  "cat2",
  "fat",
  "mid",
  "quiz",
  "cia",
]);

const FALLBACK_ACTIONS: CommandAction[] = [
  {
    id: "fallback:papers",
    title: "Open past papers",
    meta: "Browse by course or exam",
    href: "/past_papers",
    tone: "Papers",
    keywords: ["past papers", "pyq", "question papers"],
  },
  {
    id: "fallback:notes",
    title: "Open notes",
    meta: "Course notes and study material",
    href: "/notes",
    tone: "Notes",
    keywords: ["notes", "study material"],
  },
  {
    id: "fallback:syllabus",
    title: "Open syllabus",
    meta: "Course syllabus PDFs",
    href: "/syllabus",
    tone: "Syllabus",
    keywords: ["syllabus", "course outline"],
  },
];

const COURSE_QUERY_STOP_TERMS = new Set([
  "a",
  "an",
  "and",
  "course",
  "courses",
  "find",
  "for",
  "get",
  "in",
  "me",
  "of",
  "open",
  "please",
  "show",
  "the",
  "to",
  "with",
]);

const COMMAND_QUERY_TERMS = new Set([
  "answer",
  "cat",
  "cia",
  "curr",
  "curriculum",
  "exam",
  "exams",
  "fat",
  "final",
  "key",
  "lec",
  "lecture",
  "lectures",
  "mat",
  "material",
  "materials",
  "mid",
  "model",
  "not",
  "note",
  "notes",
  "outl",
  "outline",
  "pap",
  "paper",
  "papers",
  "past",
  "prev",
  "pyq",
  "ques",
  "question",
  "questions",
  "quiz",
  "quizzes",
  "rev",
  "revision",
  "sample",
  "sem",
  "sol",
  "solutions",
  "study",
  "syl",
  "sylla",
  "syllab",
  "syllabi",
  "syllabus",
  "unit",
  "units",
  "year",
]);

const COMMAND_PHRASES = [
  "answer key",
  "course notes",
  "course outline",
  "end sem",
  "final assessment",
  "mid sem",
  "model cat 1",
  "model cat 2",
  "model fat",
  "past papers",
  "question paper",
  "question papers",
  "study material",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function resolveIntentWithServerFallback(input: CommandAgentIntentInput) {
  return resolveCommandIntentAction({
    query: input.query,
    preferenceQuery: input.preferenceQuery,
    surfaceContext: input.surfaceContext,
  });
}

async function rememberPreferenceWithServerFallback(
  input: CommandAgentPreferenceInput,
) {
  await rememberCommandPreferenceAction({
    query: input.query,
    courseCode: input.courseCode,
    courseTitle: input.courseTitle,
    resource: input.resource,
  });
}

function getCourseSearchText(query: string) {
  let normalized = normalizeCommandSearch(query);

  for (const phrase of COMMAND_PHRASES) {
    normalized = ` ${normalized} `.replace(
      new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "g"),
      " ",
    );
  }

  return normalized
    .split(" ")
    .filter((term) => {
      if (!term) return false;
      if (COURSE_QUERY_STOP_TERMS.has(term)) return false;
      if (COMMAND_QUERY_TERMS.has(term)) return false;
      if (isCommandResourceQueryTerm(term)) return false;
      if (/^\d+$/.test(term)) return false;
      return true;
    })
    .join(" ")
    .trim();
}

function scoreCourse(course: CommandCourse, query: string, aliasCodes: Set<string>) {
  const trimmed = query.trim();
  if (!trimmed) return Number.POSITIVE_INFINITY;

  const normalizedCode = normalizeCourseCode(trimmed);
  const code = course.code.toUpperCase();
  const normalizedQuery = normalizeCommandSearch(trimmed);
  const haystack = normalizeCommandSearch(
    [
      course.code,
      course.title,
      course.aliases.join(" "),
    ].join(" "),
  );
  const normalizedTitle = normalizeCommandSearch(course.title);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const matchesAllTerms = terms.every((term) => haystack.includes(term));

  if (code === normalizedCode) return 0;
  if (code.startsWith(normalizedCode)) return 1;
  if (aliasCodes.has(code)) return 2;
  if (normalizedTitle === normalizedQuery) return 3;
  if (normalizedTitle.startsWith(normalizedQuery)) return 4;
  if (matchesAllTerms) return 4;
  if (haystack.includes(normalizedQuery)) return 5;

  return Number.POSITIVE_INFINITY;
}

function getPreferenceWeight(
  course: CommandCourse,
  preferences: CommandCoursePreference[],
) {
  const code = course.code.toUpperCase();
  return preferences
    .filter((preference) => preference.courseCode.toUpperCase() === code)
    .reduce((total, preference) => total + preference.weight, 0);
}

function getPreferenceUpdatedAt(
  course: CommandCourse,
  preferences: CommandCoursePreference[],
) {
  const code = course.code.toUpperCase();
  return preferences
    .filter((preference) => preference.courseCode.toUpperCase() === code)
    .reduce((latest, preference) => Math.max(latest, preference.updatedAt), 0);
}

function getCourseFamilyKey(course: CommandCourse) {
  return normalizeCommandSearch(course.title) || course.code.toUpperCase();
}

function compareRecentCourseCandidates(
  a: RecentCourseCandidate,
  b: RecentCourseCandidate,
) {
  return (
    b.record.lastVisitedAt - a.record.lastVisitedAt ||
    b.record.count - a.record.count ||
    a.course.code.localeCompare(b.course.code, "en", { sensitivity: "base" })
  );
}

function isRecentCourseCandidate(
  candidate: RecentCourseCandidate | null,
): candidate is RecentCourseCandidate {
  return candidate !== null;
}

function getDedupedRecentCourseCandidates(
  courses: CommandCourse[],
  visitRecords: Record<string, CourseVisitRecord>,
  limit: number,
) {
  const coursesByCode = new Map(
    courses.map((course) => [course.code.toUpperCase(), course]),
  );
  const seenCourseFamilies = new Set<string>();

  return Object.entries(visitRecords)
    .map<RecentCourseCandidate | null>(([code, record]) => {
      const course = coursesByCode.get(code.toUpperCase());
      return course ? { course, record } : null;
    })
    .filter(isRecentCourseCandidate)
    .sort(compareRecentCourseCandidates)
    .filter(({ course }) => {
      const key = getCourseFamilyKey(course);
      if (seenCourseFamilies.has(key)) return false;
      seenCourseFamilies.add(key);
      return true;
    })
    .slice(0, limit);
}

function dedupeCommandActions(actions: CommandAction[]) {
  const seen = new Set<string>();

  return actions.filter((action) => {
    const key = action.href || action.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGeneratedAction(
  action: CommandGeneratedAction,
  surfaceContext: CommandSurfaceContext,
): CommandAction | null {
  const capability = getCommandActionCapability(
    action.capabilityId,
    surfaceContext,
  );
  if (!capability) return null;

  return {
    id: `agent:${capability.id}`,
    title: action.title.trim() || capability.title,
    meta: action.meta.trim() || capability.description,
    href: capability.href,
    tone: action.tone.trim() || capability.tone,
    keywords: [...capability.keywords],
    capability,
    generatedAction: action,
  };
}

function doesPaperMatch(paper: CommandPaper, query: string) {
  const normalizedQuery = normalizeCommandSearch(query);
  if (!normalizedQuery) return false;
  const haystack = normalizeCommandSearch(
    [
      paper.title,
      paper.courseCode,
      paper.courseTitle,
      paper.examType,
      paper.slot,
      paper.year,
      "paper past paper pyq question",
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function isGeneralResourceQuery(query: string) {
  const normalized = normalizeCommandSearch(query);
  if (!normalized) return false;

  const intent = resolveCommandIntent(normalized);
  return (
    GENERAL_RESOURCE_QUERIES.has(normalized) ||
    (intent.resource !== null &&
      intent.resource !== "course" &&
      getCourseSearchText(normalized).length === 0)
  );
}

function getAvailableResources(course: CommandCourse): CommandResourceIntent[] {
  const resources: CommandResourceIntent[] = [];
  if (course.paperCount > 0) resources.push("papers");
  if (course.noteCount > 0) resources.push("notes");
  if (course.syllabusId) resources.push("syllabus");
  return resources;
}

function getResourceLabel(resource: CommandResourceIntent) {
  if (resource === "notes") return "notes";
  if (resource === "syllabus") return "syllabus";
  if (resource === "papers") return "papers";
  return "course";
}

function getAvailabilitySummary(course: CommandCourse, excluded?: CommandResourceIntent) {
  const labels = getAvailableResources(course)
    .filter((resource) => resource !== excluded)
    .map(getResourceLabel);

  if (labels.length === 0) return "No catalog items available";
  if (labels.length === 1) return `${labels[0]} available`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]} available`;
}

function isCommandAction(action: CommandAction | null): action is CommandAction {
  return action !== null;
}

function buildCourseAction(
  course: CommandCourse,
  resource: CommandResourceIntent,
  intent: CommandIntent,
): CommandAction | null {
  if (resource === "notes") {
    if (course.noteCount <= 0) return null;
    return {
      id: `course:${course.code}:notes`,
      title: `Open notes for ${course.title}`,
      meta: course.code,
      href: getCourseNotesPath(course.code),
      tone: "Notes",
      keywords: [course.code, course.title, ...course.aliases, "notes"],
      courseCode: course.code,
      courseTitle: course.title,
      resource: "notes",
    } satisfies CommandAction;
  }

  if (resource === "syllabus") {
    if (!course.syllabusId) return null;
    return {
      id: `course:${course.code}:syllabus`,
      title: `Open syllabus for ${course.title}`,
      meta: course.code,
      href: getCourseSyllabusPath(course.code),
      tone: "Syllabus",
      keywords: [course.code, course.title, ...course.aliases, "syllabus"],
      courseCode: course.code,
      courseTitle: course.title,
      resource: "syllabus",
    } satisfies CommandAction;
  }

  if (course.paperCount <= 0) return null;
  const examLabel = intent.examType ? examTypeLabel(intent.examType) : null;
  const href = intent.examType
    ? getCourseExamPath(course.code, examTypeToSlug(intent.examType))
    : getCoursePastPapersPath(course.code);

  return {
    id: `course:${course.code}:papers:${intent.examType ?? "all"}`,
    title: `Open ${examLabel ? `${examLabel} ` : ""}papers for ${course.title}`,
    meta: course.code,
    href,
    tone: examLabel ?? "Papers",
    keywords: [course.code, course.title, ...course.aliases, "papers", "pyq"],
    courseCode: course.code,
    courseTitle: course.title,
    resource: "papers",
  } satisfies CommandAction;
}

function buildActionsForCourse(course: CommandCourse, intent: CommandIntent) {
  if (intent.resource && intent.resource !== "course") {
    const action = buildCourseAction(course, intent.resource, intent);
    return action ? [action] : [];
  }

  return getAvailableResources(course)
    .slice(0, 3)
    .map((resource) => buildCourseAction(course, resource, intent))
    .filter(isCommandAction);
}

function buildGeneralIntentActions(intent: CommandIntent, query: string) {
  const normalized = normalizeCommandSearch(query);
  if (!normalized) return [];

  if (intent.resource === "notes") {
    return [FALLBACK_ACTIONS[1]];
  }

  if (intent.resource === "syllabus") {
    return [FALLBACK_ACTIONS[2]];
  }

  if (intent.resource === "papers") {
    if (intent.examType) {
      const label = examTypeLabel(intent.examType);
      return [
        {
          id: `fallback:exam:${intent.examType}`,
          title: `Open ${label} papers`,
          meta: "All matching courses",
          href: getExamHubPath(examTypeToSlug(intent.examType)),
          tone: label,
          keywords: [label, "papers", "pyq"],
        } satisfies CommandAction,
      ];
    }
    return [FALLBACK_ACTIONS[0]];
  }

  return [];
}

function ActionRow({
  action,
  onSelect,
}: {
  action: CommandAction;
  onSelect: (action: CommandAction) => void;
}) {
  return (
    <Command.Item
      value={action.id}
      keywords={action.keywords}
      onSelect={() => onSelect(action)}
      className="flex min-h-[3.1rem] cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors data-[selected=true]:bg-[#DDEFF4] dark:data-[selected=true]:bg-white/[0.09]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-black dark:text-[#F3F7FA]">
          {action.title}
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-black/58 dark:text-white/60">
          {action.meta}
        </span>
      </span>
      {action.tone ? (
        <span className="shrink-0 rounded border border-black/12 px-2 py-0.5 text-[11px] font-semibold text-black/55 dark:border-white/14 dark:text-white/58">
          {action.tone}
        </span>
      ) : null}
    </Command.Item>
  );
}

function UnavailableCourseRow({
  course,
  resource,
}: {
  course: CommandCourse;
  resource: CommandResourceIntent;
}) {
  return (
    <div className="mx-1 mb-1 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.045]">
      <div className="text-sm font-semibold text-black dark:text-[#F3F7FA]">
        No {getResourceLabel(resource)} for {course.title}
      </div>
      <div className="mt-1 text-xs font-medium text-black/55 dark:text-white/58">
        {course.code} · {getAvailabilitySummary(course, resource)}
      </div>
    </div>
  );
}

function PaperRow({
  paper,
  onSelect,
}: {
  paper: CommandPaper;
  onSelect: (href: string) => void;
}) {
  const meta = [
    paper.courseCode,
    paper.examType?.replaceAll("_", " "),
    paper.slot,
    paper.year,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Command.Item
      value={`paper:${paper.id}`}
      keywords={[
        paper.title,
        paper.courseCode ?? "",
        paper.courseTitle ?? "",
        paper.examType ?? "",
        paper.slot ?? "",
        String(paper.year ?? ""),
      ]}
      onSelect={() => onSelect(paper.href)}
      className="flex min-h-[3.1rem] cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors data-[selected=true]:bg-[#DDEFF4] dark:data-[selected=true]:bg-white/[0.09]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-black dark:text-[#F3F7FA]">
          {paper.title}
        </span>
        <span className="mt-1 block truncate text-xs capitalize text-black/58 dark:text-white/60">
          {meta || "Past paper"}
        </span>
      </span>
      <span className="shrink-0 rounded border border-black/12 px-2 py-0.5 text-[11px] font-semibold text-black/55 dark:border-white/14 dark:text-white/58">
        Paper
      </span>
    </Command.Item>
  );
}

function CommandSuspenseFallback({
  label,
}: {
  label: "Searching" | "Keep typing";
}) {
  return (
    <div
      data-command-fallback
      className="flex h-full min-h-[13.5rem] flex-col justify-between px-1 py-1"
      aria-live="polite"
    >
      <div className="flex items-center justify-between border-b border-[#D7E4E8] px-2 pb-2 dark:border-white/10">
        <span className="text-xs font-semibold text-black/58 dark:text-white/58">
          {label}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2.5 py-3">
        <div className="rounded-md bg-[#EEF6F8] px-3 py-2.5 dark:bg-white/[0.045]">
          <div className="h-2.5 w-7/12 rounded-full bg-black/[0.12] dark:bg-white/[0.14]" />
          <div className="mt-2 h-2 w-4/12 rounded-full bg-black/[0.08] dark:bg-white/[0.10]" />
        </div>
        <div className="rounded-md bg-[#F4FAFB] px-3 py-2.5 dark:bg-white/[0.03]">
          <div className="h-2.5 w-8/12 rounded-full bg-black/[0.09] dark:bg-white/[0.11]" />
          <div className="mt-2 h-2 w-5/12 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
        </div>
        <div className="rounded-md bg-[#F7FBFC] px-3 py-2.5 dark:bg-white/[0.025]">
          <div className="h-2.5 w-6/12 rounded-full bg-black/[0.07] dark:bg-white/[0.09]" />
          <div className="mt-2 h-2 w-3/12 rounded-full bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
      </div>
    </div>
  );
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [isSupportedViewport, setIsSupportedViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(COMMAND_PALETTE_MEDIA_QUERY);
    const updateSupport = () => {
      setIsSupportedViewport(media.matches);
      if (!media.matches) {
        onOpenChange(false);
      }
    };

    updateSupport();
    media.addEventListener("change", updateSupport);
    return () => media.removeEventListener("change", updateSupport);
  }, [onOpenChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSupportedViewport) return;
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      onOpenChange(!open);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSupportedViewport, onOpenChange, open]);

  if (!isSupportedViewport) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <CommandPaletteSession open={open} onOpenChange={onOpenChange} />
    </Dialog.Root>
  );
}

function CommandPaletteSession({
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthed, status: authStatus } = useGuestPrompt();
  const voiceAgentEnabled =
    usePostHogFeatureFlagEnabled(POSTHOG_FEATURE_FLAGS.voiceAgent) ?? false;
  const isCommandAgentConfigured = COMMAND_AGENT_HOST.length > 0;
  const commandAgent = useAgent<CommandAgentState>({
    host: COMMAND_AGENT_HOST,
    agent: COMMAND_AGENT_NAME,
    name: COMMAND_AGENT_INSTANCE,
    enabled: isCommandAgentConfigured,
  });
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState<CommandCourse[]>([]);
  const [recentPapers, setRecentPapers] = useState<CommandPaper[]>([]);
  const [visitRecords, setVisitRecords] = useState<Record<string, CourseVisitRecord>>({});
  const [agentIntent, setAgentIntent] = useState<CommandIntent | null>(null);
  const [agentCourseSearchText, setAgentCourseSearchText] = useState("");
  const [agentActions, setAgentActions] = useState<CommandGeneratedAction[]>([]);
  const [commandPreferences, setCommandPreferences] = useState<
    CommandCoursePreference[]
  >([]);
  const [commandUserContext, setCommandUserContext] =
    useState<CommandUserContextResponse | null>(null);
  const [intentStatus, setIntentStatus] = useState<"idle" | "loading" | "settled">(
    "idle",
  );
  const [courseStatus, setCourseStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (open) return;

    setSearch("");
    setAgentIntent(null);
    setAgentCourseSearchText("");
    setAgentActions([]);
    setCommandPreferences([]);
    setIntentStatus("idle");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (courseStatus !== "idle") return;

    setCourseStatus("loading");

    void getCommandCatalogAction()
      .then((payload) => {
        setCourses(payload.courses as CourseResponse["courses"]);
        setRecentPapers(payload.recentPapers as CourseResponse["recentPapers"]);
        setCourseStatus("ready");
      })
      .catch(() => {
        setCourseStatus("error");
      });
  }, [courseStatus, open]);

  useEffect(() => {
    if (!open) return;

    const refreshVisits = () => setVisitRecords(loadCourseVisitRecords());
    refreshVisits();
    return subscribeToCourseVisitChanges(refreshVisits);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void getCommandSessionAction()
      .then((payload) => {
        if (!cancelled) setCommandUserContext(payload);
      })
      .catch(() => {
        if (!cancelled) setCommandUserContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, isAuthed, open]);

  const trimmedSearch = search.trim();
  const hasSearch = trimmedSearch.length > 0;
  const localIntent = useMemo(
    () => resolveCommandIntent(trimmedSearch),
    [trimmedSearch],
  );
  const intent = agentIntent ?? localIntent;
  const localCourseSearchText = useMemo(
    () => getCourseSearchText(trimmedSearch),
    [trimmedSearch],
  );
  const courseSearchText = agentCourseSearchText || localCourseSearchText;
  const surfaceContext = useMemo<CommandSurfaceContext>(
    () => ({
      query: trimmedSearch,
      currentPath: pathname,
      authenticated:
        commandUserContext?.surfaceContext.authenticated ??
        (authStatus === "loading" ? null : isAuthed),
      role: commandUserContext?.surfaceContext.role ?? null,
      voiceAgentEnabled,
    }),
    [authStatus, commandUserContext, isAuthed, pathname, trimmedSearch, voiceAgentEnabled],
  );
  const commandUserKey = commandUserContext?.userKey ?? "";
  const commandUserToken = commandUserContext?.userToken ?? "";

  useEffect(() => {
    if (!hasSearch) {
      setAgentIntent(null);
      setAgentCourseSearchText("");
      setAgentActions([]);
      setCommandPreferences([]);
      setIntentStatus("idle");
      return;
    }

    let cancelled = false;
    setIntentStatus("loading");
    const timeout = window.setTimeout(() => {
      const input: CommandAgentIntentInput = {
        query: trimmedSearch,
        preferenceQuery: localCourseSearchText || trimmedSearch,
        userKey: commandUserKey,
        userToken: commandUserToken,
        surfaceContext,
      };

      const intentRequest = isCommandAgentConfigured && commandUserKey && commandUserToken
        ? withTimeout(
            commandAgent.ready,
            COMMAND_AGENT_READY_TIMEOUT_MS,
            "Command agent WebSocket",
          )
            .then(() =>
              commandAgent.call<CommandIntentResponse>(
                "resolveIntent",
                [input],
                { timeout: COMMAND_AGENT_INTENT_TIMEOUT_MS },
              ),
            )
            .then((payload) => ({
              ...payload,
              transport: "websocket" as const,
            }))
            .catch(() => resolveIntentWithServerFallback(input))
        : resolveIntentWithServerFallback(input);

      void intentRequest
        .then((payload) => {
          if (cancelled) return;
          setAgentIntent(payload.intent);
          setAgentCourseSearchText(payload.courseQuery?.trim() ?? "");
          setAgentActions(payload.actions ?? []);
          setCommandPreferences(payload.preferences ?? []);
          setIntentStatus("settled");
        })
        .catch(() => {
          if (cancelled) return;
          setAgentIntent(null);
          setAgentCourseSearchText("");
          setAgentActions([]);
          setCommandPreferences([]);
          setIntentStatus("settled");
        });
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    commandAgent,
    commandUserToken,
    commandUserKey,
    hasSearch,
    isCommandAgentConfigured,
    localCourseSearchText,
    surfaceContext,
    trimmedSearch,
  ]);

  const courseMatches = useMemo(() => {
    const courseQuery =
      courseSearchText || (intent.resource === "course" ? trimmedSearch : "");
    if (courseStatus !== "ready") return [];
    if (!courseQuery || isGeneralResourceQuery(trimmedSearch)) return [];

    const aliasCodes = new Set([
      ...getAliasCourseCodes(trimmedSearch),
      ...getAliasCourseCodes(courseQuery),
    ]);
    return courses
      .map((course) => ({
        course,
        score: scoreCourse(course, courseQuery, aliasCodes),
        preferenceWeight: getPreferenceWeight(course, commandPreferences),
        preferenceUpdatedAt: getPreferenceUpdatedAt(course, commandPreferences),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort(
        (a, b) =>
          a.score - b.score ||
          b.preferenceWeight - a.preferenceWeight ||
          b.preferenceUpdatedAt - a.preferenceUpdatedAt ||
          a.course.title.localeCompare(b.course.title, "en", {
            sensitivity: "base",
          }) ||
          a.course.code.localeCompare(b.course.code, "en", {
            sensitivity: "base",
          }),
      )
      .slice(0, 5)
      .map((entry) => entry.course);
  }, [
    commandPreferences,
    courseSearchText,
    courseStatus,
    courses,
    intent.resource,
    trimmedSearch,
  ]);

  const courseActions = useMemo(() => {
    if (!hasSearch) return [];
    return courseMatches
      .flatMap((course, index) => {
        const actions = buildActionsForCourse(course, intent);
        return intent.resource === "course" && index > 0 ? actions.slice(0, 1) : actions;
      })
      .slice(0, 5);
  }, [courseMatches, hasSearch, intent]);

  const requestedResource =
    intent.resource && intent.resource !== "course" ? intent.resource : null;

  const unavailableCourses = useMemo(() => {
    if (!requestedResource || !hasSearch || courseActions.length > 0) return [];
    return courseMatches
      .filter((course) => !buildCourseAction(course, requestedResource, intent))
      .slice(0, 1);
  }, [courseActions.length, courseMatches, hasSearch, intent, requestedResource]);

  const alternativeCourseActions = useMemo(() => {
    if (!requestedResource || !hasSearch || courseActions.length > 0) return [];

    return courseMatches
      .flatMap((course) =>
        getAvailableResources(course)
          .filter((resource) => resource !== requestedResource)
          .map((resource) => buildCourseAction(course, resource, intent))
          .filter(isCommandAction),
      )
      .slice(0, 4);
  }, [courseActions.length, courseMatches, hasSearch, intent, requestedResource]);

  const recentCourseActions = useMemo(() => {
    if (hasSearch || courseStatus !== "ready") return [];

    return getDedupedRecentCourseCandidates(courses, visitRecords, 3)
      .map<CommandAction>(({ course, record }) => {
        return {
          id: `recent:${course.code}`,
          title: `Continue ${course.title}`,
          meta: `${course.code} · ${record.lastLabel ?? "Course"}`,
          href: record.lastPath ?? getCoursePastPapersPath(course.code),
          tone: "Recent",
          keywords: [course.code, course.title, ...course.aliases],
        } satisfies CommandAction;
      })
      .slice(0, 3);
  }, [courseStatus, courses, hasSearch, visitRecords]);

  const recentIntentActions = useMemo(() => {
    if (!hasSearch || !requestedResource || courseStatus !== "ready" || courseSearchText) {
      return [];
    }

    return getDedupedRecentCourseCandidates(courses, visitRecords, 3)
      .map<CommandAction | null>(({ course }) => {
        return buildCourseAction(course, requestedResource, intent);
      })
      .filter(isCommandAction)
      .slice(0, 3);
  }, [
    courseSearchText,
    courseStatus,
    courses,
    hasSearch,
    intent,
    requestedResource,
    visitRecords,
  ]);

  const fallbackActions = useMemo(() => {
    if (hasSearch) {
      if (courseMatches.length > 0) return [];
      return buildGeneralIntentActions(intent, trimmedSearch);
    }

    const openSlots = Math.max(0, 5 - recentCourseActions.length);
    return FALLBACK_ACTIONS.slice(0, openSlots);
  }, [courseMatches.length, hasSearch, intent, recentCourseActions.length, trimmedSearch]);

  const paperMatches = useMemo(() => {
    if (!hasSearch || intent.resource !== "papers") return [];
    if (courseStatus !== "ready") return [];
    return recentPapers
      .filter((paper) => doesPaperMatch(paper, trimmedSearch))
      .slice(0, Math.max(0, 5 - courseActions.length));
  }, [courseActions.length, courseStatus, hasSearch, intent.resource, recentPapers, trimmedSearch]);

  const agentActionItems = useMemo(() => {
    if (!hasSearch) return [];
    return agentActions
      .filter((action) => action.confidence !== "low")
      .map((action) => buildGeneratedAction(action, surfaceContext))
      .filter(isCommandAction)
      .slice(0, 3);
  }, [agentActions, hasSearch, surfaceContext]);

  const visibleActions = dedupeCommandActions(
    hasSearch
      ? [
          ...agentActionItems,
          ...courseActions,
          ...alternativeCourseActions,
          ...fallbackActions,
          ...recentIntentActions,
        ]
      : [...recentCourseActions, ...fallbackActions],
  );
  const hasVisibleResults =
    visibleActions.length > 0 || paperMatches.length > 0 || unavailableCourses.length > 0;
  const shouldShowResolvingFallback =
    hasSearch &&
    !hasVisibleResults &&
    (courseStatus === "loading" || intentStatus === "loading");
  const shouldShowSoftEmptyFallback =
    hasSearch &&
    !hasVisibleResults &&
    !shouldShowResolvingFallback &&
    (courseStatus === "ready" || courseStatus === "error");

  const rememberCoursePreference = (action: CommandAction) => {
    if (!action.courseCode || !action.courseTitle) return;

    const preferenceQuery = courseSearchText || trimmedSearch;
    if (!preferenceQuery) return;

    setCommandPreferences((current) => {
      const code = action.courseCode?.toUpperCase();
      if (!code) return current;

      const now = Date.now();
      const existing = current.find(
        (preference) => preference.courseCode.toUpperCase() === code,
      );

      if (existing) {
        return current.map((preference) =>
          preference.courseCode.toUpperCase() === code
            ? {
                ...preference,
                weight: preference.weight + 1,
                updatedAt: now,
              }
            : preference,
        );
      }

      return [
        {
          courseCode: code,
          courseTitle: action.courseTitle ?? null,
          resource: action.resource ?? null,
          weight: 1,
          updatedAt: now,
        },
        ...current,
      ];
    });

    const input: CommandAgentPreferenceInput = {
      query: preferenceQuery,
      courseCode: action.courseCode,
      courseTitle: action.courseTitle,
      resource: action.resource ?? null,
      userKey: commandUserKey,
      userToken: commandUserToken,
    };

    if (!isCommandAgentConfigured || !commandUserKey || !commandUserToken) {
      void rememberPreferenceWithServerFallback(input).catch(() => undefined);
      return;
    }

    void withTimeout(
      commandAgent.ready,
      COMMAND_AGENT_READY_TIMEOUT_MS,
      "Command agent WebSocket",
    )
      .then(() =>
        commandAgent.call("recordPreference", [input], {
          timeout: COMMAND_AGENT_PREFERENCE_TIMEOUT_MS,
        }),
      )
      .catch(() => rememberPreferenceWithServerFallback(input))
      .catch(() => undefined);
  };

  const resetPaletteSession = () => {
    onOpenChange(false);
    setSearch("");
    setAgentIntent(null);
    setAgentCourseSearchText("");
    setAgentActions([]);
    setCommandPreferences([]);
  };

  const pushRoute = (href: string) => {
    if (href === pathname) return;

    startTransition(() => {
      addTransitionType(href.startsWith("/past_papers/") ? "nav-forward" : "nav-lateral");
      router.push(href);
    });
  };

  const executeGeneratedAction = (action: CommandAction) => {
    const capability = action.capability;
    if (!capability) return false;

    if (capability.requiredFeature === "voiceAgent" && !voiceAgentEnabled) {
      return false;
    }

    if (capability.kind === "event" && capability.eventName) {
      window.dispatchEvent(
        new CustomEvent(capability.eventName, {
          detail: capability.eventDetail ?? {},
        }),
      );
      return true;
    }

    if (capability.kind === "auth" && capability.authAction === "signOut") {
      captureUserSignedOut();
      invalidateAuthSessionCache();
      void import("next-auth/react").then(({ signOut }) => {
        void signOut({ callbackUrl: "/" }).finally(() => {
          invalidateAuthSessionCache();
        });
      });
      return true;
    }

    if (capability.kind === "route" && capability.href) {
      pushRoute(capability.href);
      return true;
    }

    return false;
  };

  const navigateTo = (action: CommandAction) => {
    rememberCoursePreference(action);

    resetPaletteSession();

    if (executeGeneratedAction(action)) return;
    if (action.href) pushRoute(action.href);
  };

  return (
    <Activity mode={open ? "visible" : "hidden"} name="ExamCooker command menu">
      <Dialog.Portal forceMount>
        <Dialog.Overlay
          forceMount
          className="fixed inset-0 z-[95] bg-[#19323A]/28 backdrop-blur-sm data-[state=closed]:hidden dark:bg-black/42"
        />
        <Dialog.Content
          forceMount
          className="ec-command-dialog-panel fixed left-1/2 top-1/2 z-[96] h-[min(20rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[34rem] overflow-hidden rounded-lg border border-[#BED0D7] bg-[#FBFDFE]/98 shadow-[0_24px_70px_rgba(20,54,66,0.24)] outline-none backdrop-blur-xl data-[state=closed]:hidden dark:border-white/14 dark:bg-[#11151D]/98 dark:shadow-[0_24px_90px_rgba(0,0,0,0.62)]"
        >
          <Dialog.Title className="sr-only">ExamCooker command menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search courses, notes, syllabi, and past papers.
          </Dialog.Description>
          <Command
            shouldFilter={false}
            loop
            label="ExamCooker command menu"
            className="ec-command-menu flex h-full min-h-0 flex-col bg-transparent text-black dark:text-[#D5D5D5]"
          >
            <div className="flex h-14 items-center gap-3 border-b border-[#CFDDE2] bg-white/78 px-4 dark:border-white/12 dark:bg-white/[0.04]">
              <Command.Input
                value={search}
                onValueChange={setSearch}
                autoFocus={open}
                placeholder="Search"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-black outline-none placeholder:text-black/50 dark:text-[#F3F7FA] dark:placeholder:text-white/55"
              />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close command menu"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-md px-2 text-xs font-semibold text-black/62 transition-colors hover:bg-black/[0.07] hover:text-black dark:text-white/65 dark:hover:bg-white/[0.08] dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              {requestedResource
                ? unavailableCourses.map((course) => (
                    <UnavailableCourseRow
                      key={`unavailable:${course.code}:${requestedResource}`}
                      course={course}
                      resource={requestedResource}
                    />
                  ))
                : null}

              {visibleActions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  onSelect={navigateTo}
                />
              ))}

              {paperMatches.map((paper) => (
                <PaperRow
                  key={paper.id}
                  paper={paper}
                  onSelect={(href) =>
                    navigateTo({
                      id: `paper:${paper.id}`,
                      title: paper.title,
                      meta: paper.courseCode ?? "Past paper",
                      href,
                    })
                  }
                />
              ))}

              {courseStatus === "error" && hasSearch && !shouldShowSoftEmptyFallback ? (
                <div className="mx-1 my-2 rounded-md border border-black/10 bg-white/50 px-3 py-2 text-xs text-black/55 dark:border-[#D5D5D5]/10 dark:bg-white/[0.04] dark:text-[#D5D5D5]/55">
                  Course and paper results are unavailable.
                </div>
              ) : null}

              {shouldShowResolvingFallback ? (
                <CommandSuspenseFallback label="Searching" />
              ) : null}

              {shouldShowSoftEmptyFallback ? (
                <CommandSuspenseFallback label="Keep typing" />
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Activity>
  );
}
