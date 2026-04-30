#!/usr/bin/env node

import { existsSync } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { hostname, platform } from "node:os";
import { spawn } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  clearConfig,
  getDefaultBaseUrl,
  getConfigPath,
  resolveRuntimeConfig,
  saveConfig,
  type ExamCookerConfig,
} from "./config.js";
import { ApiError, requestJson, requestRaw } from "./http.js";
import { printJson, showBanner, showHelp, truncate } from "./output.js";

const VERSION = "0.1.0";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXAM_TYPE_LABELS = {
  CAT_1: "CAT-1",
  CAT_2: "CAT-2",
  FAT: "FAT",
  MODEL_CAT_1: "Model CAT-1",
  MODEL_CAT_2: "Model CAT-2",
  MODEL_FAT: "Model FAT",
  MID: "Mid",
  QUIZ: "Quiz",
  CIA: "CIA",
  OTHER: "Other",
} as const;

const EXAM_TYPE_ORDER = Object.keys(EXAM_TYPE_LABELS) as Array<
  keyof typeof EXAM_TYPE_LABELS
>;

const SEMESTER_LABELS = {
  FALL: "Fall",
  WINTER: "Winter",
  SUMMER: "Summer",
  WEEKEND: "Weekend",
  UNKNOWN: "Unknown",
} as const;

const CAMPUS_LABELS = {
  VELLORE: "Vellore",
  CHENNAI: "Chennai",
  AP: "AP",
  BHOPAL: "Bhopal",
  BANGALORE: "Bangalore",
  MAURITIUS: "Mauritius",
} as const;

type CliExamType = keyof typeof EXAM_TYPE_LABELS;
type CliSemester = keyof typeof SEMESTER_LABELS;
type CliCampus = keyof typeof CAMPUS_LABELS;
type FlagType = "string" | "boolean";
type FlagDefinition = {
  alias?: string;
  type: FlagType;
};

type ParsedFlags = {
  values: Record<string, string | boolean>;
  positionals: string[];
};

type RuntimeConfig = Awaited<ReturnType<typeof resolveRuntimeConfig>>;

let lastRuntimeConfig: RuntimeConfig | null = null;

type CliCourse = {
  id: string;
  code: string;
  title: string;
  paperCount: number;
  noteCount: number;
};

type CliPaper = {
  id: string;
  title: string;
  pageUrl: string;
  fileUrl: string;
  examType: CliExamType | null;
  examTypeLabel: string | null;
  year: number | null;
  slot: string | null;
  semester: CliSemester | null;
  campus: CliCampus | null;
  hasAnswerKey: boolean;
  questionPaperId: string | null;
  course: { code: string | null; title: string | null } | null;
};

type CliPaperDetail = CliPaper & {
  author: { name: string | null };
  tags: Array<{ id: string; name: string }>;
  siblingPaper:
    | {
        id: string;
        title: string;
        pageUrl: string;
        examTypeLabel: string | null;
        hasAnswerKey: boolean;
      }
    | null;
};

type PaperSearchFilters = {
  query?: string;
  course?: string;
  examType?: CliExamType;
  year?: string;
  slot?: string;
  semester?: CliSemester;
  campus?: CliCampus;
  answerKeys?: boolean;
  includeDrafts?: boolean;
  limit?: string;
  page?: string;
};

function toKebabCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function parseFlags(
  args: string[],
  definitions: Record<string, FlagDefinition>,
): ParsedFlags {
  const values: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  const aliasToKey = new Map<string, string>();
  const nameToKey = new Map<string, string>();

  for (const [key, definition] of Object.entries(definitions)) {
    nameToKey.set(key, key);
    nameToKey.set(toKebabCase(key), key);

    if (definition.alias) {
      aliasToKey.set(definition.alias, key);
    }
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (arg === "--") {
      positionals.push(...args.slice(index + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const [flagName, inlineValue] = arg.slice(2).split("=", 2);
      const isNegated = flagName.startsWith("no-");
      const requestedFlagName = isNegated ? flagName.slice(3) : flagName;
      const normalizedFlagName = nameToKey.get(requestedFlagName);
      const definition = normalizedFlagName
        ? definitions[normalizedFlagName]
        : undefined;

      if (!definition || !normalizedFlagName) {
        positionals.push(arg);
        continue;
      }

      if (definition.type === "boolean") {
        values[normalizedFlagName] =
          isNegated || inlineValue === "false" || inlineValue === "0"
            ? false
            : true;
        continue;
      }

      const value = inlineValue ?? args[index + 1];
      if (value === undefined) {
        throw new Error(`Missing value for --${requestedFlagName}`);
      }

      values[normalizedFlagName] = value;
      if (inlineValue === undefined) {
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      const [alias, inlineValue] = arg.slice(1).split("=", 2);
      const key = aliasToKey.get(alias);

      if (!key) {
        positionals.push(arg);
        continue;
      }

      const definition = definitions[key];
      if (definition.type === "boolean") {
        values[key] = inlineValue === "false" || inlineValue === "0" ? false : true;
        continue;
      }

      const value = inlineValue ?? args[index + 1];
      if (value === undefined) {
        throw new Error(`Missing value for -${alias}`);
      }

      values[key] = value;
      if (inlineValue === undefined) {
        index += 1;
      }
      continue;
    }

    positionals.push(arg);
  }

  return { values, positionals };
}

function getStringFlag(
  flags: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function getBooleanFlag(
  flags: Record<string, string | boolean>,
  key: string,
): boolean {
  return flags[key] === true;
}

function hasFlag(
  flags: Record<string, string | boolean>,
  key: string,
) {
  return Object.prototype.hasOwnProperty.call(flags, key);
}

async function resolveCliRuntimeConfig(input?: { baseUrl?: string | null }) {
  const runtimeConfig = await resolveRuntimeConfig(input);
  lastRuntimeConfig = runtimeConfig;
  return runtimeConfig;
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function sleep(ms: number) {
  return new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function shouldAnimateTerminalUi() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function createSpinner() {
  if (shouldAnimateTerminalUi()) {
    return p.spinner();
  }

  return {
    start(_message: string) {},
    stop(_message: string) {},
  };
}

function exitWithCancel(message = "Canceled."): never {
  p.cancel(message);
  process.exit(0);
}

function unwrapPrompt<T>(value: T | symbol, message?: string): T {
  if (p.isCancel(value)) {
    exitWithCancel(message);
  }

  return value as T;
}

function pluralize(word: string, count: number) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function shouldUseInteractive(
  flags: Record<string, string | boolean>,
  jsonOutput: boolean,
) {
  return (
    !jsonOutput &&
    flags.interactive !== false &&
    shouldAnimateTerminalUi()
  );
}

function sanitizeFileName(name: string) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function formatExamTypeLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return EXAM_TYPE_LABELS[value as CliExamType] ?? value;
}

function formatSemesterLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return SEMESTER_LABELS[value as CliSemester] ?? value;
}

function formatCampusLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return CAMPUS_LABELS[value as CliCampus] ?? value;
}

function sortPapers(papers: CliPaper[]) {
  return [...papers].sort((left, right) => {
    const yearDelta = (right.year ?? 0) - (left.year ?? 0);
    if (yearDelta !== 0) {
      return yearDelta;
    }

    const leftExamIndex = left.examType
      ? EXAM_TYPE_ORDER.indexOf(left.examType)
      : EXAM_TYPE_ORDER.length;
    const rightExamIndex = right.examType
      ? EXAM_TYPE_ORDER.indexOf(right.examType)
      : EXAM_TYPE_ORDER.length;
    if (leftExamIndex !== rightExamIndex) {
      return leftExamIndex - rightExamIndex;
    }

    const slotDelta = (left.slot ?? "").localeCompare(right.slot ?? "");
    if (slotDelta !== 0) {
      return slotDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function formatCourseDisplay(course: CliCourse) {
  return `${course.code} · ${course.title}`;
}

function formatCourseHint(course: CliCourse) {
  return `${pluralize("paper", course.paperCount)} • ${pluralize("note", course.noteCount)}`;
}

function formatPaperDisplayTitle(
  paper: Pick<CliPaper, "title" | "course">,
) {
  return paper.course?.title?.trim() || paper.title;
}

function normalizeTitleForComparison(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPaperDisplayTitleRedundant(
  paper: Pick<CliPaper, "title" | "course">,
  course?: Pick<CliCourse, "title">,
) {
  if (!course?.title) {
    return false;
  }

  return (
    normalizeTitleForComparison(formatPaperDisplayTitle(paper)) ===
    normalizeTitleForComparison(course.title)
  );
}

function formatPaperKind(paper: Pick<CliPaper, "questionPaperId" | "hasAnswerKey">) {
  if (paper.questionPaperId) {
    return "Answer key";
  }

  if (paper.hasAnswerKey) {
    return "Question paper + key";
  }

  return "Question paper";
}

function formatPaperMeta(paper: Pick<
  CliPaper,
  "examTypeLabel" | "year" | "slot" | "questionPaperId" | "hasAnswerKey"
>) {
  const parts = [paper.examTypeLabel ?? "Unknown exam"];

  if (paper.year) {
    parts.push(String(paper.year));
  }

  if (paper.slot) {
    parts.push(paper.slot);
  }

  parts.push(formatPaperKind(paper));
  return parts.join(" • ");
}

function buildPaperFileStem(
  paper: Pick<
    CliPaper,
    "title" | "course" | "examTypeLabel" | "year" | "slot" | "questionPaperId"
  >,
) {
  return [
    paper.course?.code ?? null,
    formatPaperDisplayTitle(paper),
    paper.examTypeLabel ?? null,
    paper.year ? String(paper.year) : null,
    paper.slot ?? null,
    paper.questionPaperId ? "Answer Key" : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

function formatLabelList(labels: string[], limit = 3) {
  if (labels.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.slice(0, limit).join(", ")} +${labels.length - limit} more`;
}

function formatExamTypeSelectionSummary(
  examTypes: CliExamType[],
  availableExamTypes: CliExamType[],
) {
  if (
    examTypes.length === 0 ||
    (examTypes.length === availableExamTypes.length &&
      examTypes.every((examType) => availableExamTypes.includes(examType)))
  ) {
    return "All available";
  }

  return formatLabelList(examTypes.map((examType) => formatExamTypeLabel(examType)));
}

function buildCoursePageUrl(baseUrl: string, courseCode: string) {
  return `${baseUrl}/past_papers/${encodeURIComponent(courseCode)}`;
}

function showCourseSummaryNote(course: CliCourse) {
  p.note(
    [
      `Course: ${formatCourseDisplay(course)}`,
      `Catalog: ${formatCourseHint(course)}`,
    ].join("\n"),
    "Course selected",
  );
}

function showPaperResultsSummary(input: {
  course: CliCourse;
  papers: CliPaper[];
  examTypes: CliExamType[];
  availableExamTypes: CliExamType[];
  paperQuery?: string;
}) {
  p.note(
    [
      `Course: ${formatCourseDisplay(input.course)}`,
      `Exam types: ${formatExamTypeSelectionSummary(
        input.examTypes,
        input.availableExamTypes,
      )}`,
      input.paperQuery ? `Query: ${input.paperQuery}` : null,
      `Results: ${pluralize("paper", input.papers.length)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    "Results ready",
  );
}

function showSelectedPaperSummary(
  paper: Pick<
    CliPaper,
    "title" | "course" | "examTypeLabel" | "year" | "slot" | "questionPaperId" | "hasAnswerKey"
  >,
  course?: Pick<CliCourse, "title">,
) {
  p.note(
    [
      !isPaperDisplayTitleRedundant(paper, course)
        ? `Title: ${formatPaperDisplayTitle(paper)}`
        : null,
      `Paper: ${formatPaperMeta(paper)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    "Selected paper",
  );
}

function printCourseList(courses: CliCourse[]) {
  if (courses.length === 0) {
    console.log(pc.dim("No courses found."));
    return;
  }

  const visible = courses.slice(0, 12);
  for (const [index, course] of visible.entries()) {
    console.log(
      `${pc.bold(String(index + 1).padStart(2, " "))}. ${course.code} · ${truncate(course.title, 72)}`,
    );
    console.log(`    ${pc.dim(formatCourseHint(course))}`);
  }

  if (courses.length > visible.length) {
    console.log();
    console.log(pc.dim(`+ ${courses.length - visible.length} more`));
  }
}

function printPaperResults(course: CliCourse, papers: CliPaper[]) {
  console.log();
  console.log(pc.bold(formatCourseDisplay(course)));
  console.log(pc.dim(pluralize("paper", papers.length)));
  console.log();

  const visible = papers.slice(0, 10);
  for (const [index, paper] of visible.entries()) {
    console.log(
      `${pc.bold(String(index + 1).padStart(2, " "))}. ${formatPaperMeta(paper)}`,
    );
    if (!isPaperDisplayTitleRedundant(paper, course)) {
      console.log(`    ${truncate(formatPaperDisplayTitle(paper), 88)}`);
    }
  }

  if (papers.length > visible.length) {
    console.log();
    console.log(pc.dim(`+ ${papers.length - visible.length} more available in the picker`));
  }
}

function printWhoAmISummary(input: {
  email: string;
  name: string | null;
  role: string;
}) {
  console.log(pc.bold(input.email));
  console.log(pc.dim(`${input.name ?? "ExamCooker account"} • ${input.role}`));
}

function printPaperDetailSummary(paper: CliPaperDetail) {
  console.log();
  console.log(pc.bold(formatPaperDisplayTitle(paper)));

  const subtitle = [paper.course?.code ?? null].filter(Boolean).join(" · ");
  if (subtitle) {
    console.log(pc.dim(subtitle));
  }

  console.log();
  console.log(`${pc.bold("Type:")} ${formatPaperKind(paper)}`);
  console.log(`${pc.bold("When:")} ${formatPaperMeta(paper)}`);

  const semester = formatSemesterLabel(paper.semester);
  if (semester) {
    console.log(`${pc.bold("Semester:")} ${semester}`);
  }

  const campus = formatCampusLabel(paper.campus);
  if (campus) {
    console.log(`${pc.bold("Campus:")} ${campus}`);
  }

  if (paper.author.name) {
    console.log(`${pc.bold("Uploaded by:")} ${paper.author.name}`);
  }

  if (paper.tags.length > 0) {
    console.log(
      `${pc.bold("Tags:")} ${paper.tags.map((tag) => tag.name).join(", ")}`,
    );
  }

  if (paper.siblingPaper) {
    console.log(
      `${pc.bold("Linked sibling:")} ${paper.siblingPaper.title} (${paper.siblingPaper.examTypeLabel ?? "Paper"})`,
    );
  }

  console.log(`${pc.bold("Open:")} ${paper.pageUrl}`);
}

function parsePaperReference(reference: string | undefined) {
  const trimmed = reference?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/paper\/([^/?#]+)/i);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Ignore URL parse failures.
  }

  if (UUID_PATTERN.test(trimmed) || /^[a-z0-9-]{20,}$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

async function openExternal(url: string) {
  const command =
    process.platform === "darwin"
      ? { bin: "open", args: [url] }
      : process.platform === "win32"
        ? { bin: "cmd", args: ["/c", "start", "", url] }
        : { bin: "xdg-open", args: [url] };

  return new Promise<boolean>((resolvePromise) => {
    try {
      const child = spawn(command.bin, command.args, {
        detached: true,
        stdio: "ignore",
      });

      let settled = false;
      const finish = (opened: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        if (opened) {
          child.unref();
        }
        resolvePromise(opened);
      };

      child.once("spawn", () => {
        finish(true);
      });
      child.once("error", () => {
        finish(false);
      });
    } catch {
      resolvePromise(false);
    }
  });
}

async function requireAuthContext(baseUrlOverride?: string) {
  const runtimeConfig = await resolveCliRuntimeConfig({
    baseUrl: baseUrlOverride,
  });
  if (!runtimeConfig.token) {
    throw new Error("Not authenticated. Run `examcooker auth login` first.");
  }

  return runtimeConfig;
}

async function revokeCliToken(baseUrl: string, token: string) {
  try {
    await requestJson(baseUrl, "/api/cli/logout", {
      method: "POST",
      token,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return false;
    }

    throw error;
  }

  return true;
}

async function fetchCourses(
  runtimeConfig: RuntimeConfig,
  query: string,
  limit = 12,
) {
  const payload = await requestJson<{
    success: boolean;
    count: number;
    courses: CliCourse[];
  }>(runtimeConfig.baseUrl, `/api/cli/courses${buildQuery({ q: query, limit })}`, {
    token: runtimeConfig.token,
  });

  return payload.courses;
}

async function fetchPaperSearchResults(
  runtimeConfig: RuntimeConfig,
  filters: PaperSearchFilters,
) {
  const { query, ...restFilters } = filters;
  const payload = await requestJson<{
    success: boolean;
    total: number;
    page: number;
    limit: number;
    papers: CliPaper[];
  }>(
    runtimeConfig.baseUrl,
    `/api/cli/papers${buildQuery({ q: query, ...restFilters })}`,
    {
      token: runtimeConfig.token,
    },
  );

  return {
    total: payload.total,
    page: payload.page,
    limit: payload.limit,
    papers: sortPapers(payload.papers),
  };
}

async function fetchPaperDetail(runtimeConfig: RuntimeConfig, paperId: string) {
  const payload = await requestJson<{
    success: boolean;
    paper: CliPaperDetail;
  }>(runtimeConfig.baseUrl, `/api/cli/papers/${paperId}`, {
    token: runtimeConfig.token,
  });

  return payload.paper;
}

async function promptForQuery(input: {
  message: string;
  placeholder?: string;
  initialValue?: string;
}) {
  return unwrapPrompt(
    await p.text({
      message: input.message,
      placeholder: input.placeholder,
      initialValue: input.initialValue,
      validate: (value) => {
        if (!value.trim()) {
          return "Enter a search query.";
        }

        if (value.trim().length < 2) {
          return "Use at least 2 characters.";
        }

        return undefined;
      },
    }),
    "Canceled.",
  ).trim();
}

async function promptForYear(initialValue?: string) {
  return unwrapPrompt(
    await p.text({
      message: "What year is this paper from?",
      placeholder: "2025",
      initialValue,
      validate: (value) => {
        const normalized = value.trim();
        if (!/^\d{4}$/.test(normalized)) {
          return "Enter a 4-digit year like 2025.";
        }

        return undefined;
      },
    }),
    "Canceled.",
  ).trim();
}

async function resolveCourseSelection(
  runtimeConfig: RuntimeConfig,
  input?: {
    query?: string;
    message?: string;
    announce?: boolean;
  },
): Promise<CliCourse> {
  let query = input?.query?.trim() ?? "";
  const announce = input?.announce !== false;

  for (;;) {
    if (!query) {
      query = await promptForQuery({
        message: input?.message ?? "Search for a course",
        placeholder: "Complex variables, BCSE409L, data structures…",
      });
    }

    const courses = await fetchCourses(runtimeConfig, query, 12);
    const exactCodeMatch = courses.find(
      (course) => course.code.toLowerCase() === query.toLowerCase(),
    );

    if (exactCodeMatch) {
      if (announce) {
        p.log.success(`Using ${formatCourseDisplay(exactCodeMatch)}`);
      }
      return exactCodeMatch;
    }

    if (courses.length === 0) {
      p.log.warn(`No courses matched "${query}".`);
      query = "";
      continue;
    }

    if (courses.length === 1) {
      if (announce) {
        p.log.success(`Using ${formatCourseDisplay(courses[0])}`);
      }
      return courses[0];
    }

    const selected = unwrapPrompt(
      await p.select<CliCourse | "__retry__">({
        message: "Pick a course",
        options: [
          ...courses.map((course) => ({
            value: course,
            label: formatCourseDisplay(course),
            hint: formatCourseHint(course),
          })),
          {
            value: "__retry__",
            label: "Search again",
            hint: "Refine the course search",
          },
        ],
        maxItems: 8,
      }),
      "Canceled.",
    );

    if (selected === "__retry__") {
      query = "";
      continue;
    }

    return selected;
  }
}

function getAvailableExamTypes(papers: CliPaper[]) {
  const counts = new Map<CliExamType, number>();

  for (const paper of papers) {
    if (!paper.examType) {
      continue;
    }

    counts.set(paper.examType, (counts.get(paper.examType) ?? 0) + 1);
  }

  return EXAM_TYPE_ORDER.filter((examType) => counts.has(examType)).map(
    (examType) => ({
      value: examType,
      label: formatExamTypeLabel(examType),
      hint: pluralize("paper", counts.get(examType) ?? 0),
    }),
  );
}

async function resolveExamTypeSelection(
  papers: CliPaper[],
  predefinedExamType?: CliExamType,
) {
  if (predefinedExamType) {
    return [predefinedExamType];
  }

  const examTypes = getAvailableExamTypes(papers);
  if (examTypes.length <= 1) {
    return examTypes.map((examType) => examType.value);
  }

  return unwrapPrompt(
    await p.multiselect<CliExamType>({
      message: "Pick exam types",
      options: examTypes,
      initialValues: examTypes.map((examType) => examType.value),
      required: true,
      maxItems: 8,
    }),
    "Canceled.",
  );
}

async function collectInteractivePaperResults(
  runtimeConfig: RuntimeConfig,
  input: {
    courseQuery?: string;
    paperQuery?: string;
    predefinedCourse?: string;
    predefinedExamType?: CliExamType;
    year?: string;
    slot?: string;
    semester?: CliSemester;
    campus?: CliCampus;
    answerKeys?: boolean;
    includeDrafts?: boolean;
  },
) {
  const selectedCourse = await resolveCourseSelection(runtimeConfig, {
    query: input.predefinedCourse ?? input.courseQuery,
    message: "Search for a course",
    announce: false,
  });

  const baseResults = await fetchPaperSearchResults(runtimeConfig, {
    query: input.paperQuery,
    course: selectedCourse.code,
    year: input.year,
    slot: input.slot,
    semester: input.semester,
    campus: input.campus,
    answerKeys: input.answerKeys,
    includeDrafts: input.includeDrafts,
    limit: "250",
    page: "1",
  });

  if (baseResults.papers.length === 0) {
    throw new Error(`No papers found for ${selectedCourse.code}.`);
  }

  const availableExamTypes = getAvailableExamTypes(baseResults.papers).map(
    (examType) => examType.value,
  );

  const selectedExamTypes = await resolveExamTypeSelection(
    baseResults.papers,
    input.predefinedExamType,
  );

  const filteredPapers =
    selectedExamTypes.length === 0
      ? baseResults.papers
      : baseResults.papers.filter(
          (paper) => !paper.examType || selectedExamTypes.includes(paper.examType),
        );

  if (filteredPapers.length === 0) {
    throw new Error("No papers matched the selected exam types.");
  }

  return {
    course: selectedCourse,
    papers: filteredPapers,
    examTypes: selectedExamTypes,
    availableExamTypes,
  };
}

async function promptForPaperSelection(
  papers: CliPaper[],
  message: string,
  course?: CliCourse,
  input?: {
    announceSingle?: boolean;
  },
) {
  if (papers.length === 1) {
    if (input?.announceSingle !== false) {
      p.log.success(`Using ${formatPaperDisplayTitle(papers[0])}`);
    }
    return papers[0];
  }

  return unwrapPrompt(
    await p.select<CliPaper>({
      message,
      options: papers.map((paper) => ({
        value: paper,
        label: truncate(
          isPaperDisplayTitleRedundant(paper, course)
            ? formatPaperMeta(paper)
            : formatPaperDisplayTitle(paper),
          72,
        ),
        hint: isPaperDisplayTitleRedundant(paper, course)
          ? undefined
          : formatPaperMeta(paper),
      })),
      maxItems: 10,
    }),
    "Canceled.",
  );
}

async function resolvePaperSelectionFromSearch(
  runtimeConfig: RuntimeConfig,
  input: {
    courseQuery?: string;
    paperQuery?: string;
    predefinedCourse?: string;
    predefinedExamType?: CliExamType;
    year?: string;
    slot?: string;
    semester?: CliSemester;
    campus?: CliCampus;
    answerKeys?: boolean;
    includeDrafts?: boolean;
  },
  ) {
  const results = await collectInteractivePaperResults(runtimeConfig, input);
  showPaperResultsSummary({
    course: results.course,
    papers: results.papers,
    examTypes: results.examTypes,
    availableExamTypes: results.availableExamTypes,
    paperQuery: input.paperQuery,
  });

  return promptForPaperSelection(results.papers, "Pick a paper", results.course, {
    announceSingle: false,
  });
}

async function downloadPaperFile(
  paper: CliPaper,
  outputPath?: string,
  interactive = false,
) {
  const resolvedOutputPath =
    resolve(
      outputPath ||
        `${sanitizeFileName(buildPaperFileStem(paper))}.pdf`,
    );

  if (interactive && existsSync(resolvedOutputPath)) {
    const shouldOverwrite = unwrapPrompt(
      await p.confirm({
        message: `${basename(resolvedOutputPath)} already exists. Overwrite it?`,
        initialValue: false,
      }),
      "Canceled.",
    );

    if (!shouldOverwrite) {
      throw new Error("Download canceled.");
    }
  }

  const spinner = createSpinner();
  spinner.start("Downloading paper...");
  const response = await fetch(paper.fileUrl);
  if (!response.ok) {
    spinner.stop("Download failed");
    throw new Error(`Could not download ${paper.fileUrl}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(resolvedOutputPath, buffer);
  spinner.stop("Download complete");

  return {
    path: resolvedOutputPath,
    size: buffer.byteLength,
  };
}

async function runSelectedPaperActionLoop(
  runtimeConfig: RuntimeConfig,
  course: CliCourse,
  paper: CliPaper,
) {
  showSelectedPaperSummary(paper, course);

  for (;;) {
    const nextAction = unwrapPrompt(
      await p.select<
        | "view"
        | "download"
        | "open"
        | "pickAnother"
        | "changeExamTypes"
        | "changeCourse"
        | "done"
      >({
        message: "What do you want to do?",
        options: [
          {
            value: "view",
            label: "View details",
            hint: "Inspect metadata and linked sibling papers",
          },
          {
            value: "download",
            label: "Download PDF",
            hint: "Save this paper locally",
          },
          {
            value: "open",
            label: "Open in browser",
            hint: "Open the paper page on ExamCooker",
          },
          {
            value: "pickAnother",
            label: "Pick another paper",
            hint: "Return to the current results",
          },
          {
            value: "changeExamTypes",
            label: "Change exam types",
            hint: "Refine results for this course",
          },
          {
            value: "changeCourse",
            label: "Change course",
            hint: "Start again with another course",
          },
          {
            value: "done",
            label: "Done",
            hint: "Exit search",
          },
        ],
        maxItems: 8,
      }),
      "Canceled.",
    );

    if (nextAction === "done") {
      return "done" as const;
    }

    if (nextAction === "pickAnother") {
      return "pickAnother" as const;
    }

    if (nextAction === "changeExamTypes") {
      return "changeExamTypes" as const;
    }

    if (nextAction === "changeCourse") {
      return "changeCourse" as const;
    }

    if (nextAction === "download") {
      const saved = await downloadPaperFile(paper, undefined, true);
      p.log.success(`Saved to ${saved.path}`);
      continue;
    }

    if (nextAction === "open") {
      const opened = await openExternal(paper.pageUrl);
      if (!opened) {
        p.log.warn("Could not open the browser automatically.");
      } else {
        p.log.success("Opened in your browser.");
      }
      continue;
    }

    const detail = await fetchPaperDetail(runtimeConfig, paper.id);
    printPaperDetailSummary(detail);
  }
}

async function runInteractivePaperExplorer(
  runtimeConfig: RuntimeConfig,
  input: {
    courseQuery?: string;
    paperQuery?: string;
    predefinedCourse?: string;
    predefinedExamType?: CliExamType;
    year?: string;
    slot?: string;
    semester?: CliSemester;
    campus?: CliCampus;
    answerKeys?: boolean;
    includeDrafts?: boolean;
  },
) {
  let courseQuery = input.courseQuery;
  let predefinedCourse = input.predefinedCourse;
  let predefinedExamType = input.predefinedExamType;

  for (;;) {
    const results = await collectInteractivePaperResults(runtimeConfig, {
      courseQuery,
      paperQuery: input.paperQuery,
      predefinedCourse,
      predefinedExamType,
      year: input.year,
      slot: input.slot,
      semester: input.semester,
      campus: input.campus,
      answerKeys: input.answerKeys,
      includeDrafts: input.includeDrafts,
    });

    showPaperResultsSummary({
      course: results.course,
      papers: results.papers,
      examTypes: results.examTypes,
      availableExamTypes: results.availableExamTypes,
      paperQuery: input.paperQuery,
    });

    for (;;) {
      const selectedPaper = await promptForPaperSelection(
        results.papers,
        "Pick a paper",
        results.course,
        {
          announceSingle: false,
        },
      );

      const nextStep = await runSelectedPaperActionLoop(
        runtimeConfig,
        results.course,
        selectedPaper,
      );

      if (nextStep === "pickAnother") {
        continue;
      }

      if (nextStep === "changeExamTypes") {
        courseQuery = results.course.code;
        predefinedCourse = results.course.code;
        predefinedExamType = undefined;
        break;
      }

      if (nextStep === "changeCourse") {
        courseQuery = "";
        predefinedCourse = undefined;
        predefinedExamType = undefined;
        break;
      }

      return;
    }
  }
}

async function runAuthLogin(args: string[]) {
  const { values } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    debug: { type: "boolean" },
    open: { type: "boolean" },
  });
  const baseUrlOverride = getStringFlag(values, "baseUrl");
  const debug = getBooleanFlag(values, "debug");
  const shouldOpen = values.open !== false;
  const runtimeConfig = await resolveCliRuntimeConfig({
    baseUrl: baseUrlOverride,
  });
  const deviceName = `${hostname()} (${platform()})`;

  p.intro(pc.bgCyan(pc.black(" examcooker auth ")));

  if (debug) {
    printRuntimeDebug(runtimeConfig);
  }

  const startSpinner = createSpinner();
  startSpinner.start("Starting device login...");
  const startResponse = await requestJson<{
    success: boolean;
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    interval: number;
    expiresIn: number;
  }>(runtimeConfig.baseUrl, "/api/cli/device/start", {
    method: "POST",
    json: { deviceName },
  }).then(
    (response) => {
      startSpinner.stop("Device code created");
      return response;
    },
    (error) => {
      startSpinner.stop("Device login failed");
      throw error;
    },
  );

  p.note(
    [
      `Code: ${pc.bold(startResponse.userCode)}`,
      `Open: ${startResponse.verificationUriComplete}`,
    ].join("\n"),
    "Approve this login",
  );

  if (shouldOpen) {
    const opened = await openExternal(startResponse.verificationUriComplete);
    if (!opened) {
      p.log.warn("Could not open the browser automatically.");
    }
  }

  const pollSpinner = createSpinner();
  pollSpinner.start("Waiting for browser approval...");

  let pollFailureMessage = "Approval failed";
  try {
    const deadline = Date.now() + startResponse.expiresIn * 1000;
    for (;;) {
      if (Date.now() >= deadline) {
        pollFailureMessage = "Login timed out";
        throw new Error(
          "This device login expired. Run `examcooker auth login` again.",
        );
      }

      await sleep(startResponse.interval * 1000);
      const response = await requestRaw(
        runtimeConfig.baseUrl,
        "/api/cli/device/poll",
        {
          method: "POST",
          json: { deviceCode: startResponse.deviceCode },
        },
      );

      if (response.status === 202) {
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            accessToken?: string;
            baseUrl?: string;
            user?: {
              email?: string | null;
              name?: string | null;
              role?: string | null;
            };
            error?: string;
          }
        | null;

      if (response.ok && payload?.accessToken) {
        pollSpinner.stop("Approved");

        const previousToken = runtimeConfig.storedConfig.token?.trim();
        const previousBaseUrl =
          runtimeConfig.storedConfig.baseUrl?.trim() || runtimeConfig.baseUrl;
        if (previousToken && previousToken !== payload.accessToken) {
          try {
            await revokeCliToken(previousBaseUrl, previousToken);
          } catch (error) {
            p.log.warn(
              `Signed in, but could not revoke the previous CLI token: ${formatCliErrorMessage(error)}`,
            );
          }
        }

        const nextConfig: ExamCookerConfig = {
          baseUrl: payload.baseUrl || runtimeConfig.baseUrl,
          token: payload.accessToken,
          user: payload.user
            ? {
                email: payload.user.email ?? null,
                name: payload.user.name ?? null,
                role: payload.user.role ?? null,
              }
            : undefined,
        };
        await saveConfig(nextConfig);

        p.outro(
          `Signed in as ${pc.bold(payload.user?.email ?? "your account")}.\nConfig: ${pc.dim(getConfigPath())}`,
        );
        return;
      }

      const error =
        payload?.error ||
        (response.status === 410
          ? "expired_token"
          : response.status === 403
            ? "access_denied"
            : "Device login failed.");

      throw new Error(error);
    }
  } catch (error) {
    pollSpinner.stop(pollFailureMessage);
    throw error;
  }
}

async function runAuthLogout(args: string[]) {
  const { values } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
  });
  const runtimeConfig = await resolveCliRuntimeConfig({
    baseUrl: getStringFlag(values, "baseUrl"),
  });

  if (runtimeConfig.token) {
    const tokenToRevoke = runtimeConfig.storedConfig.token || runtimeConfig.token;
    const baseUrlToRevoke =
      runtimeConfig.storedConfig.baseUrl || runtimeConfig.baseUrl;
    await revokeCliToken(baseUrlToRevoke, tokenToRevoke);
  }

  await clearConfig();
  console.log(`Cleared local auth at ${pc.dim(getConfigPath())}`);
}

async function runWhoAmI(args: string[]) {
  const { values } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    debug: { type: "boolean" },
    json: { type: "boolean" },
    showToken: { type: "boolean" },
  });
  const jsonOutput = getBooleanFlag(values, "json");
  const runtimeConfig = await requireAuthContext(getStringFlag(values, "baseUrl"));

  if (getBooleanFlag(values, "debug")) {
    printRuntimeDebug(runtimeConfig);
  }

  const payload = await requestJson<{
    success: boolean;
    user: { id: string; email: string; name: string | null; role: string };
    token: { id: string; label: string | null };
  }>(runtimeConfig.baseUrl, "/api/cli/me", {
    token: runtimeConfig.token,
  });

  if (jsonOutput) {
    printJson(payload);
    return;
  }

  printWhoAmISummary(payload.user);
  if (getBooleanFlag(values, "showToken")) {
    console.log(`${pc.bold("Token:")} ${payload.token.label ?? payload.token.id}`);
  }
}

async function runCourseSearch(args: string[]) {
  const { values, positionals } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    limit: { alias: "l", type: "string" },
    json: { type: "boolean" },
    interactive: { type: "boolean" },
  });
  const runtimeConfig = await requireAuthContext(getStringFlag(values, "baseUrl"));
  const query = positionals.join(" ").trim();
  const limit = getStringFlag(values, "limit") ?? "12";
  const jsonOutput = getBooleanFlag(values, "json");
  const interactive = shouldUseInteractive(values, jsonOutput);

  if (jsonOutput) {
    const courses = await fetchCourses(runtimeConfig, query, Number(limit));
    printJson({
      success: true,
      query,
      count: courses.length,
      courses,
    });
    return;
  }

  if (interactive) {
    const selectedCourse = await resolveCourseSelection(runtimeConfig, {
      query,
      message: "Search for a course",
      announce: false,
    });
    showCourseSummaryNote(selectedCourse);

    const nextAction = unwrapPrompt(
      await p.select<"browsePapers" | "openInBrowser" | "done">({
        message: "What do you want to do?",
        options: [
          {
            value: "browsePapers",
            label: "Browse past papers",
            hint: "Open the guided paper flow for this course",
          },
          {
            value: "openInBrowser",
            label: "Open in browser",
            hint: "Open the course page on ExamCooker",
          },
          {
            value: "done",
            label: "Done",
            hint: "Exit course search",
          },
        ],
      }),
      "Canceled.",
    );

    if (nextAction === "browsePapers") {
      await runInteractivePaperExplorer(runtimeConfig, {
        predefinedCourse: selectedCourse.code,
      });
      return;
    }

    if (nextAction === "openInBrowser") {
      const opened = await openExternal(
        buildCoursePageUrl(runtimeConfig.baseUrl, selectedCourse.code),
      );
      if (!opened) {
        p.log.warn("Could not open the browser automatically.");
      } else {
        p.log.success("Opened in your browser.");
      }
    }

    return;
  }

  const courses = await fetchCourses(runtimeConfig, query, Number(limit));
  printCourseList(courses);
}

async function runPaperSearch(args: string[]) {
  const { values, positionals } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    course: { alias: "c", type: "string" },
    examType: { alias: "e", type: "string" },
    year: { alias: "y", type: "string" },
    slot: { alias: "s", type: "string" },
    semester: { type: "string" },
    campus: { type: "string" },
    answerKeys: { type: "boolean" },
    includeDrafts: { type: "boolean" },
    limit: { alias: "l", type: "string" },
    page: { alias: "p", type: "string" },
    json: { type: "boolean" },
    interactive: { type: "boolean" },
  });
  const runtimeConfig = await requireAuthContext(getStringFlag(values, "baseUrl"));
  const rawQuery = positionals.join(" ").trim();
  const jsonOutput = getBooleanFlag(values, "json");
  const interactive = shouldUseInteractive(values, jsonOutput);
  const predefinedCourse = getStringFlag(values, "course");
  const predefinedExamType = getStringFlag(values, "examType") as
    | CliExamType
    | undefined;

  if (jsonOutput) {
    const payload = await fetchPaperSearchResults(runtimeConfig, {
      query: rawQuery || undefined,
      course: predefinedCourse,
      examType: predefinedExamType,
      year: getStringFlag(values, "year"),
      slot: getStringFlag(values, "slot"),
      semester: getStringFlag(values, "semester") as CliSemester | undefined,
      campus: getStringFlag(values, "campus") as CliCampus | undefined,
      answerKeys: getBooleanFlag(values, "answerKeys"),
      includeDrafts: getBooleanFlag(values, "includeDrafts"),
      limit: getStringFlag(values, "limit") ?? "20",
      page: getStringFlag(values, "page") ?? "1",
    });
    printJson({
      success: true,
      total: payload.total,
      page: payload.page,
      limit: payload.limit,
      papers: payload.papers,
    });
    return;
  }

  if (interactive) {
    await runInteractivePaperExplorer(runtimeConfig, {
      courseQuery: predefinedCourse ? undefined : rawQuery,
      paperQuery: predefinedCourse ? rawQuery || undefined : undefined,
      predefinedCourse,
      predefinedExamType,
      year: getStringFlag(values, "year"),
      slot: getStringFlag(values, "slot"),
      semester: getStringFlag(values, "semester") as CliSemester | undefined,
      campus: getStringFlag(values, "campus") as CliCampus | undefined,
      answerKeys: getBooleanFlag(values, "answerKeys"),
      includeDrafts: getBooleanFlag(values, "includeDrafts"),
    });
    return;
  }

  if (!predefinedCourse) {
    const courses = await fetchCourses(runtimeConfig, rawQuery, 10);
    printCourseList(courses);
    return;
  }

  const selectedCourse = await resolveCourseSelection(runtimeConfig, {
    query: predefinedCourse,
    announce: false,
  });
  const payload = await fetchPaperSearchResults(runtimeConfig, {
    query: rawQuery || undefined,
    course: selectedCourse.code,
    examType: predefinedExamType,
    year: getStringFlag(values, "year"),
    slot: getStringFlag(values, "slot"),
    semester: getStringFlag(values, "semester") as CliSemester | undefined,
    campus: getStringFlag(values, "campus") as CliCampus | undefined,
    answerKeys: getBooleanFlag(values, "answerKeys"),
    includeDrafts: getBooleanFlag(values, "includeDrafts"),
    limit: getStringFlag(values, "limit") ?? "40",
    page: getStringFlag(values, "page") ?? "1",
  });
  printPaperResults(selectedCourse, payload.papers);
}

async function resolveDirectOrInteractivePaper(
  runtimeConfig: RuntimeConfig,
  input: {
    reference?: string;
    courseQuery?: string;
    predefinedCourse?: string;
    predefinedExamType?: CliExamType;
    year?: string;
    slot?: string;
    semester?: CliSemester;
    campus?: CliCampus;
    answerKeys?: boolean;
    includeDrafts?: boolean;
  },
) {
  const directId = parsePaperReference(input.reference);
  if (directId) {
    return fetchPaperDetail(runtimeConfig, directId);
  }

  const selectedPaper = await resolvePaperSelectionFromSearch(runtimeConfig, {
    courseQuery: input.predefinedCourse ? undefined : input.courseQuery,
    paperQuery: input.predefinedCourse ? input.courseQuery : undefined,
    predefinedCourse: input.predefinedCourse,
    predefinedExamType: input.predefinedExamType,
    year: input.year,
    slot: input.slot,
    semester: input.semester,
    campus: input.campus,
    answerKeys: input.answerKeys,
    includeDrafts: input.includeDrafts,
  });

  return fetchPaperDetail(runtimeConfig, selectedPaper.id);
}

async function runPaperView(args: string[]) {
  const { values, positionals } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    course: { alias: "c", type: "string" },
    examType: { alias: "e", type: "string" },
    year: { alias: "y", type: "string" },
    slot: { alias: "s", type: "string" },
    semester: { type: "string" },
    campus: { type: "string" },
    answerKeys: { type: "boolean" },
    includeDrafts: { type: "boolean" },
    json: { type: "boolean" },
    interactive: { type: "boolean" },
  });
  const runtimeConfig = await requireAuthContext(getStringFlag(values, "baseUrl"));
  const reference = positionals.join(" ").trim();
  const jsonOutput = getBooleanFlag(values, "json");
  const interactive = shouldUseInteractive(values, jsonOutput);

  if (!reference && !interactive) {
    throw new Error("Usage: examcooker papers view <paper-id|paper-url>");
  }

  const paper = await resolveDirectOrInteractivePaper(runtimeConfig, {
    reference,
    courseQuery: reference || undefined,
    predefinedCourse: getStringFlag(values, "course"),
    predefinedExamType: getStringFlag(values, "examType") as
      | CliExamType
      | undefined,
    year: getStringFlag(values, "year"),
    slot: getStringFlag(values, "slot"),
    semester: getStringFlag(values, "semester") as CliSemester | undefined,
    campus: getStringFlag(values, "campus") as CliCampus | undefined,
    answerKeys: getBooleanFlag(values, "answerKeys"),
    includeDrafts: getBooleanFlag(values, "includeDrafts"),
  });

  if (jsonOutput) {
    printJson({
      success: true,
      paper,
    });
    return;
  }

  printPaperDetailSummary(paper);
}

async function runPaperDownload(args: string[]) {
  const { values, positionals } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    course: { alias: "c", type: "string" },
    examType: { alias: "e", type: "string" },
    year: { alias: "y", type: "string" },
    slot: { alias: "s", type: "string" },
    semester: { type: "string" },
    campus: { type: "string" },
    answerKeys: { type: "boolean" },
    includeDrafts: { type: "boolean" },
    output: { alias: "o", type: "string" },
    json: { type: "boolean" },
    interactive: { type: "boolean" },
  });
  const runtimeConfig = await requireAuthContext(getStringFlag(values, "baseUrl"));
  const reference = positionals.join(" ").trim();
  const jsonOutput = getBooleanFlag(values, "json");
  const interactive = shouldUseInteractive(values, jsonOutput);

  if (!reference && !interactive) {
    throw new Error("Usage: examcooker papers download <paper-id|paper-url>");
  }

  const paper = await resolveDirectOrInteractivePaper(runtimeConfig, {
    reference,
    courseQuery: reference || undefined,
    predefinedCourse: getStringFlag(values, "course"),
    predefinedExamType: getStringFlag(values, "examType") as
      | CliExamType
      | undefined,
    year: getStringFlag(values, "year"),
    slot: getStringFlag(values, "slot"),
    semester: getStringFlag(values, "semester") as CliSemester | undefined,
    campus: getStringFlag(values, "campus") as CliCampus | undefined,
    answerKeys: getBooleanFlag(values, "answerKeys"),
    includeDrafts: getBooleanFlag(values, "includeDrafts"),
  });

  const saved = await downloadPaperFile(
    paper,
    getStringFlag(values, "output"),
    interactive,
  );

  if (jsonOutput) {
    printJson({
      success: true,
      id: paper.id,
      title: paper.title,
      path: saved.path,
      size: saved.size,
    });
    return;
  }

  console.log(
    `Saved ${pc.bold(formatPaperDisplayTitle(paper))} to ${pc.cyan(saved.path)}`,
  );
}

async function runPaperUpload(args: string[]) {
  const { values, positionals } = parseFlags(args, {
    baseUrl: { alias: "b", type: "string" },
    course: { alias: "c", type: "string" },
    examType: { alias: "e", type: "string" },
    year: { alias: "y", type: "string" },
    slot: { alias: "s", type: "string" },
    semester: { type: "string" },
    campus: { type: "string" },
    title: { alias: "t", type: "string" },
    answerKey: { type: "boolean" },
    json: { type: "boolean" },
    interactive: { type: "boolean" },
  });
  const jsonOutput = getBooleanFlag(values, "json");
  const interactive = shouldUseInteractive(values, jsonOutput);
  const runtimeConfig = await requireAuthContext(getStringFlag(values, "baseUrl"));

  let filePath = positionals[0]?.trim() ?? "";
  if (!filePath && interactive) {
    filePath = await promptForQuery({
      message: "Path to the PDF you want to upload",
      placeholder: "./fat.pdf",
    });
  }

  if (!filePath) {
    throw new Error(
      "Usage: examcooker papers upload <file> --course <code> --exam-type <type> --year <year>",
    );
  }

  await access(resolve(filePath));
  const resolvedFilePath = resolve(filePath);
  const fileName = basename(resolvedFilePath);

  let courseCode = getStringFlag(values, "course");
  let examType = getStringFlag(values, "examType") as CliExamType | undefined;
  let year = getStringFlag(values, "year");
  let title =
    getStringFlag(values, "title") ?? fileName.replace(/\.pdf$/i, "");
  let slot = getStringFlag(values, "slot");
  let semester = getStringFlag(values, "semester") as CliSemester | undefined;
  let campus = getStringFlag(values, "campus") as CliCampus | undefined;
  let answerKey = getBooleanFlag(values, "answerKey");

  if (interactive) {
    if (!courseCode) {
      const selectedCourse = await resolveCourseSelection(runtimeConfig, {
        message: "Search for the course you are uploading to",
        announce: false,
      });
      courseCode = selectedCourse.code;
    }

    if (!examType) {
      examType = unwrapPrompt(
        await p.select<CliExamType>({
          message: "Pick the exam type",
          options: EXAM_TYPE_ORDER.map((value) => ({
            value,
            label: formatExamTypeLabel(value),
          })),
          maxItems: 8,
        }),
        "Canceled.",
      );
    }

    if (!year) {
      year = await promptForYear();
    }

    title = unwrapPrompt(
      await p.text({
        message: "Title",
        initialValue: title,
        validate: (value) =>
          value.trim() ? undefined : "Enter a title for this upload.",
      }),
      "Canceled.",
    ).trim();

    if (!slot) {
      slot = unwrapPrompt(
        await p.text({
          message: "Slot (optional)",
          placeholder: "A1",
        }),
        "Canceled.",
      ).trim();
    }

    if (!semester) {
      const selectedSemester = unwrapPrompt(
        await p.select<CliSemester | "__skip__">({
          message: "Semester (optional)",
          options: [
            {
              value: "__skip__",
              label: "Skip",
              hint: "Leave semester unset",
            },
            ...Object.entries(SEMESTER_LABELS).map(([value, label]) => ({
              value: value as CliSemester,
              label,
            })),
          ],
          maxItems: 8,
        }),
        "Canceled.",
      );
      semester = selectedSemester === "__skip__" ? undefined : selectedSemester;
    }

    if (!campus) {
      const selectedCampus = unwrapPrompt(
        await p.select<CliCampus | "__skip__">({
          message: "Campus (optional)",
          options: [
            {
              value: "__skip__",
              label: "Skip",
              hint: "Leave campus unset",
            },
            ...Object.entries(CAMPUS_LABELS).map(([value, label]) => ({
              value: value as CliCampus,
              label,
            })),
          ],
          maxItems: 8,
        }),
        "Canceled.",
      );
      campus = selectedCampus === "__skip__" ? undefined : selectedCampus;
    }

    if (!hasFlag(values, "answerKey")) {
      answerKey = unwrapPrompt(
        await p.confirm({
          message: "Is this an answer key?",
          initialValue: false,
        }),
        "Canceled.",
      );
    }

    p.note(
      [
        `File: ${fileName}`,
        `Course: ${courseCode}`,
        `Exam: ${formatExamTypeLabel(examType)}`,
        `Year: ${year}`,
        `Title: ${title}`,
        slot ? `Slot: ${slot}` : null,
        semester ? `Semester: ${formatSemesterLabel(semester)}` : null,
        campus ? `Campus: ${formatCampusLabel(campus)}` : null,
        answerKey ? "Type: Answer key" : "Type: Question paper",
      ]
        .filter(Boolean)
        .join("\n"),
      "Ready to upload",
    );

    const confirmed = unwrapPrompt(
      await p.confirm({
        message: "Upload this PDF now?",
        initialValue: true,
      }),
      "Canceled.",
    );

    if (!confirmed) {
      exitWithCancel("Upload canceled.");
    }
  }

  if (!courseCode || !examType || !year) {
    throw new Error(
      "Paper uploads require --course, --exam-type, and --year.",
    );
  }
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Paper uploads require a 4-digit year.");
  }

  const fileBuffer = await readFile(resolvedFilePath);
  const file = new File([fileBuffer], fileName, { type: "application/pdf" });
  const formData = new FormData();

  formData.append("file", file);
  formData.append("variant", "Past Papers");
  formData.append("course", courseCode);
  formData.append("examType", examType);
  formData.append("year", year);
  formData.append("title", title);
  if (slot) formData.append("slot", slot);
  if (semester) formData.append("semester", semester);
  if (campus) formData.append("campus", campus);
  if (answerKey) {
    formData.append("answerKey", "true");
  }

  const spinner = createSpinner();
  spinner.start("Uploading paper...");
  const response = await requestRaw(runtimeConfig.baseUrl, "/api/cli/uploads", {
    method: "POST",
    token: runtimeConfig.token,
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        upload?: {
          id?: string | null;
          title?: string;
          variant?: string;
          course?: { id?: string; code?: string } | null;
          hasAnswerKey?: boolean;
        };
        error?: string;
      }
    | null;

  if (!response.ok || !payload?.success) {
    spinner.stop("Upload failed");
    throw new Error(payload?.error || "Upload failed.");
  }

  spinner.stop("Upload complete");

  if (jsonOutput) {
    printJson(payload);
    return;
  }

  console.log(
    `Uploaded ${pc.bold(payload.upload?.title ?? fileName)}${payload.upload?.course?.code ? ` to ${payload.upload.course.code}` : ""}`,
  );
}

function formatCliErrorMessage(error: unknown) {
  const runtimeConfig = lastRuntimeConfig;

  if (
    runtimeConfig &&
    error instanceof Error &&
    !(error instanceof ApiError) &&
    isNetworkErrorMessage(error.message)
  ) {
    return formatRuntimeConnectionError(runtimeConfig, error.message);
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function isNetworkErrorMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === "fetch failed" ||
    normalized.includes("unable to connect") ||
    normalized.includes("network") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("timed out")
  );
}

function isLikelyLocalBaseUrl(baseUrl: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(baseUrl);
}

function formatRuntimeConnectionError(
  runtimeConfig: RuntimeConfig,
  rawMessage: string,
) {
  const lines = [`Could not reach ${runtimeConfig.baseUrl}.`];

  if (runtimeConfig.baseUrlSource === "config") {
    lines.push(`This base URL is coming from ${getConfigPath()}.`);
  } else if (runtimeConfig.baseUrlSource === "env") {
    lines.push("This base URL is coming from EXAMCOOKER_BASE_URL.");
  }

  if (isLikelyLocalBaseUrl(runtimeConfig.baseUrl)) {
    lines.push(
      `That looks like a local ExamCooker server. Start it, or rerun with \`--base-url ${getDefaultBaseUrl()}\`.`,
    );
  } else if (runtimeConfig.baseUrl !== getDefaultBaseUrl()) {
    lines.push(
      `If you meant to use production, rerun with \`--base-url ${getDefaultBaseUrl()}\`.`,
    );
  }

  lines.push(`Original error: ${rawMessage}`);
  return lines.join("\n");
}

function printRuntimeDebug(runtimeConfig: RuntimeConfig) {
  p.note(
    [
      `Base URL: ${runtimeConfig.baseUrl}`,
      `Source: ${runtimeConfig.baseUrlSource}`,
      `Config: ${getConfigPath()}`,
    ].join("\n"),
    "Debug",
  );
}

async function runInteractiveHome() {
  showBanner();

  for (;;) {
    const runtimeConfig = await resolveCliRuntimeConfig();
    const accountLabel =
      runtimeConfig.storedConfig.user?.email ??
      runtimeConfig.storedConfig.user?.name ??
      "current account";

    const action = unwrapPrompt(
      await p.select<
        | "papers"
        | "courses"
        | "upload"
        | "whoami"
        | "login"
        | "logout"
        | "help"
        | "exit"
      >({
        message: runtimeConfig.token
          ? "What do you want to do?"
          : "Sign in to start using ExamCooker",
        options: runtimeConfig.token
          ? [
              {
                value: "papers",
                label: "Search past papers",
                hint: "Guided course -> exam type -> paper flow",
              },
              {
                value: "courses",
                label: "Search courses",
                hint: "Find a course, then browse its papers",
              },
              {
                value: "upload",
                label: "Upload a paper",
                hint: "Guided PDF upload flow",
              },
              {
                value: "whoami",
                label: "Account details",
                hint: accountLabel,
              },
              {
                value: "login",
                label: "Switch account",
                hint: "Start a fresh browser-based login",
              },
              {
                value: "logout",
                label: "Sign out",
                hint: "Clear local CLI auth",
              },
              {
                value: "help",
                label: "Show help",
                hint: "See commands and examples",
              },
              {
                value: "exit",
                label: "Exit",
                hint: "Close the CLI",
              },
            ]
          : [
              {
                value: "login",
                label: "Sign in",
                hint: "Connect your ExamCooker account",
              },
              {
                value: "help",
                label: "Show help",
                hint: "See commands and examples",
              },
              {
                value: "exit",
                label: "Exit",
                hint: "Close the CLI",
              },
            ],
        maxItems: 8,
      }),
      "Canceled.",
    );

    if (action === "exit") {
      return;
    }

    if (action === "help") {
      showHelp();
      continue;
    }

    try {
      if (action === "login") {
        await runAuthLogin([]);
        continue;
      }

      if (action === "logout") {
        await runAuthLogout([]);
        continue;
      }

      if (action === "papers") {
        await runPaperSearch([]);
        continue;
      }

      if (action === "courses") {
        await runCourseSearch([]);
        continue;
      }

      if (action === "upload") {
        await runPaperUpload([]);
        continue;
      }

      if (action === "whoami") {
        await runWhoAmI([]);
      }
    } catch (error) {
      p.log.error(formatCliErrorMessage(error));
    }
  }
}

async function run(argv: string[]) {
  const [command, subcommand, ...rest] = argv;

  if (!command) {
    if (shouldAnimateTerminalUi()) {
      await runInteractiveHome();
      return;
    }

    showBanner();
    showHelp();
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    showBanner();
    showHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "auth":
      if (subcommand === "login") {
        await runAuthLogin(rest);
        return;
      }
      if (subcommand === "logout") {
        await runAuthLogout(rest);
        return;
      }
      break;
    case "whoami":
      await runWhoAmI([subcommand, ...rest].filter(Boolean));
      return;
    case "courses":
      if (subcommand === "search") {
        await runCourseSearch(rest);
        return;
      }
      break;
    case "papers":
      if (subcommand === "search") {
        await runPaperSearch(rest);
        return;
      }
      if (subcommand === "view") {
        await runPaperView(rest);
        return;
      }
      if (subcommand === "download") {
        await runPaperDownload(rest);
        return;
      }
      if (subcommand === "upload") {
        await runPaperUpload(rest);
        return;
      }
      break;
    default:
      break;
  }

  throw new Error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
}

run(process.argv.slice(2)).catch((error) => {
  console.error(pc.red(formatCliErrorMessage(error)));
  process.exitCode = 1;
});
