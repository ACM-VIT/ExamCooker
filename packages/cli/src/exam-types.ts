export const EXAM_TYPE_LABELS = {
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

export type CliExamType = keyof typeof EXAM_TYPE_LABELS;

export const EXAM_TYPE_ORDER = Object.keys(EXAM_TYPE_LABELS) as CliExamType[];

const EXAM_TYPE_ALIASES: Record<string, CliExamType> = {
  cat1: "CAT_1",
  "cat 1": "CAT_1",
  "cat i": "CAT_1",
  "cat one": "CAT_1",
  cat2: "CAT_2",
  "cat 2": "CAT_2",
  "cat ii": "CAT_2",
  "cat two": "CAT_2",
  fat: "FAT",
  "final": "FAT",
  "final assessment": "FAT",
  "final assessment test": "FAT",
  "end sem": "FAT",
  "end semester": "FAT",
  endsem: "FAT",
  "model cat1": "MODEL_CAT_1",
  "model cat 1": "MODEL_CAT_1",
  "model cat i": "MODEL_CAT_1",
  "model cat one": "MODEL_CAT_1",
  "sample cat1": "MODEL_CAT_1",
  "sample cat 1": "MODEL_CAT_1",
  "model cat2": "MODEL_CAT_2",
  "model cat 2": "MODEL_CAT_2",
  "model cat ii": "MODEL_CAT_2",
  "model cat two": "MODEL_CAT_2",
  "sample cat2": "MODEL_CAT_2",
  "sample cat 2": "MODEL_CAT_2",
  "model final": "MODEL_FAT",
  "model fat": "MODEL_FAT",
  "sample final": "MODEL_FAT",
  "sample fat": "MODEL_FAT",
  mid: "MID",
  "mid sem": "MID",
  "mid semester": "MID",
  midsem: "MID",
  midterm: "MID",
  "mid term": "MID",
  quizzes: "QUIZ",
  "continuous internal": "CIA",
  "continuous internal assessment": "CIA",
} as const;

function normalizeExamTypeInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCliExamTypeInput(
  value: string | null | undefined,
): CliExamType | undefined {
  const normalized = normalizeExamTypeInput(value ?? "");
  if (!normalized) {
    return undefined;
  }

  const enumKey = normalized.replace(/\s+/g, "_").toUpperCase();
  if (enumKey in EXAM_TYPE_LABELS) {
    return enumKey as CliExamType;
  }

  return (
    EXAM_TYPE_ALIASES[normalized] ??
    EXAM_TYPE_ALIASES[normalized.replace(/\s+/g, "")]
  );
}

export function formatExamTypeInputList() {
  return EXAM_TYPE_ORDER.map((examType) => EXAM_TYPE_LABELS[examType]).join(", ");
}
