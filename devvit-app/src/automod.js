const AUTOMOD_TTL_SECONDS = 7 * 24 * 3600;
function automodTargetKey(targetId) {
    return `triage:automod:${targetId}`;
}
function automodAuthorKey(subredditName, username) {
    return `triage:automod-author:${subredditName}:${username}`;
}
export async function markAutomodOnTarget(targetId, context) {
    try {
        await context.redis.set(automodTargetKey(targetId), "1");
        await context.redis.expire(automodTargetKey(targetId), AUTOMOD_TTL_SECONDS);
    }
    catch (e) {
        console.warn("[triage] automod mark failed", e.message);
    }
}
export async function markAutomodOnAuthor(subredditName, username, action, context) {
    const key = automodAuthorKey(subredditName, username);
    try {
        const prev = await context.redis.get(key);
        const list = prev ? JSON.parse(prev) : [];
        list.unshift(action.slice(0, 80));
        await context.redis.set(key, JSON.stringify(list.slice(0, 5)));
        await context.redis.expire(key, AUTOMOD_TTL_SECONDS);
    }
    catch (e) {
        console.warn("[triage] automod author mark failed", e.message);
    }
}
export async function gatherAutoModIntel(input, context) {
    let actedOnTarget = false;
    try {
        const flag = await context.redis.get(automodTargetKey(input.targetId));
        actedOnTarget = flag === "1";
    }
    catch {
        /* ignore */
    }
    const recentAuthorActions = [];
    try {
        const raw = await context.redis.get(automodAuthorKey(input.subredditName, input.authorUsername));
        if (raw)
            recentAuthorActions.push(...JSON.parse(raw));
    }
    catch {
        /* ignore */
    }
    if (!actedOnTarget && input.authorUsername.length > 0) {
        try {
            const log = context.reddit.getModerationLog({
                subredditName: input.subredditName,
                limit: 15,
            });
            const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
            for await (const action of log) {
                if (action.createdAt.getTime() < cutoff)
                    break;
                const mod = (action.moderatorName ?? "").toLowerCase();
                if (!mod.includes("automoderator") && mod !== "automod")
                    continue;
                const targetAuthor = action.target?.author?.toLowerCase();
                if (targetAuthor === input.authorUsername.toLowerCase()) {
                    recentAuthorActions.push(`${action.type} (${Math.floor((Date.now() - action.createdAt.getTime()) / 86400000)}d ago)`);
                }
                if (action.target?.id === input.targetId)
                    actedOnTarget = true;
                if (recentAuthorActions.length >= 3)
                    break;
            }
        }
        catch (e) {
            console.warn("[triage] automod log scan failed", e.message);
        }
    }
    return { actedOnTarget, recentAuthorActions };
}
export function formatAutoModWarning(intel) {
    if (!intel.actedOnTarget && intel.recentAuthorActions.length === 0) {
        return null;
    }
    const lines = ["⚠️ AUTOMOD CONTEXT"];
    if (intel.actedOnTarget) {
        lines.push("AutoModerator already touched this item recently.");
    }
    if (intel.recentAuthorActions.length > 0) {
        lines.push(`Recent AutoMod on author: ${intel.recentAuthorActions.join(", ")}`);
    }
    lines.push("Double-check before overriding automated actions.");
    return lines.join("\n");
}
