import type { TriageContext } from "./context.js";

const PRESENCE_TTL_SECONDS = 90;
const CLAIM_TTL_SECONDS = 300;
const ACTIVE_TTL_SECONDS = 300;

function presenceKey(targetId: string): string {
  return `triage:viewing:${targetId}`;
}

function claimKey(targetId: string): string {
  return `triage:claim:${targetId}`;
}

function subActiveKey(subredditName: string): string {
  return `triage:active:${subredditName}`;
}

function subBlockedKey(subredditName: string): string {
  return `triage:blocked:${subredditName}`;
}

async function touchActiveItem(
  subredditName: string,
  targetId: string,
  context: TriageContext
): Promise<void> {
  const key = subActiveKey(subredditName);
  try {
    await context.redis.hSet(key, { [targetId]: String(Date.now()) });
    await context.redis.expire(key, ACTIVE_TTL_SECONDS * 4);
  } catch (e) {
    console.warn("[triage] active-item write failed", (e as Error).message);
  }
}

export type Viewer = {
  username: string;
  viewedAt: number;
};

export type Claim = {
  username: string;
  claimedAt: number;
};

export type ClaimStatus = {
  banner: string | null;
  isHeldByOther: boolean;
  heldBy: string | null;
  isMine: boolean;
};

export const CLAIM_DURATION_SECONDS = CLAIM_TTL_SECONDS;

export async function recordViewing(
  targetId: string,
  username: string,
  context: TriageContext,
  subredditName?: string
): Promise<void> {
  const key = presenceKey(targetId);
  const now = Date.now();
  try {
    await context.redis.hSet(key, { [username]: String(now) });
    await context.redis.expire(key, PRESENCE_TTL_SECONDS);
  } catch (e) {
    console.warn("[triage] presence write failed", (e as Error).message);
  }
  if (subredditName) {
    await touchActiveItem(subredditName, targetId, context);
  }
}

export async function clearViewing(
  targetId: string,
  username: string,
  context: TriageContext
): Promise<void> {
  const key = presenceKey(targetId);
  try {
    await context.redis.hDel(key, [username]);
  } catch (e) {
    console.warn("[triage] presence clear failed", (e as Error).message);
  }
}

export async function getOtherViewers(
  targetId: string,
  selfUsername: string,
  context: TriageContext
): Promise<Viewer[]> {
  const key = presenceKey(targetId);
  try {
    const all = await context.redis.hGetAll(key);
    const cutoff = Date.now() - PRESENCE_TTL_SECONDS * 1000;
    const viewers: Viewer[] = [];
    for (const [username, ts] of Object.entries(all ?? {})) {
      if (username === selfUsername) continue;
      const viewedAt = Number(ts);
      if (!Number.isFinite(viewedAt)) continue;
      if (viewedAt < cutoff) {
        await context.redis.hDel(key, [username]).catch(() => {});
        continue;
      }
      viewers.push({ username, viewedAt });
    }
    viewers.sort((a, b) => b.viewedAt - a.viewedAt);
    return viewers;
  } catch (e) {
    console.warn("[triage] presence read failed", (e as Error).message);
    return [];
  }
}

export function formatViewerWarning(viewers: Viewer[]): string | null {
  if (viewers.length === 0) return null;
  const names = viewers.slice(0, 3).map((v) => `u/${v.username}`);
  const extra = viewers.length > 3 ? ` (+${viewers.length - 3} more)` : "";
  return [
    "👁 Also viewing this item:",
    `${names.join(", ")}${extra}`,
  ].join(" ");
}

export async function getClaim(
  targetId: string,
  context: TriageContext
): Promise<Claim | null> {
  const key = claimKey(targetId);
  try {
    const data = await context.redis.hGetAll(key);
    if (!data || !data.username || !data.claimedAt) return null;
    const claimedAt = Number(data.claimedAt);
    if (!Number.isFinite(claimedAt)) return null;
    const cutoff = Date.now() - CLAIM_TTL_SECONDS * 1000;
    if (claimedAt < cutoff) return null;
    return { username: data.username, claimedAt };
  } catch (e) {
    console.warn("[triage] claim read failed", (e as Error).message);
    return null;
  }
}

export async function claimItem(
  targetId: string,
  username: string,
  context: TriageContext,
  subredditName?: string
): Promise<ClaimStatus> {
  const existing = await getClaim(targetId, context);
  if (existing && existing.username !== username) {
    return formatClaimStatus(existing, username);
  }
  const key = claimKey(targetId);
  const now = Date.now();
  try {
    await context.redis.hSet(key, {
      username,
      claimedAt: String(now),
    });
    await context.redis.expire(key, CLAIM_TTL_SECONDS);
  } catch (e) {
    console.warn("[triage] claim write failed", (e as Error).message);
  }
  if (subredditName) {
    await touchActiveItem(subredditName, targetId, context);
  }
  return formatClaimStatus({ username, claimedAt: now }, username);
}

export async function releaseClaim(
  targetId: string,
  username: string,
  context: TriageContext
): Promise<void> {
  const existing = await getClaim(targetId, context);
  if (!existing || existing.username !== username) return;
  const key = claimKey(targetId);
  try {
    await context.redis.del(key);
  } catch (e) {
    console.warn("[triage] claim release failed", (e as Error).message);
  }
}

/** Transfer exclusive claim to another mod (second opinion / handoff). */
export async function transferClaim(
  targetId: string,
  fromUsername: string,
  toUsername: string,
  context: TriageContext,
  subredditName?: string
): Promise<ClaimStatus> {
  if (fromUsername === toUsername) {
    return formatClaimStatus(
      { username: toUsername, claimedAt: Date.now() },
      toUsername
    );
  }
  await releaseClaim(targetId, fromUsername, context);
  return claimItem(targetId, toUsername, context, subredditName);
}

export function formatClaimStatus(
  claim: Claim | null,
  selfUsername: string
): ClaimStatus {
  if (!claim) {
    return { banner: null, isHeldByOther: false, heldBy: null, isMine: false };
  }
  if (claim.username === selfUsername) {
    const remainingSec = Math.max(
      0,
      Math.ceil(
        (claim.claimedAt + CLAIM_TTL_SECONDS * 1000 - Date.now()) / 1000
      )
    );
    return {
      banner: [
        "✅ YOU CLAIMED THIS ITEM",
        `Reserved for you for the next ${remainingSec}s.`,
        "Apply your actions or cancel — the claim releases either way.",
        "————————————————————",
      ].join("\n"),
      isHeldByOther: false,
      heldBy: claim.username,
      isMine: true,
    };
  }
  const ageSec = Math.floor((Date.now() - claim.claimedAt) / 1000);
  return {
    banner: [
      "🚫 CLAIMED BY ANOTHER MOD",
      `u/${claim.username} claimed this item ${ageSec}s ago.`,
      "Pick a different queue item — or check 'Override' below to proceed anyway.",
      "————————————————————",
    ].join("\n"),
    isHeldByOther: true,
    heldBy: claim.username,
    isMine: false,
  };
}

export async function incrementBlocked(
  subredditName: string,
  context: TriageContext
): Promise<number> {
  const key = subBlockedKey(subredditName);
  try {
    return await context.redis.incrBy(key, 1);
  } catch (e) {
    console.warn("[triage] block-count write failed", (e as Error).message);
    return 0;
  }
}

async function getAllViewers(
  targetId: string,
  context: TriageContext
): Promise<Viewer[]> {
  const key = presenceKey(targetId);
  try {
    const all = await context.redis.hGetAll(key);
    const cutoff = Date.now() - PRESENCE_TTL_SECONDS * 1000;
    const viewers: Viewer[] = [];
    for (const [username, ts] of Object.entries(all ?? {})) {
      const viewedAt = Number(ts);
      if (!Number.isFinite(viewedAt) || viewedAt < cutoff) continue;
      viewers.push({ username, viewedAt });
    }
    viewers.sort((a, b) => b.viewedAt - a.viewedAt);
    return viewers;
  } catch (e) {
    console.warn("[triage] all viewers read failed", (e as Error).message);
    return [];
  }
}

export type SubActivityItem = {
  targetId: string;
  lastActiveSec: number;
  viewers: Viewer[];
  claim: Claim | null;
};

export type SubActivity = {
  activeItems: SubActivityItem[];
  totalBlocked: number;
  uniqueMods: string[];
};

export async function getSubActivity(
  subredditName: string,
  context: TriageContext
): Promise<SubActivity> {
  const result: SubActivity = {
    activeItems: [],
    totalBlocked: 0,
    uniqueMods: [],
  };

  try {
    const cnt = await context.redis.get(subBlockedKey(subredditName));
    result.totalBlocked = cnt ? Number(cnt) : 0;
  } catch (e) {
    console.warn("[triage] block-count read failed", (e as Error).message);
  }

  const key = subActiveKey(subredditName);
  try {
    const all = await context.redis.hGetAll(key);
    const cutoff = Date.now() - ACTIVE_TTL_SECONDS * 1000;
    const fresh: Array<{ targetId: string; lastActive: number }> = [];

    for (const [targetId, ts] of Object.entries(all ?? {})) {
      const lastActive = Number(ts);
      if (!Number.isFinite(lastActive)) continue;
      if (lastActive < cutoff) {
        await context.redis.hDel(key, [targetId]).catch(() => {});
        continue;
      }
      fresh.push({ targetId, lastActive });
    }

    fresh.sort((a, b) => b.lastActive - a.lastActive);

    const modSet = new Set<string>();
    for (const { targetId, lastActive } of fresh.slice(0, 10)) {
      const [viewers, claim] = await Promise.all([
        getAllViewers(targetId, context),
        getClaim(targetId, context),
      ]);
      result.activeItems.push({
        targetId,
        lastActiveSec: Math.floor((Date.now() - lastActive) / 1000),
        viewers,
        claim,
      });
      for (const v of viewers) modSet.add(v.username);
      if (claim) modSet.add(claim.username);
    }
    result.uniqueMods = Array.from(modSet);
  } catch (e) {
    console.warn("[triage] active-items read failed", (e as Error).message);
  }

  return result;
}

export function formatSubActivity(
  subredditName: string,
  activity: SubActivity
): string {
  const lines: string[] = [];
  lines.push(`📊 TRIAGE ACTIVITY — r/${subredditName}`);
  lines.push("");
  lines.push(`Mods online: ${activity.uniqueMods.length}`);
  lines.push(`Active queue items: ${activity.activeItems.length}`);
  lines.push(`Collisions prevented (all time): ${activity.totalBlocked}`);
  lines.push("————————————————————");

  if (activity.activeItems.length === 0) {
    lines.push("");
    lines.push("No active items in the last 5 minutes.");
    lines.push("Mods can open Triage on any post or comment to start.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("CURRENTLY ACTIVE ITEMS:");
  activity.activeItems.forEach((item, idx) => {
    const kind = item.targetId.startsWith("t1_")
      ? "Comment"
      : item.targetId.startsWith("t3_")
        ? "Post"
        : "Item";
    const id = item.targetId.replace(/^t[13]_/, "");
    lines.push("");
    lines.push(`${idx + 1}. ${kind} ${id}  (last active ${item.lastActiveSec}s ago)`);
    if (item.claim) {
      const claimAge = Math.floor((Date.now() - item.claim.claimedAt) / 1000);
      lines.push(`   🔒 CLAIMED by u/${item.claim.username} (${claimAge}s ago)`);
    }
    if (item.viewers.length > 0) {
      const names = item.viewers.slice(0, 5).map((v) => `u/${v.username}`);
      const extra =
        item.viewers.length > 5 ? ` +${item.viewers.length - 5} more` : "";
      lines.push(`   👁 Viewing: ${names.join(", ")}${extra}`);
    }
  });

  return lines.join("\n");
}
