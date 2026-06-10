import { normalizeCourseCode } from "@/lib/course-tags";

export const resourceKinds = [
  "course",
  "note",
  "past_paper",
  "syllabus",
  "resource",
] as const;

export type ResourceKind = (typeof resourceKinds)[number];

export type ResourceRef = {
  kind: ResourceKind;
  id: string;
};

const resourceKindSet = new Set<string>(resourceKinds);

export function toResourceId(ref: ResourceRef) {
  return `${ref.kind}:${ref.id}`;
}

function fromTypedId(value: string): ResourceRef | null {
  const separator = value.indexOf(":");
  if (separator <= 0) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1).trim();
  if (!id || !resourceKindSet.has(kind)) return null;

  return {
    kind: kind as ResourceKind,
    id,
  };
}

function fromExamCookerPath(pathname: string): ResourceRef | null {
  const segments = pathname.split("/").filter(Boolean);
  const [section, first, second, third] = segments;

  if (section === "notes") {
    if (first === "course" && second) return { kind: "course", id: second };
    if (first) return { kind: "note", id: first };
  }

  if (section === "syllabus") {
    if (first === "course" && second) return { kind: "course", id: second };
    if (first) return { kind: "syllabus", id: first };
  }

  if (section === "resources") {
    if (first === "course" && second) return { kind: "course", id: second };
    if (first) return { kind: "resource", id: first };
  }

  if (section === "past_papers") {
    if (second === "paper" && third) return { kind: "past_paper", id: third };
    if (first) return { kind: "course", id: first };
  }

  return null;
}

export function parseResourceRef(value: string): ResourceRef | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const typedId = fromTypedId(trimmed);
  if (typedId) return typedId;

  try {
    const url = new URL(trimmed);
    const fromPath = fromExamCookerPath(url.pathname);
    if (fromPath) return fromPath;
  } catch {
    if (trimmed.startsWith("/")) {
      const fromPath = fromExamCookerPath(trimmed);
      if (fromPath) return fromPath;
    }
  }

  const courseCode = normalizeCourseCode(trimmed);
  return courseCode ? { kind: "course", id: courseCode } : null;
}
