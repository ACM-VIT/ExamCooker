export const roleValues = ["USER", "MODERATOR"] as const;
export type Role = (typeof roleValues)[number];

export const voteTypeValues = ["UPVOTE", "DOWNVOTE"] as const;
export type VoteType = (typeof voteTypeValues)[number];

export const studyScopeValues = ["NOTE", "PAST_PAPER", "COURSE"] as const;
export type StudyScope = (typeof studyScopeValues)[number];

export const examTypeValues = [
  "CAT_1",
  "CAT_2",
  "FAT",
  "MODEL_CAT_1",
  "MODEL_CAT_2",
  "MODEL_FAT",
  "MID",
  "QUIZ",
  "CIA",
  "OTHER",
] as const;
export type ExamType = (typeof examTypeValues)[number];

export const semesterValues = [
  "FALL",
  "WINTER",
  "SUMMER",
  "WEEKEND",
  "UNKNOWN",
] as const;
export type Semester = (typeof semesterValues)[number];

export const campusValues = [
  "VELLORE",
  "CHENNAI",
  "AP",
  "BHOPAL",
  "BANGALORE",
  "MAURITIUS",
] as const;
export type Campus = (typeof campusValues)[number];
