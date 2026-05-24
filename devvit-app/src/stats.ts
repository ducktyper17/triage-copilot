import type { TriageContext } from "./context.js";

const DAY_MS = 1000 * 60 * 60 * 24;

function dayKey(subredditName: string): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `triage:actions:${subredditName}:${ymd}`;
}

function digestStatsKey(subredditName: string): string {
  return `triage:digest-stats:${subredditName}`;
}

export async function recordModAction(
  subredditName: string,
  modUsername: string,
  context: TriageContext
): Promise<void> {
  const key = dayKey(subredditName);
  try {
    await context.redis.hIncrBy(key, modUsername, 1);
    await context.redis.expire(key, 48 * 3600);
    const statsKey = digestStatsKey(subredditName);
    await context.redis.hIncrBy(statsKey, "triaged", 1);
  } catch (e) {
    console.warn("[triage] mod-action count failed", (e as Error).message);
  }
}

export type ModLoadEntry = { username: string; count: number };

export async function getModLoadsToday(
  subredditName: string,
  context: TriageContext
): Promise<ModLoadEntry[]> {
  const key = dayKey(subredditName);
  try {
    const all = await context.redis.hGetAll(key);
    const entries: ModLoadEntry[] = [];
    for (const [username, cnt] of Object.entries(all ?? {})) {
      entries.push({ username, count: Number(cnt) || 0 });
    }
    entries.sort((a, b) => b.count - a.count);
    return entries;
  } catch (e) {
    console.warn("[triage] mod loads read failed", (e as Error).message);
    return [];
  }
}

export function formatLoadBalancer(
  loads: ModLoadEntry[],
  selfUsername: string
): string | null {
  if (loads.length === 0) return null;

  const self = loads.find((l) => l.username === selfUsername);
  const selfCount = self?.count ?? 0;
  const lightest = loads.reduce((a, b) => (a.count < b.count ? a : b));

  if (
    selfCount > 15 &&
    lightest.username !== selfUsername &&
    lightest.count < selfCount - 5
  ) {
    return [
      "⚖️ LOAD BALANCER",
      `You've triaged ${selfCount} items today — u/${lightest.username} has ${lightest.count}.`,
      `Consider handing off or picking another item.`,
    ].join("\n");
  }

  if (selfCount > 0 && loads.length > 1) {
    const top = loads.reduce((a, b) => (a.count > b.count ? a : b));
    return `⚖️ Your triage today: ${selfCount} · team leader: u/${top.username} (${top.count})`;
  }

  return null;
}

export async function getDigestStats(
  subredditName: string,
  context: TriageContext
): Promise<{ triaged: number; blocked: number }> {
  let blocked = 0;
  try {
    const b = await context.redis.get(`triage:blocked:${subredditName}`);
    blocked = b ? Number(b) : 0;
  } catch {
    /* ignore */
  }

  let triaged = 0;
  try {
    const t = await context.redis.hGet(
      digestStatsKey(subredditName),
      "triaged"
    );
    triaged = t ? Number(t) : 0;
  } catch {
    /* ignore */
  }

  return { triaged, blocked };
}

export async function resetWeeklyDigestCounter(
  subredditName: string,
  context: TriageContext
): Promise<void> {
  try {
    await context.redis.hSet(digestStatsKey(subredditName), { triaged: "0" });
  } catch (e) {
    console.warn("[triage] digest reset failed", (e as Error).message);
  }
}
