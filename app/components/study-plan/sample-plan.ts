import type { ExamType } from "@/db/enums";
import type { CourseSearchRecord } from "@/lib/data/course-catalog";
import { examTypeLabel } from "@/lib/exam-slug";
import type {
  StudyPlan,
  StudyPlanSection,
  StudyPreferenceMode,
} from "@/lib/study-brain/schemas";

type StudyPlanTask = StudyPlanSection["tasks"][number];
type StudyPlanEvidence = StudyPlanSection["evidence"][number];
type Priority = StudyPlanSection["priority"];

export type ComposerConfig = {
  course: CourseSearchRecord;
  examType: ExamType | "";
  slot: string;
  preferences: StudyPreferenceMode[];
  topics: string[];
};

// --- deterministic helpers ----------------------------------------------------

function seedNumber(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(pool: readonly T[], seed: string): T {
  return pool[seedNumber(seed) % pool.length] as T;
}

export function formatMinutes(total: number): string {
  if (total <= 0) return "0 min";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// --- content pools ------------------------------------------------------------

const DEFAULT_TOPICS = [
  "Core theory",
  "Common numericals",
  "Definitions and short answers",
  "Derivations and proofs",
  "Repeated paper questions",
];

const REASONS: Record<Priority, readonly string[]> = {
  critical: [
    "Appeared in your last two {exam} papers.",
    "High weightage on the syllabus, and it repeats most years.",
  ],
  high: [
    "Comes up in most {exam} cycles.",
    "Overlaps with what earlier slots reported.",
  ],
  medium: [
    "Shows up occasionally. A quick pass is enough.",
    "Good marks for the time if the basics feel shaky.",
  ],
  low: [
    "Lower priority this cycle.",
    "Optional if you have time left at the end.",
  ],
};

const PRIORITY_BY_INDEX: Priority[] = [
  "critical",
  "high",
  "high",
  "medium",
  "low",
];

function youtubeSearch(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function prefersAny(
  prefs: StudyPreferenceMode[],
  target: StudyPreferenceMode,
): boolean {
  return prefs.includes(target) || prefs.includes("mixed");
}

// --- section + task assembly --------------------------------------------------

function buildTasks(
  topic: string,
  priority: Priority,
  config: ComposerConfig,
  examLabel: string,
): StudyPlanTask[] {
  const { preferences, course } = config;
  const lower = topic.toLowerCase();
  const prefTasks: StudyPlanTask[] = [];

  if (course.paperCount > 0 && prefersAny(preferences, "past_papers")) {
    prefTasks.push({
      kind: "practice",
      title: `Work the ${examLabel} questions on ${lower}`,
      source: "Past papers",
      estimatedMinutes: 22,
    });
  }
  if (prefersAny(preferences, "videos")) {
    prefTasks.push({
      kind: "watch",
      title: `Watch a walkthrough of ${lower}`,
      source: "YouTube",
      url: youtubeSearch(`${course.code} ${topic}`),
      estimatedMinutes: 15,
    });
  }
  if (prefersAny(preferences, "notes") && course.noteCount > 0) {
    prefTasks.push({
      kind: "read",
      title: `Skim the clearest notes on ${lower}`,
      source: "Notes",
      estimatedMinutes: 12,
    });
  }
  if (prefersAny(preferences, "solved_examples")) {
    prefTasks.push({
      kind: "practice",
      title: "Redo three solved examples without peeking",
      source: "Solved sets",
      estimatedMinutes: 18,
    });
  }
  if (prefersAny(preferences, "quick_summaries")) {
    prefTasks.push({
      kind: "revise",
      title: "Run the one-page summary out loud",
      estimatedMinutes: 8,
      skipIfShortOnTime: true,
    });
  }

  if (prefTasks.length === 0) {
    prefTasks.push({
      kind: "read",
      title: `Read through ${lower} once`,
      source: "Syllabus",
      estimatedMinutes: 20,
    });
  }

  // Keep the core work, then close with a short recall pass that is the first
  // thing to drop when time runs out (except for the must-do topic).
  const tasks = prefTasks.slice(0, 3);
  tasks.push({
    kind: "revise",
    title: "Quick recall pass",
    estimatedMinutes: 8,
    skipIfShortOnTime: priority !== "critical",
  });

  return tasks;
}

function buildEvidence(
  index: number,
  priority: Priority,
  config: ComposerConfig,
  examLabel: string,
): { evidence: StudyPlanEvidence[]; usedWebResource: boolean } {
  const { course, slot, preferences } = config;
  const evidence: StudyPlanEvidence[] = [
    {
      type: "syllabus",
      label: `Module ${index + 1} on the syllabus`,
      confidence: "high",
    },
  ];

  if (course.paperCount > 0) {
    const seen = Math.max(1, Math.min(course.paperCount, 2 + (index % 3)));
    evidence.push({
      type: "past_paper",
      label: `Seen in ${seen} past ${examLabel} paper${seen === 1 ? "" : "s"}`,
      confidence: course.paperCount >= 4 ? "high" : "medium",
    });
  }

  if (slot && index < 2) {
    const family = slot.charAt(0).toUpperCase();
    evidence.push({
      type: "slot_report",
      label: `Reported by ${family}-slot students`,
      confidence: "medium",
    });
  }

  let usedWebResource = false;
  if (
    (prefersAny(preferences, "videos") || prefersAny(preferences, "notes")) &&
    priority !== "low"
  ) {
    usedWebResource = true;
    evidence.push({
      type: index % 2 === 0 ? "resource" : "web",
      label: index % 2 === 0 ? "Matched note + lecture" : "Vetted web resource",
      confidence: "medium",
    });
  }

  return { evidence, usedWebResource };
}

function buildSection(
  topic: string,
  index: number,
  config: ComposerConfig,
  examLabel: string,
): { section: StudyPlanSection; usedWebResource: boolean } {
  const priority = PRIORITY_BY_INDEX[index] ?? "low";
  const tasks = buildTasks(topic, priority, config, examLabel);
  const estimatedMinutes = Math.min(
    600,
    tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
  );
  const { evidence, usedWebResource } = buildEvidence(
    index,
    priority,
    config,
    examLabel,
  );
  const reason = pick(REASONS[priority], `${config.course.code}:${topic}`).replace(
    "{exam}",
    examLabel,
  );

  return {
    section: {
      topicId: undefined,
      topicTitle: topic,
      priority,
      estimatedMinutes,
      reason,
      evidence,
      tasks,
    },
    usedWebResource,
  };
}

/**
 * Builds a realistic, schema-valid plan from the composer choices. This stands
 * in for the worker's generated plan until the research agent is wired up —
 * it reads from real course counts where we have them and is clearly labelled
 * as a preview in the UI so nothing is presented as confirmed fact.
 */
export function buildSamplePlan(config: ComposerConfig): StudyPlan {
  const { course, examType, slot } = config;
  const examLabel = examType ? examTypeLabel(examType) : "exam";
  const sourceTopics =
    config.topics.length > 0 ? config.topics.slice(0, 5) : DEFAULT_TOPICS;

  let webResourcesUsed = 0;
  const sections = sourceTopics.map((topic, index) => {
    const { section, usedWebResource } = buildSection(
      topic,
      index,
      config,
      examLabel,
    );
    if (usedWebResource) webResourcesUsed += 1;
    return section;
  });

  const totalEstimatedMinutes = sections.reduce(
    (sum, section) => sum + section.estimatedMinutes,
    0,
  );

  const warnings: string[] = [];
  if (!slot) {
    warnings.push(
      "Add your slot and ExamCooker can fold in earlier-slot reports too.",
    );
  }
  if (course.paperCount === 0) {
    warnings.push(
      "No past papers for this course yet, so a few calls lean on the syllabus alone.",
    );
  }

  return {
    title: `${course.code} ${examLabel}`,
    context: {
      courseCode: course.code,
      courseTitle: course.title,
      examType: examType || null,
      slot: slot || null,
      syllabusName: null,
    },
    evidenceSummary: {
      syllabusTopicsUsed: sections.length,
      pastPapersUsed: Math.min(course.paperCount, 6),
      earlierSlotSignalsUsed: slot
        ? 3 + (seedNumber(course.code + slot) % 5)
        : 0,
      webResourcesUsed,
    },
    totalEstimatedMinutes,
    sections,
    warnings,
  };
}
