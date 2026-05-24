function itemTitle(body, max = 60) {
    const t = body.replace(/\s+/g, " ").trim();
    if (t.length <= max)
        return t;
    return `${t.slice(0, max - 1)}…`;
}
function redditUrl(permalink) {
    if (permalink.startsWith("http"))
        return permalink;
    return `https://www.reddit.com${permalink}`;
}
/** Next mod-queue item after the current one (for skip guidance). */
export async function getNextQueueItem(subredditName, excludeTargetId, context) {
    try {
        const subreddit = await context.reddit.getSubredditByName(subredditName);
        const listing = subreddit.getModQueue({ type: "all", limit: 25 });
        let skippedCurrent = !excludeTargetId;
        for await (const item of listing) {
            const id = item.id;
            if (!skippedCurrent) {
                if (id === excludeTargetId)
                    skippedCurrent = true;
                continue;
            }
            const kind = id.startsWith("t1_") ? "comment" : "post";
            const title = kind === "post" && "title" in item && typeof item.title === "string"
                ? itemTitle(item.title)
                : "body" in item && typeof item.body === "string"
                    ? itemTitle(item.body)
                    : kind === "post"
                        ? "(post)"
                        : "(comment)";
            const permalink = "permalink" in item && typeof item.permalink === "string"
                ? item.permalink
                : "";
            return {
                id,
                kind,
                title,
                permalink,
                url: redditUrl(permalink),
            };
        }
        return null;
    }
    catch (e) {
        console.warn("[triage] mod queue fetch failed", e.message);
        return null;
    }
}
export function formatNextQueueHint(next) {
    if (!next)
        return null;
    return [
        "⏭ NEXT QUEUE ITEM",
        `${next.kind === "post" ? "Post" : "Comment"}: ${next.title}`,
        `Open: ${next.url}`,
    ].join("\n");
}
