import type { TriageContext } from "./context.js";
import type { ModChatMessage } from "./types.js";

const CHAT_TTL_SECONDS = 7 * 24 * 3600;
const MAX_MESSAGES = 20;

function chatKey(targetId: string): string {
  return `triage:chat:${targetId}`;
}

export function realtimeChannel(
  subredditName: string,
  targetId: string
): string {
  return `triage:${subredditName}:${targetId}`;
}

export async function getModChat(
  targetId: string,
  context: TriageContext
): Promise<ModChatMessage[]> {
  try {
    const raw = await context.redis.get(chatKey(targetId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ModChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_MESSAGES);
  } catch (e) {
    console.warn("[triage] chat read failed", (e as Error).message);
    return [];
  }
}

export async function appendModChat(
  targetId: string,
  username: string,
  text: string,
  context: TriageContext,
  subredditName?: string
): Promise<ModChatMessage[]> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return getModChat(targetId, context);

  const messages = await getModChat(targetId, context);
  messages.push({ username, text: trimmed.slice(0, 500), at: Date.now() });
  const kept = messages.slice(-MAX_MESSAGES);

  try {
    await context.redis.set(chatKey(targetId), JSON.stringify(kept));
    await context.redis.expire(chatKey(targetId), CHAT_TTL_SECONDS);
  } catch (e) {
    console.warn("[triage] chat write failed", (e as Error).message);
  }

  if (subredditName) {
    try {
      await context.realtime.send(
        realtimeChannel(subredditName, targetId),
        { type: "chat", username, text: trimmed.slice(0, 500), at: Date.now() }
      );
    } catch (e) {
      console.warn("[triage] realtime send failed", (e as Error).message);
    }
  }

  return kept;
}

export function formatModChat(messages: ModChatMessage[]): string | null {
  if (messages.length === 0) return null;
  const lines = ["💬 MOD CHAT ON THIS ITEM:"];
  for (const m of messages.slice(-6)) {
    const ageMin = Math.floor((Date.now() - m.at) / 60000);
    const ago = ageMin < 1 ? "just now" : `${ageMin}m ago`;
    lines.push(`  u/${m.username} (${ago}): ${m.text}`);
  }
  return lines.join("\n");
}
