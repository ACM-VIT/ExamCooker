import { Agent, callable } from "agents";
import { emptyResponse, jsonResponse, readJsonPayload } from "./http";
import type {
  Env,
  StudyBrainAgentState,
  StudyBrainPlanRunInput,
} from "./types";

type StudyBrainRunRow = {
  id: string;
  status: string;
  inputJson: string;
  resultJson: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

const STUDY_BRAIN_RUN_LIMIT = 2000;

function ensureStudyBrainSchema(agent: Agent<Env, StudyBrainAgentState>) {
  agent.sql`
    CREATE TABLE IF NOT EXISTS study_brain_runs (
      id TEXT PRIMARY KEY,
      user_key TEXT,
      course_code TEXT NOT NULL,
      exam_type TEXT,
      slot TEXT,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      result_json TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `;

  agent.sql`
    CREATE INDEX IF NOT EXISTS study_brain_runs_lookup_idx
    ON study_brain_runs (user_key, updated_at DESC)
  `;

  agent.sql`
    CREATE INDEX IF NOT EXISTS study_brain_runs_course_idx
    ON study_brain_runs (course_code, exam_type, slot, updated_at DESC)
  `;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizePlanInput(input: StudyBrainPlanRunInput) {
  const courseCode = normalizeString(input.courseCode).toUpperCase();
  if (!courseCode) {
    throw new Error("courseCode is required.");
  }

  const selectedTopics = Array.isArray(input.selectedTopics)
    ? input.selectedTopics
        .map((topic) => ({
          topicId: normalizeNullableString(topic.topicId),
          title: normalizeString(topic.title),
          rawText: normalizeString(topic.rawText),
        }))
        .filter((topic) => topic.title)
        .slice(0, 24)
    : [];

  return {
    userKey: normalizeNullableString(input.userKey),
    courseCode,
    examType: normalizeNullableString(input.examType),
    semester: normalizeString(input.semester) || "UNKNOWN",
    campus: normalizeString(input.campus) || "VELLORE",
    slot: normalizeNullableString(input.slot)?.toUpperCase() ?? null,
    syllabusId: normalizeNullableString(input.syllabusId),
    selectedTopics,
    preferences: Array.isArray(input.preferences)
      ? input.preferences.map(normalizeString).filter(Boolean).slice(0, 8)
      : [],
  };
}

function pruneStudyBrainRuns(agent: Agent<Env, StudyBrainAgentState>) {
  agent.sql`
    DELETE FROM study_brain_runs
    WHERE id NOT IN (
      SELECT id
      FROM study_brain_runs
      ORDER BY updated_at DESC
      LIMIT ${STUDY_BRAIN_RUN_LIMIT}
    )
  `;
}

export class ExamCookerStudyBrainAgent extends Agent<Env, StudyBrainAgentState> {
  initialState: StudyBrainAgentState = {
    runsCreated: 0,
    lastRunId: null,
    lastStatus: null,
    updatedAt: null,
  };

  async onStart() {
    ensureStudyBrainSchema(this);
    await this.scheduleEvery(86_400, "pruneRuns", undefined, {
      _idempotent: true,
    });
  }

  async onRequest(request: Request) {
    if (request.method === "OPTIONS") {
      return emptyResponse({ status: 204 });
    }

    const { pathname } = new URL(request.url);
    const action = pathname.split("/").filter(Boolean).at(-1);

    if (action === "runs" && request.method === "POST") {
      return this.handleCreateRun(request);
    }

    if (action === "runs" && request.method === "GET") {
      return this.handleListRuns(request);
    }

    return jsonResponse({ error: "Unknown study brain action." }, { status: 404 });
  }

  async pruneRuns() {
    ensureStudyBrainSchema(this);
    pruneStudyBrainRuns(this);
  }

  @callable()
  async createPlanRun(input: StudyBrainPlanRunInput) {
    ensureStudyBrainSchema(this);
    const normalized = normalizePlanInput(input);
    const timestamp = Date.now();
    const id = crypto.randomUUID();

    this.sql`
      INSERT INTO study_brain_runs (
        id,
        user_key,
        course_code,
        exam_type,
        slot,
        status,
        input_json,
        result_json,
        error,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${normalized.userKey},
        ${normalized.courseCode},
        ${normalized.examType},
        ${normalized.slot},
        ${"queued"},
        ${JSON.stringify(normalized)},
        ${null},
        ${null},
        ${timestamp},
        ${timestamp}
      )
    `;

    const nextState = {
      runsCreated: this.state.runsCreated + 1,
      lastRunId: id,
      lastStatus: "queued",
      updatedAt: new Date(timestamp).toISOString(),
    };
    this.setState(nextState);
    pruneStudyBrainRuns(this);

    return {
      run: {
        id,
        status: "queued",
        input: normalized,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      state: nextState,
      source: "cloudflare-study-brain-agent",
    };
  }

  @callable()
  async getPlanRun(input: { id?: string }) {
    ensureStudyBrainSchema(this);
    const id = normalizeString(input.id);
    if (!id) return null;

    const rows = this.sql<StudyBrainRunRow>`
      SELECT
        id,
        status,
        input_json AS inputJson,
        result_json AS resultJson,
        error,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM study_brain_runs
      WHERE id = ${id}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      status: row.status,
      input: JSON.parse(row.inputJson) as unknown,
      result: row.resultJson ? (JSON.parse(row.resultJson) as unknown) : null,
      error: row.error,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async handleCreateRun(request: Request) {
    const payload = (await readJsonPayload(request)) as StudyBrainPlanRunInput | null;

    try {
      return jsonResponse(await this.createPlanRun(payload ?? {}));
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Invalid study brain run." },
        { status: 400 },
      );
    }
  }

  private async handleListRuns(request: Request) {
    ensureStudyBrainSchema(this);
    const userKey = new URL(request.url).searchParams.get("userKey")?.trim() || null;
    const rows = this.sql<StudyBrainRunRow>`
      SELECT
        id,
        status,
        input_json AS inputJson,
        result_json AS resultJson,
        error,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM study_brain_runs
      WHERE ${userKey} IS NULL OR user_key = ${userKey}
      ORDER BY updated_at DESC
      LIMIT 20
    `;

    return jsonResponse({
      runs: rows.map((row) => ({
        id: row.id,
        status: row.status,
        input: JSON.parse(row.inputJson) as unknown,
        result: row.resultJson ? (JSON.parse(row.resultJson) as unknown) : null,
        error: row.error,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      source: "cloudflare-study-brain-agent",
    });
  }
}
