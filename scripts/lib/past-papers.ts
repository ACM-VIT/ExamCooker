import type { Queryable } from "./db";
import { queryRows } from "./db";

export type CourseRow = {
  id: string;
  code: string;
  title: string;
  aliases: string[];
};

export type PaperTagRow = {
  id: string;
  name: string;
};

export type PaperRow = {
  id: string;
  title: string;
  fileUrl: string;
  thumbNailUrl: string | null;
  isClear: boolean;
  examType: string | null;
  slot: string | null;
  year: number | null;
  semester: string;
  campus: string;
  hasAnswerKey: boolean;
  questionPaperId: string | null;
  createdAt: Date;
  updatedAt: Date;
  courseId: string | null;
  course: CourseRow | null;
  tags: PaperTagRow[];
};

type LoadPastPaperOptions = {
  courseCodes?: string[];
  createdAfter?: Date | null;
  limit?: number | null;
  requireStructured?: boolean;
  ids?: string[];
};

export function getPaperTagNames(paper: Pick<PaperRow, "tags">) {
  return paper.tags.map((tag) => tag.name);
}

export async function loadPastPaperRows(
  queryable: Queryable,
  options: LoadPastPaperOptions = {},
) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.requireStructured) {
    conditions.push(
      `p."isClear" = TRUE`,
      `p."courseId" IS NOT NULL`,
      `p."examType" IS NOT NULL`,
      `p.slot IS NOT NULL`,
      `p.year IS NOT NULL`,
    );
  }

  if (options.courseCodes && options.courseCodes.length > 0) {
    params.push(options.courseCodes);
    conditions.push(`c.code = ANY($${params.length}::text[])`);
  }

  if (options.createdAfter) {
    params.push(options.createdAfter);
    conditions.push(`p."createdAt" > $${params.length}`);
  }

  if (options.ids && options.ids.length > 0) {
    params.push(options.ids);
    conditions.push(`p.id = ANY($${params.length}::text[])`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitClause =
    typeof options.limit === "number" && options.limit > 0
      ? `LIMIT ${options.limit}`
      : "";

  const rows = await queryRows<{
    id: string;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
    isClear: boolean;
    examType: string | null;
    slot: string | null;
    year: number | null;
    semester: string;
    campus: string;
    hasAnswerKey: boolean;
    questionPaperId: string | null;
    createdAt: Date;
    updatedAt: Date;
    courseId: string | null;
    courseRowId: string | null;
    courseCode: string | null;
    courseTitle: string | null;
    courseAliases: string[] | null;
    tagId: string | null;
    tagName: string | null;
  }>(
    queryable,
    `
      SELECT
        p.id,
        p.title,
        p."fileUrl",
        p."thumbNailUrl",
        p."isClear",
        p."examType",
        p.slot,
        p.year,
        p.semester,
        p.campus,
        p."hasAnswerKey",
        p."questionPaperId",
        p."createdAt",
        p."updatedAt",
        p."courseId",
        c.id AS "courseRowId",
        c.code AS "courseCode",
        c.title AS "courseTitle",
        c.aliases AS "courseAliases",
        t.id AS "tagId",
        t.name AS "tagName"
      FROM "PastPaper" p
      LEFT JOIN "Course" c ON c.id = p."courseId"
      LEFT JOIN "_PastPaperToTag" ppt ON ppt."A" = p.id
      LEFT JOIN "Tag" t ON t.id = ppt."B"
      ${whereClause}
      ORDER BY p.year ASC NULLS LAST, p.title ASC, p.id ASC
      ${limitClause}
    `,
    params,
  );

  const papers = new Map<string, PaperRow>();

  for (const row of rows) {
    const existing =
      papers.get(row.id) ??
      {
        id: row.id,
        title: row.title,
        fileUrl: row.fileUrl,
        thumbNailUrl: row.thumbNailUrl,
        isClear: row.isClear,
        examType: row.examType,
        slot: row.slot,
        year: row.year,
        semester: row.semester,
        campus: row.campus,
        hasAnswerKey: row.hasAnswerKey,
        questionPaperId: row.questionPaperId,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        courseId: row.courseId,
        course:
          row.courseRowId && row.courseCode && row.courseTitle
            ? {
                id: row.courseRowId,
                code: row.courseCode,
                title: row.courseTitle,
                aliases: row.courseAliases ?? [],
              }
            : null,
        tags: [],
      };

    if (row.tagId && row.tagName) {
      existing.tags.push({
        id: row.tagId,
        name: row.tagName,
      });
    }

    papers.set(row.id, existing);
  }

  return [...papers.values()];
}

export async function loadCourseRows(queryable: Queryable) {
  return queryRows<CourseRow>(
    queryable,
    'SELECT id, code, title, aliases FROM "Course" ORDER BY code ASC',
  );
}

export async function loadTagNameRows(queryable: Queryable) {
  return queryRows<{ name: string }>(
    queryable,
    'SELECT name FROM "Tag" ORDER BY name ASC',
  );
}

export async function ensureTagNames(queryable: Queryable, names: string[]) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  for (const name of uniqueNames) {
    await queryable.query(
      `
        INSERT INTO "Tag" (id, name, aliases, "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, ARRAY[]::text[], NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
      `,
      [name],
    );
  }
}

export async function loadTagIdMapByName(queryable: Queryable, names: string[]) {
  if (names.length === 0) {
    return new Map<string, string>();
  }

  const rows = await queryRows<{ id: string; name: string }>(
    queryable,
    'SELECT id, name FROM "Tag" WHERE name = ANY($1::text[])',
    [[...new Set(names)]],
  );

  return new Map(rows.map((row) => [row.name, row.id]));
}

export async function setPastPaperTags(
  queryable: Queryable,
  paperId: string,
  tagNames: string[],
) {
  const uniqueTagNames = [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
  await ensureTagNames(queryable, uniqueTagNames);
  const tagIdByName = await loadTagIdMapByName(queryable, uniqueTagNames);

  await queryable.query('DELETE FROM "_PastPaperToTag" WHERE "A" = $1', [paperId]);

  for (const tagName of uniqueTagNames) {
    const tagId = tagIdByName.get(tagName);
    if (!tagId) {
      throw new Error(`Tag ${tagName} was not found after upsert.`);
    }

    await queryable.query(
      `
        INSERT INTO "_PastPaperToTag" ("A", "B")
        VALUES ($1, $2)
        ON CONFLICT ("A", "B") DO NOTHING
      `,
      [paperId, tagId],
    );
  }
}

export async function upsertCourseByCode(
  queryable: Queryable,
  input: Pick<CourseRow, "code" | "title" | "aliases">,
) {
  const rows = await queryRows<CourseRow>(
    queryable,
    `
      INSERT INTO "Course" (id, code, title, aliases, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
      ON CONFLICT (code)
      DO UPDATE SET
        aliases = EXCLUDED.aliases,
        "updatedAt" = NOW()
      RETURNING id, code, title, aliases
    `,
    [input.code, input.title, input.aliases],
  );

  const [course] = rows;
  if (!course) {
    throw new Error(`Failed to upsert course ${input.code}`);
  }

  return course;
}
