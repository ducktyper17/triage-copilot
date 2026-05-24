import type { TriageContext } from "./context.js";

import { contentFingerprint, similarityScore } from "./text.js";
import type { SimilarRemovalMatch } from "./types.js";

const REMOVAL_LIST_MAX = 40;
const REMOVAL_TTL_SECONDS = 30 * 24 * 3600;
const MATCH_THRESHOLD = 0.35;

type StoredRemoval = {
  targetId: string;
  fingerprint: string;
  ruleHint: string | null;
  tldr: string;
  removedAt: number;
};

function listKey(subredditName: string): string {
  return `triage:removed:${subredditName}`;
}

async function loadRemovalList(
  key: string,
  context: TriageContext
): Promise<StoredRemoval[]> {
  try {
    const raw = await context.redis.get(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredRemoval[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordRemovalForSimilarity(
  subredditName: string,
  targetId: string,
  bodyText: string,
  ruleHint: string | null,
  tldr: string,
  context: TriageContext
): Promise<void> {
  const entry: StoredRemoval = {
    targetId,
    fingerprint: contentFingerprint(bodyText),
    ruleHint,
    tldr: tldr.slice(0, 200),
    removedAt: Date.now(),
  };
  const key = listKey(subredditName);
  try {
    const list = await loadRemovalList(key, context);
    list.unshift(entry);
    await context.redis.set(
      key,
      JSON.stringify(list.slice(0, REMOVAL_LIST_MAX))
    );
    await context.redis.expire(key, REMOVAL_TTL_SECONDS);
  } catch (e) {
    console.warn("[triage] similar-store write failed", (e as Error).message);
  }
}

export async function findSimilarRemovals(
  subredditName: string,
  bodyText: string,
  context: TriageContext,
  excludeTargetId?: string
): Promise<SimilarRemovalMatch[]> {
  const fp = contentFingerprint(bodyText);
  if (fp.length < 8) return [];

  const key = listKey(subredditName);
  try {
    const stored = await loadRemovalList(key, context);
    const matches: SimilarRemovalMatch[] = [];

    for (const entry of stored) {
      if (excludeTargetId && entry.targetId === excludeTargetId) continue;
      const score = similarityScore(fp, entry.fingerprint);
      if (score < MATCH_THRESHOLD) continue;
      const daysAgo = Math.floor(
        (Date.now() - entry.removedAt) / (1000 * 60 * 60 * 24)
      );
      matches.push({
        targetId: entry.targetId,
        ruleHint: entry.ruleHint,
        tldr: entry.tldr,
        daysAgo,
        score,
      });
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 3);
  } catch (e) {
    console.warn("[triage] similar-store read failed", (e as Error).message);
    return [];
  }
}

export function formatSimilarRemovals(
  matches: SimilarRemovalMatch[]
): string | null {
  if (matches.length === 0) return null;
  const lines = ["🔁 SIMILAR TO RECENTLY REMOVED:"];
  for (const m of matches) {
    const pct = Math.round(m.score * 100);
    const rule = m.ruleHint ? ` (${m.ruleHint})` : "";
    lines.push(
      `  ${pct}% match · ${m.daysAgo}d ago${rule}: ${m.tldr.slice(0, 80)}`
    );
  }
  return lines.join("\n");
}
