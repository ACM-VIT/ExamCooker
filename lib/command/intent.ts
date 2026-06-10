import type { ExamType } from "@/db";

export type CommandResourceIntent = "notes" | "syllabus" | "papers" | "course";

export type CommandIntent = {
  resource: CommandResourceIntent | null;
  examType: ExamType | null;
  confidence: "high" | "medium" | "low";
};

const NOTE_TERMS = [
  "note",
  "notes",
  "lecture",
  "lectures",
  "material",
  "materials",
  "study material",
  "revision",
];

const NOTE_PREFIXES = ["not", "lec", "mat", "rev"];

const SYLLABUS_TERMS = [
  "syllabus",
  "outline",
  "curriculum",
  "unit",
  "units",
];

const SYLLABUS_PREFIXES = ["syl", "sylla", "syllab", "outl", "curr"];

const PAPER_TERMS = [
  "paper",
  "papers",
  "pyq",
  "question",
  "questions",
  "previous year",
  "exam",
  "exams",
  "answer key",
  "solutions",
];

const PAPER_PREFIXES = ["pap", "pyq", "ques", "prev", "exam", "sol"];

const EXAM_PATTERNS: Array<{ examType: ExamType; patterns: RegExp[] }> = [
  {
    examType: "MODEL_CAT_1",
    patterns: [/model\s*cat\s*-?\s*1/, /sample\s*cat\s*-?\s*1/],
  },
  {
    examType: "MODEL_CAT_2",
    patterns: [/model\s*cat\s*-?\s*2/, /sample\s*cat\s*-?\s*2/],
  },
  {
    examType: "MODEL_FAT",
    patterns: [/model\s*fat/, /sample\s*fat/, /model\s*final/],
  },
  {
    examType: "CAT_1",
    patterns: [/cat\s*-?\s*1/, /cat1/],
  },
  {
    examType: "CAT_2",
    patterns: [/cat\s*-?\s*2/, /cat2/],
  },
  {
    examType: "FAT",
    patterns: [/\bfat\b/, /final\s+assessment/, /end\s*sem/],
  },
  {
    examType: "MID",
    patterns: [/\bmid\b/, /mid\s*sem/, /midterm/],
  },
  {
    examType: "QUIZ",
    patterns: [/\bquiz\b/, /quizzes/],
  },
  {
    examType: "CIA",
    patterns: [/\bcia\b/, /continuous\s+internal/],
  },
];

export function normalizeCommandSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyTerm(normalized: string, terms: string[]) {
  return terms.some((term) => normalized.includes(term));
}

function isResourceWord(word: string, terms: string[], prefixes: string[]) {
  return (
    terms.some((term) => term === word) ||
    prefixes.some((prefix) => word === prefix || word.startsWith(prefix))
  );
}

function includesResourceTerm(
  normalized: string,
  terms: string[],
  prefixes: string[],
) {
  if (includesAnyTerm(normalized, terms)) return true;

  const words = normalized.split(" ").filter(Boolean);
  return words.some((word) => isResourceWord(word, terms, prefixes));
}

export function isCommandResourceQueryTerm(value: string) {
  const normalized = normalizeCommandSearch(value);
  if (!normalized || normalized.includes(" ")) return false;

  return (
    isResourceWord(normalized, NOTE_TERMS, NOTE_PREFIXES) ||
    isResourceWord(normalized, SYLLABUS_TERMS, SYLLABUS_PREFIXES) ||
    isResourceWord(normalized, PAPER_TERMS, PAPER_PREFIXES)
  );
}

function detectExamType(query: string): ExamType | null {
  for (const { examType, patterns } of EXAM_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(query))) {
      return examType;
    }
  }
  return null;
}

export function resolveCommandIntent(query: string): CommandIntent {
  const normalized = normalizeCommandSearch(query);
  if (!normalized) {
    return {
      resource: null,
      examType: null,
      confidence: "low",
    };
  }

  const examType = detectExamType(normalized);

  if (includesResourceTerm(normalized, NOTE_TERMS, NOTE_PREFIXES)) {
    return {
      resource: "notes",
      examType: null,
      confidence: "high",
    };
  }

  if (includesResourceTerm(normalized, SYLLABUS_TERMS, SYLLABUS_PREFIXES)) {
    return {
      resource: "syllabus",
      examType: null,
      confidence: "high",
    };
  }

  if (examType || includesResourceTerm(normalized, PAPER_TERMS, PAPER_PREFIXES)) {
    return {
      resource: "papers",
      examType,
      confidence: examType ? "high" : "medium",
    };
  }

  return {
    resource: "course",
    examType: null,
    confidence: "low",
  };
}
