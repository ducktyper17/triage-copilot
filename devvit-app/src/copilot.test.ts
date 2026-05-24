import { describe, expect, it, vi } from "vitest";

import { executeActionChain, formatIntelSummary, resolveRemovalReason } from "./copilot.js";
import type { CopilotActionChoices, CopilotInput, CopilotIntel } from "./types.js";
import { createMockContext } from "./test/mockContext.js";

function makeIntel(overrides: Partial<CopilotIntel["user"]> = {}): CopilotIntel {
  return {
    input: {
      targetId: "t3_abc",
      targetKind: "post",
      subredditName: "testsub",
      authorUsername: "user1",
      bodyText: "hello",
    },
    user: {
      username: "user1",
      accountAgeDays: 365,
      karmaInSub: 1200,
      priorBansInSub: 0,
      lastBanDaysAgo: null,
      modNotes: [],
      recentActionsAgainstUser: [],
      ...overrides,
    },
    report: null,
    autoMod: { actedOnTarget: false, recentAuthorActions: [] },
    brigade: { flagged: false, matchedSubs: [], recentActivityCount: 0 },
    sparkline: { days: [], labels: [], sparkline: "", totalInSub: 0 },
    removalTemplates: [],
    similarRemovals: [],
  };
}

describe("formatIntelSummary", () => {
  it("shows user stats without bans", () => {
    const text = formatIntelSummary(makeIntel(), null);
    expect(text).toContain("u/user1");
    expect(text).toContain("No prior bans");
  });

  it("shows prior bans and mod notes when present", () => {
    const text = formatIntelSummary(
      makeIntel({
        priorBansInSub: 2,
        lastBanDaysAgo: 14,
        modNotes: ["spam", "ignored warning"],
      }),
      null
    );
    expect(text).toContain("Prior bans in sub: 2");
    expect(text).toContain("Mod notes: spam · ignored warning");
  });

  it("includes LLM verdict when available", () => {
    const text = formatIntelSummary(makeIntel(), {
      available: true,
      tldr: "Likely rule violation.",
      suggestedAction: "remove",
      ruleHint: "Be civil",
      confidence: 0.81,
    });
    expect(text).toContain("REMOVE (81% conf)");
    expect(text).toContain("rule: Be civil");
    expect(text).toContain("Likely rule violation.");
  });

  it("shows disabled LLM message when unavailable", () => {
    const text = formatIntelSummary(makeIntel(), {
      available: false,
      tldr: "LLM disabled (configure provider + API key in app settings).",
      suggestedAction: "review",
      ruleHint: null,
      confidence: 0,
    });
    expect(text).toContain("LLM disabled");
  });
});

describe("resolveRemovalReason", () => {
  it("prefers AI reason when enabled", () => {
    expect(
      resolveRemovalReason("__custom__", "manual", true, "AI wrote this")
    ).toBe("AI wrote this");
  });

  it("uses manual reason over template", () => {
    expect(
      resolveRemovalReason("Template text", "My reason", false, "")
    ).toBe("My reason");
  });

  it("falls back to template when manual is empty", () => {
    expect(
      resolveRemovalReason("Removed per rules", "", false, "")
    ).toBe("Removed per rules");
  });
});

describe("executeActionChain", () => {
  const input: CopilotInput = {
    targetId: "t3_abc",
    targetKind: "post",
    subredditName: "testsub",
    authorUsername: "baduser",
    bodyText: "spam",
  };

  const baseChoices: CopilotActionChoices = {
    remove: false,
    banDays: 0,
    replyWithReason: false,
    removalReason: "",
    lockThread: false,
    sendModmail: false,
    modmailSubject: "",
    modmailBody: "",
  };

  it("returns no-op message when no actions selected", async () => {
    const target = {
      lock: vi.fn(),
      remove: vi.fn(),
    };
    const context = createMockContext({
      reddit: {
        getPostById: async () => target,
        banUser: vi.fn(),
        submitComment: vi.fn(),
      },
    });

    const result = await executeActionChain(input, baseChoices, context);
    expect(result.success).toBe(true);
    expect(result.message).toContain("no actions selected");
  });

  it("executes reply, lock, remove, ban in order", async () => {
    const order: string[] = [];
    const reply = { distinguish: vi.fn(async () => order.push("distinguish")) };
    const target = {
      lock: vi.fn(async () => order.push("lock")),
      remove: vi.fn(async () => order.push("remove")),
    };
    const context = createMockContext({
      reddit: {
        getPostById: async () => target,
        submitComment: vi.fn(async () => {
          order.push("reply");
          return reply;
        }),
        banUser: vi.fn(async () => {
          order.push("ban");
        }),
      },
    });

    const result = await executeActionChain(
      input,
      {
        ...baseChoices,
        replyWithReason: true,
        removalReason: "Rule 1",
        lockThread: true,
        remove: true,
        banDays: 7,
      },
      context
    );

    expect(result.success).toBe(true);
    expect(order).toEqual(["reply", "distinguish", "lock", "remove", "ban"]);
    expect(result.message).toContain("replied with removal reason");
    expect(result.message).toContain("banned u/baduser for 7d");
  });

  it("reports partial failure with completed actions", async () => {
    const target = {
      lock: vi.fn(async () => {
        throw new Error("permission denied");
      }),
      remove: vi.fn(),
    };
    const context = createMockContext({
      reddit: {
        getPostById: async () => target,
        submitComment: vi.fn(),
        banUser: vi.fn(),
      },
    });

    const result = await executeActionChain(
      input,
      { ...baseChoices, lockThread: true },
      context
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Triage failed after");
    expect(result.message).toContain("permission denied");
  });
});
