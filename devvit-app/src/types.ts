export type UserIntel = {
  username: string;
  accountAgeDays: number;
  karmaInSub: number;
  priorBansInSub: number;
  lastBanDaysAgo: number | null;
  modNotes: string[];
  recentActionsAgainstUser: string[];
};

export type ReportIntel = {
  reportCount: number;
  reportersByAccountAge: { newAccounts: number; total: number };
  reporterUsernames: string[];
};

export type CopilotInput = {
  targetId: string;
  targetKind: "post" | "comment";
  subredditName: string;
  authorUsername: string;
  bodyText: string;
};

export type AutoModIntel = {
  actedOnTarget: boolean;
  recentAuthorActions: string[];
};

export type BrigadeIntel = {
  flagged: boolean;
  matchedSubs: string[];
  recentActivityCount: number;
};

export type ActivitySparkline = {
  days: number[];
  labels: string[];
  sparkline: string;
  totalInSub: number;
};

export type SimilarRemovalMatch = {
  targetId: string;
  ruleHint: string | null;
  tldr: string;
  daysAgo: number;
  score: number;
};

export type CopilotIntel = {
  input: CopilotInput;
  user: UserIntel;
  report: ReportIntel | null;
  autoMod: AutoModIntel;
  brigade: BrigadeIntel;
  sparkline: ActivitySparkline;
  removalTemplates: string[];
  similarRemovals: SimilarRemovalMatch[];
};

export type CopilotActionChoices = {
  remove: boolean;
  banDays: number;
  replyWithReason: boolean;
  removalReason: string;
  lockThread: boolean;
  sendModmail: boolean;
  modmailSubject: string;
  modmailBody: string;
};

export type CopilotFormDefaults = {
  remove: boolean;
  banDays: number;
  replyWithReason: boolean;
  lockThread: boolean;
  removalReason: string;
  showTrustAiHint: boolean;
};

export type ModChatMessage = {
  username: string;
  text: string;
  at: number;
};

export type NextQueueItem = {
  id: string;
  kind: "post" | "comment";
  title: string;
  url: string;
  permalink: string;
};
