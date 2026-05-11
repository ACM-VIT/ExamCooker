import type { Agent } from "agents";
import { normalizeCommandSearch } from "../../lib/command/intent";
import type {
  CommandAgentState,
  CommandCoursePreference,
  CommandCoursePreferenceInput,
  CommandHistoryEvent,
  CommandHistoryRow,
  CommandStats,
  Env,
} from "./types";

type CommandAgent = Agent<Env, CommandAgentState>;

type CountRow = {
  count: number;
};

type ResourceCountRow = {
  resource: string | null;
  count: number;
};

type ExamTypeCountRow = {
  examType: string | null;
  count: number;
};

const HISTORY_RETENTION_DAYS = 30;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const COMMAND_PREFERENCE_LIMIT = 12;

export function ensureCommandHistorySchema(agent: CommandAgent) {
  agent.sql`
    CREATE TABLE IF NOT EXISTS command_events (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      resource TEXT,
      exam_type TEXT,
      confidence TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `;

  agent.sql`
    CREATE INDEX IF NOT EXISTS command_events_created_at_idx
    ON command_events (created_at DESC)
  `;

  agent.sql`
    CREATE INDEX IF NOT EXISTS command_events_resource_idx
    ON command_events (resource)
  `;

  agent.sql`
    CREATE TABLE IF NOT EXISTS command_course_preferences (
      user_key TEXT NOT NULL,
      query_key TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_title TEXT,
      resource_key TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_key, query_key, course_code, resource_key)
    )
  `;

  agent.sql`
    CREATE INDEX IF NOT EXISTS command_course_preferences_lookup_idx
    ON command_course_preferences (user_key, query_key, weight DESC, updated_at DESC)
  `;
}

export function recordCommandEvent(
  agent: CommandAgent,
  event: CommandHistoryEvent,
) {
  agent.sql`
    INSERT INTO command_events (
      id,
      query,
      resource,
      exam_type,
      confidence,
      created_at
    )
    VALUES (
      ${event.id},
      ${event.query},
      ${event.resource},
      ${event.examType},
      ${event.confidence},
      ${event.createdAt}
    )
  `;
}

function getPreferenceResourceKey(resource: CommandCoursePreferenceInput["resource"]) {
  return resource || "course";
}

function readPreferenceResourceKey(
  resourceKey: string,
): CommandCoursePreference["resource"] {
  if (
    resourceKey === "notes" ||
    resourceKey === "syllabus" ||
    resourceKey === "papers" ||
    resourceKey === "course"
  ) {
    return resourceKey;
  }

  return "course";
}

export function recordCommandCoursePreference(
  agent: CommandAgent,
  input: CommandCoursePreferenceInput,
) {
  const userKey = input.userKey.trim();
  const queryKey = normalizeCommandSearch(input.query);
  const courseCode = input.courseCode.trim().toUpperCase();
  const courseTitle = input.courseTitle?.trim() || null;
  const resourceKey = getPreferenceResourceKey(input.resource);

  if (!userKey || !queryKey || !courseCode) {
    return null;
  }

  agent.sql`
    INSERT INTO command_course_preferences (
      user_key,
      query_key,
      course_code,
      course_title,
      resource_key,
      weight,
      updated_at
    )
    VALUES (
      ${userKey},
      ${queryKey},
      ${courseCode},
      ${courseTitle},
      ${resourceKey},
      1,
      ${input.selectedAt}
    )
    ON CONFLICT (user_key, query_key, course_code, resource_key)
    DO UPDATE SET
      course_title = excluded.course_title,
      weight = command_course_preferences.weight + 1,
      updated_at = excluded.updated_at
  `;

  return {
    queryKey,
    courseCode,
    resource: readPreferenceResourceKey(resourceKey),
  };
}

type CommandCoursePreferenceRow = {
  courseCode: string;
  courseTitle: string | null;
  resourceKey: string;
  weight: number;
  updatedAt: number;
};

export function listCommandCoursePreferences(
  agent: CommandAgent,
  userKey: string | null | undefined,
  query: string,
): CommandCoursePreference[] {
  const normalizedUserKey = userKey?.trim();
  const queryKey = normalizeCommandSearch(query);

  if (!normalizedUserKey || !queryKey) {
    return [];
  }

  const rows = agent.sql<CommandCoursePreferenceRow>`
    SELECT
      course_code AS courseCode,
      course_title AS courseTitle,
      resource_key AS resourceKey,
      weight,
      updated_at AS updatedAt
    FROM command_course_preferences
    WHERE user_key = ${normalizedUserKey}
      AND query_key = ${queryKey}
    ORDER BY weight DESC, updated_at DESC
    LIMIT ${COMMAND_PREFERENCE_LIMIT}
  `;

  return rows.map((row) => ({
    courseCode: row.courseCode,
    courseTitle: row.courseTitle,
    resource: readPreferenceResourceKey(row.resourceKey),
    weight: row.weight,
    updatedAt: row.updatedAt,
  }));
}

export function listCommandHistory(agent: CommandAgent, limit: number) {
  return agent.sql<CommandHistoryRow>`
    SELECT
      id,
      query,
      resource,
      exam_type AS examType,
      confidence,
      created_at AS createdAt
    FROM command_events
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export function getCommandStats(agent: CommandAgent): CommandStats {
  const totalRows = agent.sql<CountRow>`
    SELECT COUNT(*) AS count
    FROM command_events
  `;

  const byResource = agent.sql<ResourceCountRow>`
    SELECT resource, COUNT(*) AS count
    FROM command_events
    GROUP BY resource
    ORDER BY count DESC
    LIMIT 8
  `;

  const byExamType = agent.sql<ExamTypeCountRow>`
    SELECT exam_type AS examType, COUNT(*) AS count
    FROM command_events
    WHERE exam_type IS NOT NULL
    GROUP BY exam_type
    ORDER BY count DESC
    LIMIT 8
  `;

  return {
    total: totalRows[0]?.count ?? 0,
    byResource: byResource.map((row) => ({
      resource: row.resource ?? "none",
      count: row.count,
    })),
    byExamType: byExamType.map((row) => ({
      examType: row.examType ?? "none",
      count: row.count,
    })),
  };
}

export function pruneCommandHistory(agent: CommandAgent) {
  const cutoff = Date.now() - HISTORY_RETENTION_MS;

  agent.sql`
    DELETE FROM command_events
    WHERE created_at < ${cutoff}
  `;
}
