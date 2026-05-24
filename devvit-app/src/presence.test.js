import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIM_DURATION_SECONDS, claimItem, formatClaimStatus, formatSubActivity, formatViewerWarning, getClaim, getOtherViewers, incrementBlocked, recordViewing, releaseClaim, } from "./presence.js";
import { createMockContext } from "./test/mockContext.js";
describe("formatViewerWarning", () => {
    it("returns null when no other viewers", () => {
        expect(formatViewerWarning([])).toBeNull();
    });
    it("lists up to 3 viewer usernames", () => {
        const result = formatViewerWarning([
            { username: "alice", viewedAt: 100 },
            { username: "bob", viewedAt: 90 },
            { username: "carol", viewedAt: 80 },
        ]);
        expect(result).toContain("u/alice");
        expect(result).toContain("u/bob");
        expect(result).toContain("u/carol");
        expect(result).not.toContain("more");
    });
    it("shows overflow count when more than 3 viewers", () => {
        const viewers = Array.from({ length: 5 }, (_, i) => ({
            username: `mod${i}`,
            viewedAt: 100 - i,
        }));
        expect(formatViewerWarning(viewers)).toContain("(+2 more)");
    });
});
describe("formatClaimStatus", () => {
    it("returns neutral status when no claim exists", () => {
        expect(formatClaimStatus(null, "alice")).toEqual({
            banner: null,
            isHeldByOther: false,
            heldBy: null,
            isMine: false,
        });
    });
    it("shows YOU CLAIMED banner for the claim owner", () => {
        const now = Date.now();
        const status = formatClaimStatus({ username: "alice", claimedAt: now }, "alice");
        expect(status.isMine).toBe(true);
        expect(status.isHeldByOther).toBe(false);
        expect(status.banner).toContain("YOU CLAIMED");
    });
    it("shows CLAIMED BY ANOTHER MOD for non-owners", () => {
        const status = formatClaimStatus({ username: "bob", claimedAt: Date.now() - 30000 }, "alice");
        expect(status.isHeldByOther).toBe(true);
        expect(status.isMine).toBe(false);
        expect(status.heldBy).toBe("bob");
        expect(status.banner).toContain("u/bob");
        expect(status.banner).toContain("Override");
    });
});
describe("claim lifecycle (Redis)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-24T12:00:00Z"));
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("first mod gets exclusive claim", async () => {
        const context = createMockContext();
        const status = await claimItem("t3_abc", "alice", context, "testsub");
        expect(status.isMine).toBe(true);
        expect(status.isHeldByOther).toBe(false);
    });
    it("second mod sees item held by first mod", async () => {
        const context = createMockContext();
        await claimItem("t3_abc", "alice", context, "testsub");
        const status = await claimItem("t3_abc", "bob", context, "testsub");
        expect(status.isHeldByOther).toBe(true);
        expect(status.heldBy).toBe("alice");
        expect(status.isMine).toBe(false);
    });
    it("same mod refreshing claim keeps ownership", async () => {
        const context = createMockContext();
        await claimItem("t3_abc", "alice", context);
        vi.advanceTimersByTime(60000);
        const status = await claimItem("t3_abc", "alice", context);
        expect(status.isMine).toBe(true);
    });
    it("expired claim allows a new mod to claim", async () => {
        const context = createMockContext();
        await claimItem("t3_abc", "alice", context);
        vi.advanceTimersByTime(CLAIM_DURATION_SECONDS * 1000 + 1);
        const claim = await getClaim("t3_abc", context);
        expect(claim).toBeNull();
        const status = await claimItem("t3_abc", "bob", context);
        expect(status.isMine).toBe(true);
    });
    it("releaseClaim only clears own claim", async () => {
        const context = createMockContext();
        await claimItem("t3_abc", "alice", context);
        await releaseClaim("t3_abc", "bob", context);
        expect(await getClaim("t3_abc", context)).not.toBeNull();
        await releaseClaim("t3_abc", "alice", context);
        expect(await getClaim("t3_abc", context)).toBeNull();
    });
});
describe("presence viewing (Redis)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-24T12:00:00Z"));
    });
    afterEach(() => {
        vi.useRealTimers();
    });
    it("getOtherViewers excludes self and returns active viewers", async () => {
        const context = createMockContext();
        await recordViewing("t3_abc", "alice", context);
        await recordViewing("t3_abc", "bob", context);
        const others = await getOtherViewers("t3_abc", "alice", context);
        expect(others.map((v) => v.username)).toEqual(["bob"]);
    });
    it("prunes stale viewers beyond 90s TTL", async () => {
        const context = createMockContext();
        await recordViewing("t3_abc", "bob", context);
        vi.advanceTimersByTime(91000);
        const others = await getOtherViewers("t3_abc", "alice", context);
        expect(others).toEqual([]);
    });
});
describe("incrementBlocked", () => {
    it("increments collision counter per subreddit", async () => {
        const context = createMockContext();
        expect(await incrementBlocked("testsub", context)).toBe(1);
        expect(await incrementBlocked("testsub", context)).toBe(2);
    });
});
describe("formatSubActivity", () => {
    it("shows empty state when no active items", () => {
        const text = formatSubActivity("AskHistorians", {
            activeItems: [],
            totalBlocked: 0,
            uniqueMods: [],
        });
        expect(text).toContain("r/AskHistorians");
        expect(text).toContain("No active items");
        expect(text).toContain("Collisions prevented");
    });
    it("labels posts and comments and shows claim/viewers", () => {
        const text = formatSubActivity("testsub", {
            activeItems: [
                {
                    targetId: "t3_post123",
                    lastActiveSec: 12,
                    viewers: [{ username: "alice", viewedAt: Date.now() }],
                    claim: { username: "bob", claimedAt: Date.now() - 5000 },
                },
                {
                    targetId: "t1_comment456",
                    lastActiveSec: 30,
                    viewers: [],
                    claim: null,
                },
            ],
            totalBlocked: 7,
            uniqueMods: ["alice", "bob"],
        });
        expect(text).toContain("Post post123");
        expect(text).toContain("Comment comment456");
        expect(text).toContain("CLAIMED by u/bob");
        expect(text).toContain("Collisions prevented (all time): 7");
    });
});
