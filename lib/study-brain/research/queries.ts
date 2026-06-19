import type { StudyPreferenceMode } from "@/lib/study-brain/schemas";

type BuildResearchQueriesInput = {
  courseCode: string;
  courseTitle: string;
  topicTitle: string;
  preferences: StudyPreferenceMode[];
};

export function buildResearchQueries(input: BuildResearchQueriesInput) {
  const baseTopic = `${input.courseTitle} ${input.topicTitle}`.replace(/\s+/g, " ").trim();
  const queries = new Set<string>([
    `${baseTopic} explained for engineering students`,
    `${baseTopic} solved problems examples`,
    `${input.topicTitle} ${input.courseTitle} university notes`,
  ]);

  if (input.preferences.includes("videos")) {
    queries.add(`${baseTopic} lecture video`);
  }

  if (input.preferences.includes("past_papers")) {
    queries.add(`${input.courseCode} ${input.topicTitle} previous year questions`);
    queries.add(`${baseTopic} exam questions solved`);
  }

  if (input.preferences.includes("quick_summaries")) {
    queries.add(`${baseTopic} quick revision summary`);
  }

  return Array.from(queries).slice(0, 6);
}
