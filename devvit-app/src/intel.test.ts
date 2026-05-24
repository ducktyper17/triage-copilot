import { describe, expect, it, vi } from "vitest";

import { gatherReportIntel, gatherUserIntel } from "./intel.js";
import type { CopilotInput } from "./types.js";
import { createMockContext } from "./test/mockContext.js";

describe("gatherUserIntel", () => {
  it("returns zeroed intel when user is not found", async () => {
    const context = createMockContext({
      reddit: {
        getUserByUsername: async () => null,
        getModNotes: vi.fn(),
      },
    });

    const intel = await gatherUserIntel("ghost", "testsub", context);
    expect(intel).toEqual({
      username: "ghost",
      accountAgeDays: 0,
      karmaInSub: 0,
      priorBansInSub: 0,
      lastBanDaysAgo: null,
      modNotes: [],
      recentActionsAgainstUser: [],
    });
  });

  it("aggregates karma, bans, and mod notes from Reddit API", async () => {
    const noteCreated = new Date("2026-04-01T00:00:00Z");
    async function* modNotes() {
      yield {
        userNote: { note: "watch list" },
        type: "USER_NOTE",
        modAction: null,
        createdAt: noteCreated,
      };
      yield {
        userNote: null,
        type: "MOD_ACTION",
        modAction: { type: "banuser" },
        createdAt: noteCreated,
      };
    }

    const context = createMockContext({
      reddit: {
        getUserByUsername: async () => ({
          createdAt: new Date("2025-01-01T00:00:00Z"),
          linkKarma: 100,
          commentKarma: 50,
        }),
        getModNotes: () => modNotes(),
      },
    });

    const intel = await gatherUserIntel("spammer", "testsub", context);
    expect(intel.karmaInSub).toBe(150);
    expect(intel.priorBansInSub).toBe(1);
    expect(intel.modNotes).toContain("watch list");
    expect(intel.recentActionsAgainstUser).toContain("banuser");
  });
});

describe("gatherReportIntel", () => {
  const input: CopilotInput = {
    targetId: "t3_abc",
    targetKind: "post",
    subredditName: "testsub",
    authorUsername: "user1",
    bodyText: "content",
  };

  it("returns null when there are no user reports", async () => {
    const context = createMockContext({
      reddit: {
        getPostById: async () => ({ userReportReasons: [] }),
      },
    });
    expect(await gatherReportIntel(input, context)).toBeNull();
  });

  it("returns report count when reports exist", async () => {
    const context = createMockContext({
      reddit: {
        getPostById: async () => ({
          userReportReasons: ["spam", "harassment", "spam"],
        }),
      },
    });
    const report = await gatherReportIntel(input, context);
    expect(report?.reportCount).toBe(3);
  });
});
