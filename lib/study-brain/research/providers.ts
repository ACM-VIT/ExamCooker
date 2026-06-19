export type ResearchSearchProviderId = "parallel" | "exa";

export type ResearchSourceType =
  | "official"
  | "university"
  | "docs"
  | "tutorial"
  | "video"
  | "forum"
  | "unknown";

export type ResearchSearchInput = {
  query: string;
  topicTitle: string;
  courseCode: string;
  courseTitle: string;
  maxResults: number;
};

export type ResearchSearchResult = {
  title: string;
  url: string;
  snippet: string | null;
  sourceType: ResearchSourceType;
  provider: ResearchSearchProviderId;
  providerScore?: number;
  publishedAt?: string | null;
};

export type ResearchSearchProvider = {
  id: ResearchSearchProviderId;
  search(input: ResearchSearchInput): Promise<ResearchSearchResult[]>;
};

export type ResearchBudget = {
  maxSearches: number;
  maxFetchedPages: number;
  maxSynthesisCalls: number;
};

export const DEFAULT_RESEARCH_BUDGET: ResearchBudget = {
  maxSearches: 8,
  maxFetchedPages: 12,
  maxSynthesisCalls: 3,
};
