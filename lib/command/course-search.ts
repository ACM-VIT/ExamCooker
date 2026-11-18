import {
  isCommandResourceQueryTerm,
  normalizeCommandSearch,
  stripRecatExamTerms,
} from "@/lib/command/intent";
import { normalizeCourseCode } from "@/lib/course-tags";

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

const COMMAND_PHRASE_PATTERNS = COMMAND_PHRASES.map(
  (phrase) => new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "g"),
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getCourseSearchText(query: string) {
  let normalized = stripRecatExamTerms(normalizeCommandSearch(query));

  for (const pattern of COMMAND_PHRASE_PATTERNS) {
    normalized = ` ${normalized} `.replace(pattern, " ");
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

export function scoreCourse(
  course: { code: string; title: string; aliases: string[] },
  query: string,
  aliasCodes: Set<string>,
) {
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
