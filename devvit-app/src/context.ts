import type { Devvit } from "@devvit/public-api";

/** Context available in menu handlers, triggers, and scheduled jobs (no UI). */
export type TriageContext = Omit<
  Devvit.Context,
  "ui" | "dimensions" | "modLog" | "uiEnvironment"
>;
