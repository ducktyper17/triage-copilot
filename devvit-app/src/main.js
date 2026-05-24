import { Devvit } from "@devvit/public-api";
import { markAutomodOnAuthor, markAutomodOnTarget } from "./automod.js";
import { appendModChat, formatModChat, getModChat } from "./chat.js";
import { executeActionChain, formatIntelSummary, resolveRemovalReason, } from "./copilot.js";
import { ensureWeeklyDigestScheduled, runWeeklyDigest, WEEKLY_DIGEST_JOB, } from "./digest.js";
import { gatherCopilotIntel } from "./intel.js";
import { buildTrustAiDefaults, generateCopilotExtras, runLLMVerdict, } from "./llm.js";
import { formatNextQueueHint, getNextQueueItem } from "./queue.js";
import { claimItem, clearViewing, formatSubActivity, formatViewerWarning, getClaim, getOtherViewers, getSubActivity, incrementBlocked, recordViewing, releaseClaim, transferClaim, } from "./presence.js";
import { recordRemovalForSimilarity } from "./similar.js";
import { formatLoadBalancer, getModLoadsToday, recordModAction } from "./stats.js";
Devvit.configure({
    redditAPI: true,
    http: true,
    redis: true,
    realtime: true,
});
Devvit.addSettings([
    {
        type: "select",
        name: "llm-provider",
        label: "AI provider (for Copilot suggestions)",
        helpText: "Groq runs open-source Llama models with a free tier and is the recommended default.",
        defaultValue: ["groq"],
        options: [
            { label: "Groq — open-source Llama (free tier)", value: "groq" },
            { label: "Anthropic Claude (paid)", value: "anthropic" },
            { label: "OpenAI (paid)", value: "openai" },
            { label: "None (no AI suggestions)", value: "none" },
        ],
        scope: "installation",
    },
    {
        type: "string",
        name: "llm-api-key",
        label: "API key for the AI provider (set by app developer)",
        helpText: "Configured via `devvit settings set llm-api-key`. Encrypted at rest.",
        isSecret: true,
        scope: "app",
    },
    {
        type: "string",
        name: "llm-model",
        label: "Model name (optional)",
        helpText: "Defaults: llama-3.3-70b-versatile (Groq), claude-haiku-4-5-20251001 (Anthropic), gpt-4o-mini (OpenAI).",
        scope: "installation",
    },
    {
        type: "paragraph",
        name: "sub-rules-text",
        label: "Your subreddit's rules (for AI context)",
        helpText: "Paste your sub's rules. The Copilot uses this to map violations to specific rules.",
        scope: "installation",
    },
    {
        type: "paragraph",
        name: "brigade-watch-subs",
        label: "Brigade watchlist (comma or newline)",
        helpText: "Subreddit names to flag when the author was recently active there (e.g. hate, brigade sources).",
        scope: "installation",
    },
]);
async function getModeratorOptions(subredditName, selfUsername, context) {
    const options = [
        { label: "(no handoff)", value: "" },
    ];
    try {
        const sub = await context.reddit.getSubredditByName(subredditName);
        const mods = sub.getModerators({ limit: 30 });
        for await (const mod of mods) {
            const name = mod.username ?? "";
            if (name.length === 0 || name === selfUsername)
                continue;
            options.push({ label: `u/${name}`, value: name });
            if (options.length >= 16)
                break;
        }
    }
    catch (e) {
        console.warn("[triage] moderators list failed", e.message);
    }
    return options;
}
async function buildCopilotSummary(input, context, claimBanner, viewerWarning, nextQueueHint, loadHint, chatBlock) {
    const intel = await gatherCopilotIntel(input, context);
    const verdict = await runLLMVerdict(intel, context);
    const extras = await generateCopilotExtras(intel, verdict, context);
    const baseSummary = formatIntelSummary(intel, verdict, extras);
    const parts = [];
    if (claimBanner)
        parts.push(claimBanner);
    if (viewerWarning)
        parts.push(viewerWarning);
    if (nextQueueHint)
        parts.push(nextQueueHint);
    if (loadHint)
        parts.push(loadHint);
    if (chatBlock)
        parts.push(chatBlock);
    parts.push(baseSummary);
    return {
        intelSummary: parts.join("\n\n"),
        intel,
        verdict,
        extras,
    };
}
const copilotForm = Devvit.createForm((data) => {
    const d = data;
    const intelSummary = typeof d.intelSummary === "string" ? d.intelSummary : "(no intel)";
    const templates = Array.isArray(d.removalTemplates)
        ? d.removalTemplates
        : [];
    const modOptions = Array.isArray(d.modOptions) ? d.modOptions : [];
    const defs = d.defaults ?? {
        remove: true,
        banDays: 0,
        replyWithReason: false,
        lockThread: false,
        removalReason: "",
        useAiReason: false,
        aiSuggestedReason: "",
        modmailBody: "",
    };
    const templateOptions = [
        { label: "(pick a template)", value: "__custom__" },
        ...templates.slice(0, 10).map((t) => ({
            label: t.length > 48 ? `${t.slice(0, 47)}…` : t,
            value: t,
        })),
    ];
    return {
        title: "Triage Copilot",
        acceptLabel: "Apply",
        cancelLabel: "Cancel",
        fields: [
            {
                name: "intelDisplay",
                label: "What we found",
                type: "paragraph",
                defaultValue: intelSummary,
                disabled: true,
            },
            {
                name: "remove",
                label: "Remove this item",
                type: "boolean",
                defaultValue: defs.remove,
            },
            {
                name: "banDays",
                label: "Ban user for N days (0 = no ban)",
                type: "number",
                defaultValue: defs.banDays,
            },
            {
                name: "replyWithReason",
                label: "Reply with removal reason (user-facing)",
                type: "boolean",
                defaultValue: defs.replyWithReason,
            },
            {
                name: "useAiReason",
                label: "Use AI-written removal reply",
                type: "boolean",
                defaultValue: defs.useAiReason,
            },
            {
                name: "removalTemplate",
                label: "Removal reason template",
                type: "select",
                options: templateOptions,
                defaultValue: ["__custom__"],
            },
            {
                name: "removalReason",
                label: "Removal reason text (custom)",
                type: "string",
                defaultValue: defs.removalReason,
            },
            {
                name: "lockThread",
                label: "Lock thread",
                type: "boolean",
                defaultValue: defs.lockThread,
            },
            {
                name: "sendModmailOnBan",
                label: "Send modmail if banning (uses AI draft)",
                type: "boolean",
                defaultValue: false,
            },
            {
                name: "modChatMessage",
                label: "Add mod chat note for teammates",
                type: "string",
                defaultValue: "",
            },
            {
                name: "handoffToMod",
                label: "Hand off claim to another mod",
                type: "select",
                options: modOptions,
                defaultValue: [""],
            },
            {
                name: "overrideClaim",
                label: "Override another mod's claim (only if you're sure they're not acting)",
                type: "boolean",
                defaultValue: false,
            },
        ],
    };
}, async (event, context) => {
    const data = event.values;
    const targetId = context.commentId ?? context.postId;
    if (!targetId) {
        context.ui.showToast("Triage: no target context.");
        return;
    }
    const targetKind = context.commentId
        ? "comment"
        : "post";
    const subreddit = await context.reddit.getCurrentSubreddit();
    const target = targetKind === "comment"
        ? await context.reddit.getCommentById(targetId)
        : await context.reddit.getPostById(targetId);
    const input = {
        targetId,
        targetKind,
        subredditName: subreddit.name,
        authorUsername: target.authorName ?? "",
        bodyText: "body" in target && typeof target.body === "string"
            ? target.body
            : "title" in target && typeof target.title === "string"
                ? target.title
                : "",
    };
    const me = await context.reddit.getCurrentUser();
    const myUsername = me?.username ?? "";
    const templateChoice = Array.isArray(data.removalTemplate)
        ? data.removalTemplate[0] ?? "__custom__"
        : "__custom__";
    const chatMsg = String(data.modChatMessage ?? "").trim();
    if (chatMsg.length > 0 && myUsername.length > 0) {
        await appendModChat(targetId, myUsername, chatMsg, context, subreddit.name);
        try {
            await context.reddit.addModNote({
                subreddit: subreddit.name,
                user: input.authorUsername,
                note: `[Triage ${targetId}] u/${myUsername}: ${chatMsg.slice(0, 200)}`,
                redditId: targetId,
            });
        }
        catch {
            /* optional */
        }
    }
    const handoffTo = Array.isArray(data.handoffToMod)
        ? data.handoffToMod[0]?.trim() ?? ""
        : "";
    if (handoffTo.length > 0 && myUsername.length > 0) {
        await transferClaim(targetId, myUsername, handoffTo, context, subreddit.name);
        await appendModChat(targetId, myUsername, `Handed off to u/${handoffTo}`, context, subreddit.name);
        context.ui.showToast(`Claim transferred to u/${handoffTo}.`);
        if (!data.remove &&
            (data.banDays ?? 0) <= 0 &&
            !data.replyWithReason) {
            return;
        }
    }
    const existingClaim = await getClaim(targetId, context);
    if (existingClaim &&
        existingClaim.username !== myUsername &&
        !data.overrideClaim) {
        await incrementBlocked(subreddit.name, context);
        const next = await getNextQueueItem(subreddit.name, targetId, context);
        const hint = formatNextQueueHint(next);
        context.ui.showToast(hint
            ? `Blocked — u/${existingClaim.username} claimed this. Next: ${next?.url ?? "queue"}`
            : `Blocked: u/${existingClaim.username} has claimed this item.`);
        return;
    }
    const intel = await gatherCopilotIntel(input, context);
    const verdict = await runLLMVerdict(intel, context);
    const extras = await generateCopilotExtras(intel, verdict, context);
    const aiReason = extras.userFacingReason ?? "";
    const removalReason = resolveRemovalReason(templateChoice, String(data.removalReason ?? ""), Boolean(data.useAiReason), aiReason);
    const result = await executeActionChain(input, {
        remove: Boolean(data.remove),
        banDays: Math.max(0, Math.floor(Number(data.banDays) || 0)),
        replyWithReason: Boolean(data.replyWithReason),
        removalReason,
        lockThread: Boolean(data.lockThread),
        sendModmail: Boolean(data.sendModmailOnBan),
        modmailSubject: `Message from r/${subreddit.name}`,
        modmailBody: extras.modmailDraft ?? removalReason,
    }, context);
    if (result.success) {
        await recordModAction(subreddit.name, myUsername, context);
        if (data.remove) {
            await recordRemovalForSimilarity(subreddit.name, targetId, input.bodyText, verdict.ruleHint, verdict.tldr, context);
        }
    }
    if (myUsername.length > 0) {
        await clearViewing(targetId, myUsername, context);
        if (!handoffTo.length) {
            await releaseClaim(targetId, myUsername, context);
        }
    }
    context.ui.showToast(result.message);
});
async function openCopilot(targetKind, context) {
    const targetId = targetKind === "comment" ? context.commentId : context.postId;
    if (!targetId) {
        context.ui.showToast("Triage: missing target.");
        return;
    }
    const me = await context.reddit.getCurrentUser();
    if (!me) {
        context.ui.showToast("Triage: not logged in.");
        return;
    }
    const subreddit = await context.reddit.getCurrentSubreddit();
    const modPermissions = await me.getModPermissionsForSubreddit(subreddit.name);
    if (!modPermissions.includes("all") &&
        !modPermissions.includes("posts") &&
        !modPermissions.includes("access")) {
        context.ui.showToast("Triage is mod-only.");
        return;
    }
    const target = targetKind === "comment"
        ? await context.reddit.getCommentById(targetId)
        : await context.reddit.getPostById(targetId);
    const input = {
        targetId,
        targetKind,
        subredditName: subreddit.name,
        authorUsername: target.authorName ?? "",
        bodyText: "body" in target && typeof target.body === "string"
            ? target.body
            : "title" in target && typeof target.title === "string"
                ? target.title
                : "",
    };
    const [otherViewers, claimStatus, nextItem, modLoads, modOptions, chat] = await Promise.all([
        getOtherViewers(targetId, me.username, context),
        claimItem(targetId, me.username, context, subreddit.name),
        getNextQueueItem(subreddit.name, targetId, context),
        getModLoadsToday(subreddit.name, context),
        getModeratorOptions(subreddit.name, me.username, context),
        getModChat(targetId, context),
    ]);
    await recordViewing(targetId, me.username, context, subreddit.name);
    const viewerWarning = formatViewerWarning(otherViewers);
    const nextQueueHint = formatNextQueueHint(nextItem);
    const loadHint = formatLoadBalancer(modLoads, me.username);
    const chatBlock = formatModChat(chat);
    const { intelSummary, intel, verdict, extras } = await buildCopilotSummary(input, context, claimStatus.banner, viewerWarning, nextQueueHint, loadHint, chatBlock);
    const trust = buildTrustAiDefaults(verdict);
    context.ui.showForm(copilotForm, {
        intelSummary,
        targetId,
        removalTemplates: intel.removalTemplates,
        modOptions,
        defaults: {
            remove: trust.remove,
            banDays: trust.banDays,
            replyWithReason: trust.replyWithReason,
            lockThread: trust.lockThread,
            removalReason: trust.removalReason,
            useAiReason: Boolean(extras.userFacingReason),
            aiSuggestedReason: extras.userFacingReason ?? "",
            modmailBody: extras.modmailDraft ?? "",
        },
    });
}
Devvit.addMenuItem({
    label: "Triage with Copilot",
    description: "Open the Triage Copilot for this comment.",
    location: "comment",
    forUserType: "moderator",
    onPress: (_, context) => openCopilot("comment", context),
});
Devvit.addMenuItem({
    label: "Triage with Copilot",
    description: "Open the Triage Copilot for this post.",
    location: "post",
    forUserType: "moderator",
    onPress: (_, context) => openCopilot("post", context),
});
Devvit.addMenuItem({
    label: "Skip to next queue item",
    description: "Open the next item in the mod queue.",
    location: "subreddit",
    forUserType: "moderator",
    onPress: async (_, context) => {
        const subreddit = await context.reddit.getCurrentSubreddit();
        const next = await getNextQueueItem(subreddit.name, undefined, context);
        if (!next) {
            context.ui.showToast("Mod queue is empty or unavailable.");
            return;
        }
        context.ui.showToast(`Next: ${next.title} — ${next.url}`);
    },
});
const activityForm = Devvit.createForm((data) => {
    const summary = typeof data.summary === "string" ? data.summary : "(no data)";
    return {
        title: "Triage Activity",
        acceptLabel: "Close",
        cancelLabel: "Done",
        fields: [
            {
                name: "summary",
                label: "Live moderator activity in this subreddit",
                type: "paragraph",
                defaultValue: summary,
                disabled: true,
            },
        ],
    };
}, async () => { });
Devvit.addMenuItem({
    label: "Triage Activity",
    description: "See mods online, claims, collisions prevented, and today's triage counts.",
    location: "subreddit",
    forUserType: "moderator",
    onPress: async (_, context) => {
        const me = await context.reddit.getCurrentUser();
        if (!me) {
            context.ui.showToast("Triage: not logged in.");
            return;
        }
        const subreddit = await context.reddit.getCurrentSubreddit();
        const modPermissions = await me.getModPermissionsForSubreddit(subreddit.name);
        if (!modPermissions.includes("all") &&
            !modPermissions.includes("posts") &&
            !modPermissions.includes("access")) {
            context.ui.showToast("Triage Activity is mod-only.");
            return;
        }
        const [activity, loads] = await Promise.all([
            getSubActivity(subreddit.name, context),
            getModLoadsToday(subreddit.name, context),
        ]);
        let summary = formatSubActivity(subreddit.name, activity);
        if (loads.length > 0) {
            summary += "\n\nTODAY'S TRIAGE COUNTS:\n";
            for (const l of loads.slice(0, 8)) {
                summary += `  u/${l.username}: ${l.count}\n`;
            }
        }
        context.ui.showForm(activityForm, { summary });
    },
});
Devvit.addSchedulerJob({
    name: WEEKLY_DIGEST_JOB,
    onRun: async (event, context) => {
        const sub = event.data?.subredditName;
        if (!sub)
            return;
        await runWeeklyDigest(sub, context);
    },
});
Devvit.addTrigger({
    event: "AppInstall",
    onEvent: async (event, context) => {
        const subName = event.subreddit?.name;
        if (!subName)
            return;
        await ensureWeeklyDigestScheduled(subName, context);
    },
});
Devvit.addTrigger({
    event: "AutomoderatorFilterPost",
    onEvent: async (event, context) => {
        const postId = event.post?.id;
        if (postId)
            await markAutomodOnTarget(postId, context);
        const sub = event.subreddit?.name ?? "";
        if (event.author && sub) {
            await markAutomodOnAuthor(sub, event.author, event.reason, context);
        }
    },
});
Devvit.addTrigger({
    event: "AutomoderatorFilterComment",
    onEvent: async (event, context) => {
        const commentId = event.comment?.id;
        if (commentId)
            await markAutomodOnTarget(commentId, context);
        const sub = event.subreddit?.name ?? "";
        if (event.author && sub) {
            await markAutomodOnAuthor(sub, event.author, event.reason, context);
        }
    },
});
export default Devvit;
