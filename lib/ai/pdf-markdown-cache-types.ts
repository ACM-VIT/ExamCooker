export type PdfMarkdownFeedbackVote = "up" | "down";

export type PdfMarkdownAccuracyStatus =
  | "unreviewed"
  | "helpful"
  | "community_verified"
  | "needs_review";

export type PdfMarkdownFeedbackSummary = {
  downvotes: number;
  status: PdfMarkdownAccuracyStatus;
  totalVotes: number;
  upvotes: number;
  userVote?: PdfMarkdownFeedbackVote | null;
};

export type PdfMarkdownCacheMetadata = {
  cacheKey?: string;
  contentHash?: string;
  feedback: PdfMarkdownFeedbackSummary;
  generatedAt?: string;
  generationId?: string;
  model?: string;
  reason?: string;
  source: "cache" | "live";
  status:
    | "disabled"
    | "miss"
    | "hit"
    | "stored"
    | "bypassed"
    | "skipped";
};
