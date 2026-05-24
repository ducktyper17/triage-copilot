import { formatAutoModWarning } from "./automod.js";
import { formatBrigadeWarning, formatSparkline, } from "./intel.js";
import { formatSimilarRemovals } from "./similar.js";
export function formatIntelSummary(intel, verdict, extras) {
    const { user, report } = intel;
    const lines = [];
    lines.push(`u/${user.username}`);
    lines.push(`Account ${user.accountAgeDays}d old  ·  karma: ${user.karmaInSub}`);
    if (user.priorBansInSub > 0) {
        const lastBan = user.lastBanDaysAgo === null
            ? ""
            : `, last ${user.lastBanDaysAgo}d ago`;
        lines.push(`Prior bans in sub: ${user.priorBansInSub}${lastBan}`);
    }
    else {
        lines.push("No prior bans in this sub.");
    }
    if (user.modNotes.length > 0) {
        lines.push(`Mod notes: ${user.modNotes.slice(0, 2).join(" · ")}`);
    }
    if (report) {
        lines.push(`${report.reportCount} user reports.`);
    }
    lines.push(formatSparkline(intel.sparkline));
    const automod = formatAutoModWarning(intel.autoMod);
    if (automod) {
        lines.push("");
        lines.push(automod);
    }
    const brigade = formatBrigadeWarning(intel.brigade);
    if (brigade) {
        lines.push("");
        lines.push(brigade);
    }
    const similar = formatSimilarRemovals(intel.similarRemovals);
    if (similar) {
        lines.push("");
        lines.push(similar);
    }
    if (verdict && verdict.available) {
        lines.push("");
        const confPct = Math.round(verdict.confidence * 100);
        lines.push(`🤖 ${verdict.suggestedAction.toUpperCase()} (${confPct}% conf)`);
        if (verdict.ruleHint)
            lines.push(`   rule: ${verdict.ruleHint}`);
        lines.push(`   ${verdict.tldr}`);
        if (confPct >= 90 && verdict.suggestedAction === "remove") {
            lines.push("   ✨ Trust AI: checkboxes pre-filled below.");
        }
    }
    else if (verdict) {
        lines.push("");
        lines.push(`🤖 ${verdict.tldr}`);
    }
    if (extras?.userFacingReason) {
        lines.push("");
        lines.push("📝 AI removal reply (editable below):");
        lines.push(extras.userFacingReason.slice(0, 220));
    }
    if (extras?.modmailDraft) {
        lines.push("");
        lines.push("✉️ AI modmail draft (if you ban):");
        lines.push(extras.modmailDraft.slice(0, 220));
    }
    return lines.join("\n");
}
export function resolveRemovalReason(templateChoice, manualReason, useAiReason, aiReason) {
    if (useAiReason && aiReason.trim().length > 0)
        return aiReason.trim();
    if (manualReason.trim().length > 0)
        return manualReason.trim();
    if (templateChoice && templateChoice !== "__custom__") {
        return templateChoice;
    }
    return "";
}
export async function executeActionChain(input, choices, context) {
    const actions = [];
    try {
        const target = input.targetKind === "post"
            ? await context.reddit.getPostById(input.targetId)
            : await context.reddit.getCommentById(input.targetId);
        if (choices.replyWithReason && choices.removalReason.trim().length > 0) {
            const reply = await context.reddit.submitComment({
                id: input.targetId,
                text: choices.removalReason.trim(),
            });
            await reply.distinguish(true);
            actions.push("replied with removal reason");
        }
        if (choices.lockThread) {
            await target.lock();
            actions.push("locked");
        }
        if (choices.remove) {
            await target.remove();
            actions.push("removed");
        }
        if (choices.banDays > 0) {
            await context.reddit.banUser({
                subredditName: input.subredditName,
                username: input.authorUsername,
                duration: choices.banDays,
                reason: choices.removalReason.trim() || "Triage action chain",
                note: `Triaged ${input.targetKind} ${input.targetId}`,
            });
            actions.push(`banned u/${input.authorUsername} for ${choices.banDays}d`);
            if (choices.sendModmail &&
                choices.modmailBody.trim().length > 0 &&
                input.authorUsername.length > 0) {
                try {
                    await context.reddit.sendPrivateMessageAsSubreddit({
                        to: input.authorUsername,
                        fromSubredditName: input.subredditName,
                        subject: choices.modmailSubject.trim() ||
                            `Regarding your ban from r/${input.subredditName}`,
                        text: choices.modmailBody.trim(),
                    });
                    actions.push("sent modmail");
                }
                catch (e) {
                    console.warn("[triage] modmail failed", e.message);
                    actions.push("modmail failed");
                }
            }
        }
        return {
            success: true,
            message: actions.length > 0
                ? `Triage: ${actions.join("; ")}.`
                : "Triage: no actions selected.",
        };
    }
    catch (e) {
        const msg = e.message;
        console.error("[triage] action chain failed", msg, "completed:", actions);
        return {
            success: false,
            message: `Triage failed after [${actions.join("; ")}]: ${msg}`,
        };
    }
}
