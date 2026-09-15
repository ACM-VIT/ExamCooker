export type CourseSearchItem = {
  code: string;
  title: string;
  paperCount: number;
  noteCount: number;
  aliases: string[];
  syllabusId: string | null;
};

// Only the server/client transport uses tuples. Search and native UI code keep
// named fields. Course codes identify results; database IDs aren't used here.
export type CourseSearchPayload = Array<[
  code: string,
  title: string,
  paperCount: number,
  noteCount: number,
  aliases: string[],
  syllabusId?: string,
]>;

export function packCourseSearch(
  courses: Array<Omit<CourseSearchItem, "aliases" | "syllabusId"> & {
    aliases?: string[];
    syllabusId?: string | null;
  }>,
): CourseSearchPayload {
  return courses.map(({ code, title, paperCount, noteCount, aliases, syllabusId }) => {
    const row: CourseSearchPayload[number] = [code, title, paperCount, noteCount, aliases ?? []];
    if (syllabusId != null) row.push(syllabusId);
    return row;
  });
}

export function unpackCourseSearch(courses: CourseSearchPayload): CourseSearchItem[] {
  return courses.map(([code, title, paperCount, noteCount, aliases, syllabusId]) => ({
    code, title, paperCount, noteCount, aliases, syllabusId: syllabusId ?? null,
  }));
}
