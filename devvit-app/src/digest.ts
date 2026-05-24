import type { TriageContext } from "./context.js";

import { getDigestStats, resetWeeklyDigestCounter } from "./stats.js";

export const WEEKLY_DIGEST_JOB = "weeklyDigest";

export type WeeklyDigestData = {
  subredditName: string;
};

export async function runWeeklyDigest(
  subredditName: string,
  context: TriageContext
): Promise<void> {
  const { triaged, blocked } = await getDigestStats(subredditName, context);
  const hoursSaved = Math.max(1, Math.round(triaged * 2.5));

  const body = [
    "## Triage Weekly Digest",
    "",
    `**Items triaged this period:** ${triaged}`,
    `**Collisions prevented (all time):** ${blocked}`,
    `**Estimated mod time saved:** ~${hoursSaved} minutes`,
    "",
    "Triage helps your mod team avoid duplicate work with live claim/release, AI verdicts, and one-click action chains.",
    "",
    "_Posted automatically by [Triage Copilot](https://developers.reddit.com/apps/triage-copilot)._",
  ].join("\n");

  try {
    await context.reddit.submitPost({
      subredditName,
      title: `📊 Triage Weekly — ${triaged} items triaged, ${blocked} collisions prevented`,
      text: body,
    });
    await resetWeeklyDigestCounter(subredditName, context);
  } catch (e) {
    console.error("[triage] weekly digest failed", (e as Error).message);
  }
}

export async function ensureWeeklyDigestScheduled(
  subredditName: string,
  context: TriageContext
): Promise<void> {
  try {
    const jobs = await context.scheduler.listJobs();
    const exists = jobs.some(
      (j) =>
        j.name === WEEKLY_DIGEST_JOB &&
        "data" in j &&
        (j.data as WeeklyDigestData | undefined)?.subredditName ===
          subredditName
    );
    if (exists) return;

    await context.scheduler.runJob({
      name: WEEKLY_DIGEST_JOB,
      cron: "0 14 * * 1",
      data: { subredditName },
    });
  } catch (e) {
    console.warn("[triage] digest schedule failed", (e as Error).message);
  }
}
