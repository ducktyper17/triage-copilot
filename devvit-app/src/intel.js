import { gatherAutoModIntel } from "./automod.js";
import { findSimilarRemovals } from "./similar.js";
import { buildSparkline } from "./text.js";
const DAY_MS = 1000 * 60 * 60 * 24;
const SPARKLINE_DAYS = 30;
export async function gatherUserIntel(username, subredditName, context) {
    const user = await context.reddit.getUserByUsername(username);
    if (!user) {
        return {
            username,
            accountAgeDays: 0,
            karmaInSub: 0,
            priorBansInSub: 0,
            lastBanDaysAgo: null,
            modNotes: [],
            recentActionsAgainstUser: [],
        };
    }
    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / DAY_MS);
    const totalKarma = (user.linkKarma ?? 0) + (user.commentKarma ?? 0);
    const modNotes = [];
    const recentActionsAgainstUser = [];
    let priorBansInSub = 0;
    let lastBanTimestamp = null;
    try {
        const notesListing = context.reddit.getModNotes({
            subreddit: subredditName,
            user: username,
            filter: "ALL",
        });
        for await (const note of notesListing) {
            if (note.userNote?.note)
                modNotes.push(note.userNote.note);
            if (note.type === "MOD_ACTION" && note.modAction?.type) {
                const actionType = note.modAction.type;
                recentActionsAgainstUser.push(actionType);
                if (actionType === "banuser") {
                    priorBansInSub += 1;
                    const ts = note.createdAt.getTime();
                    if (lastBanTimestamp === null || ts > lastBanTimestamp) {
                        lastBanTimestamp = ts;
                    }
                }
            }
            if (modNotes.length + recentActionsAgainstUser.length >= 20)
                break;
        }
    }
    catch (e) {
        console.warn("[triage] mod notes fetch failed", e.message);
    }
    return {
        username,
        accountAgeDays,
        karmaInSub: totalKarma,
        priorBansInSub,
        lastBanDaysAgo: lastBanTimestamp === null
            ? null
            : Math.floor((Date.now() - lastBanTimestamp) / DAY_MS),
        modNotes: modNotes.slice(0, 5),
        recentActionsAgainstUser: recentActionsAgainstUser.slice(0, 5),
    };
}
export async function gatherReportIntel(input, context) {
    try {
        const target = input.targetKind === "post"
            ? await context.reddit.getPostById(input.targetId)
            : await context.reddit.getCommentById(input.targetId);
        const userReports = target.userReportReasons ?? [];
        if (userReports.length === 0)
            return null;
        return {
            reportCount: userReports.length,
            reportersByAccountAge: { newAccounts: 0, total: 0 },
            reporterUsernames: [],
        };
    }
    catch (e) {
        console.warn("[triage] report intel fetch failed", e.message);
        return null;
    }
}
async function gatherBrigadeIntel(username, subredditName, context) {
    const empty = {
        flagged: false,
        matchedSubs: [],
        recentActivityCount: 0,
    };
    if (username.length === 0)
        return empty;
    const raw = (await context.settings.get("brigade-watch-subs")) ?? "";
    const watchList = raw
        .split(/[\n,]+/)
        .map((s) => s.trim().toLowerCase().replace(/^r\//, ""))
        .filter((s) => s.length > 0);
    if (watchList.length === 0)
        return empty;
    const matched = new Set();
    let recentActivityCount = 0;
    try {
        const user = await context.reddit.getUserByUsername(username);
        if (!user)
            return empty;
        const overview = user.getComments({ timeframe: "week", limit: 40 });
        for await (const c of overview) {
            recentActivityCount++;
            const sub = (c.subredditName ?? "").toLowerCase();
            if (sub.length > 0 && sub !== subredditName.toLowerCase()) {
                if (watchList.some((w) => sub === w || sub.includes(w))) {
                    matched.add(sub);
                }
            }
            if (matched.size >= 3)
                break;
        }
        if (matched.size === 0) {
            const posts = user.getPosts({ timeframe: "week", limit: 25 });
            for await (const p of posts) {
                recentActivityCount++;
                const sub = (p.subredditName ?? "").toLowerCase();
                if (sub.length > 0 && sub !== subredditName.toLowerCase()) {
                    if (watchList.some((w) => sub === w || sub.includes(w))) {
                        matched.add(sub);
                    }
                }
                if (matched.size >= 3)
                    break;
            }
        }
    }
    catch (e) {
        console.warn("[triage] brigade scan failed", e.message);
        return empty;
    }
    return {
        flagged: matched.size > 0,
        matchedSubs: Array.from(matched).slice(0, 5),
        recentActivityCount,
    };
}
async function gatherActivitySparkline(username, subredditName, context) {
    const dayCounts = new Array(SPARKLINE_DAYS).fill(0);
    const labels = [];
    const now = Date.now();
    for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        labels.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
    }
    try {
        const user = await context.reddit.getUserByUsername(username);
        if (user) {
            const comments = user.getComments({ timeframe: "month", limit: 80 });
            for await (const c of comments) {
                if ((c.subredditName ?? "").toLowerCase() !==
                    subredditName.toLowerCase()) {
                    continue;
                }
                const ageDays = Math.floor((now - c.createdAt.getTime()) / DAY_MS);
                if (ageDays >= 0 && ageDays < SPARKLINE_DAYS) {
                    dayCounts[SPARKLINE_DAYS - 1 - ageDays] += 1;
                }
            }
        }
    }
    catch (e) {
        console.warn("[triage] sparkline failed", e.message);
    }
    const { sparkline, total } = buildSparkline(dayCounts);
    return { days: dayCounts, labels, sparkline, totalInSub: total };
}
export async function gatherRemovalTemplates(subredditName, context) {
    const templates = [];
    try {
        const sub = await context.reddit.getSubredditByName(subredditName);
        const reasons = await sub.getRemovalReasons();
        for (const r of reasons) {
            const msg = (r.message ?? r.title ?? "").trim();
            if (msg.length > 0 && !templates.includes(msg))
                templates.push(msg);
            if (templates.length >= 8)
                break;
        }
    }
    catch (e) {
        console.warn("[triage] removal reasons failed", e.message);
    }
    try {
        const log = context.reddit.getModerationLog({
            subredditName,
            type: "removecomment",
            limit: 10,
        });
        for await (const action of log) {
            const detail = (action.details ?? "").trim();
            if (detail.length > 12 && !templates.includes(detail)) {
                templates.push(detail.slice(0, 200));
            }
            if (templates.length >= 12)
                break;
        }
    }
    catch {
        /* optional */
    }
    if (templates.length === 0) {
        templates.push("Removed per community rules.", "Spam / off-topic.", "Harassment or hate — not allowed here.");
    }
    return templates.slice(0, 12);
}
export async function gatherCopilotIntel(input, context) {
    const [user, report, autoMod, brigade, sparkline, removalTemplates, similarRemovals,] = await Promise.all([
        gatherUserIntel(input.authorUsername, input.subredditName, context),
        gatherReportIntel(input, context),
        gatherAutoModIntel(input, context),
        gatherBrigadeIntel(input.authorUsername, input.subredditName, context),
        gatherActivitySparkline(input.authorUsername, input.subredditName, context),
        gatherRemovalTemplates(input.subredditName, context),
        findSimilarRemovals(input.subredditName, input.bodyText, context, input.targetId),
    ]);
    return {
        input,
        user,
        report,
        autoMod,
        brigade,
        sparkline,
        removalTemplates,
        similarRemovals,
    };
}
export function formatBrigadeWarning(brigade) {
    if (!brigade.flagged)
        return null;
    return [
        "🚨 BRIGADE WATCH",
        `Author was active in: ${brigade.matchedSubs.map((s) => `r/${s}`).join(", ")}`,
        "Review for coordinated activity before approving.",
    ].join("\n");
}
export function formatSparkline(sparkline) {
    const activity = sparkline.totalInSub === 0
        ? "no comments in this sub (last 30d)"
        : `${sparkline.totalInSub} comments in this sub (last 30d)`;
    return `📈 Activity in sub: ${sparkline.sparkline}  (${activity})`;
}
