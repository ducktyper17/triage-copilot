import { describe, expect, it, vi } from "vitest";

import {
  clampConfidence,
  defaultModelFor,
  loadLLMSettings,
  normalizeAction,
  runLLMVerdict,
  safeJsonParse,
} from "./llm.js";
import type { CopilotIntel } from "./types.js";
import { createMockContext } from "./test/mockContext.js";

describe("safeJsonParse", () => {
  it("parses clean JSON", () => {
    expect(safeJsonParse('{"tldr":"ok","suggestedAction":"review"}')).toEqual({
      tldr: "ok",
      suggestedAction: "review",
    });
  });

  it("extracts JSON from markdown fences", () => {
    const raw = 'Here is the verdict:\n```json\n{"tldr":"spam","confidence":0.9}\n```';
    expect(safeJsonParse(raw)).toEqual({ tldr: "spam", confidence: 0.9 });
  });

  it("returns null for unparseable text", () => {
    expect(safeJsonParse("not json at all")).toBeNull();
  });
});

describe("clampConfidence", () => {
  it("clamps to 0..1 range", () => {
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence(-0.2)).toBe(0);
    expect(clampConfidence("0.75")).toBe(0.75);
  });

  it("returns 0 for non-numeric values", () => {
    expect(clampConfidence("n/a")).toBe(0);
    expect(clampConfidence(undefined)).toBe(0);
  });
});

describe("normalizeAction", () => {
  it("accepts valid actions case-insensitively", () => {
    expect(normalizeAction("REMOVE")).toBe("remove");
    expect(normalizeAction("Approve")).toBe("approve");
    expect(normalizeAction("review")).toBe("review");
  });

  it("defaults unknown actions to review", () => {
    expect(normalizeAction("ban")).toBe("review");
    expect(normalizeAction(null)).toBe("review");
  });
});

describe("defaultModelFor", () => {
  it("returns provider-specific defaults", () => {
    expect(defaultModelFor("groq")).toBe("llama-3.3-70b-versatile");
    expect(defaultModelFor("anthropic")).toBe("claude-haiku-4-5-20251001");
    expect(defaultModelFor("openai")).toBe("gpt-4o-mini");
    expect(defaultModelFor("none")).toBe("");
  });
});

describe("loadLLMSettings", () => {
  it("uses configured model when set", async () => {
    const context = createMockContext({
      settings: {
        get: async (key: string) => {
          if (key === "llm-provider") return "groq";
          if (key === "llm-model") return "custom-model";
          if (key === "llm-api-key") return "secret";
          if (key === "sub-rules-text") return "No spam";
          return undefined;
        },
      },
    } as Partial<import("@devvit/public-api").Devvit.Context>);

    const settings = await loadLLMSettings(context);
    expect(settings.model).toBe("custom-model");
    expect(settings.provider).toBe("groq");
    expect(settings.subRules).toBe("No spam");
  });

  it("falls back to default model when llm-model is empty", async () => {
    const context = createMockContext({
      settings: {
        get: async (key: string) => {
          if (key === "llm-provider") return "openai";
          return "";
        },
      },
    } as Partial<import("@devvit/public-api").Devvit.Context>);

    const settings = await loadLLMSettings(context);
    expect(settings.model).toBe("gpt-4o-mini");
  });
});

const sampleIntel = {
  input: {
    targetId: "t3_abc",
    targetKind: "post" as const,
    subredditName: "test",
    authorUsername: "spammer",
    bodyText: "buy now",
  },
  user: {
    username: "spammer",
    accountAgeDays: 2,
    karmaInSub: 10,
    priorBansInSub: 1,
    lastBanDaysAgo: 30,
    modNotes: ["repeat offender"],
    recentActionsAgainstUser: ["banuser"],
  },
  report: { reportCount: 3, reportersByAccountAge: { newAccounts: 0, total: 0 }, reporterUsernames: [] },
} as CopilotIntel;

describe("runLLMVerdict", () => {
  it("returns disabled verdict when provider is none", async () => {
    const context = createMockContext({
      settings: {
        get: async (key: string) =>
          key === "llm-provider" ? "none" : "",
      },
    } as Partial<import("@devvit/public-api").Devvit.Context>);

    const verdict = await runLLMVerdict(sampleIntel, context);
    expect(verdict.available).toBe(false);
    expect(verdict.suggestedAction).toBe("review");
    expect(verdict.tldr).toContain("LLM disabled");
  });

  it("returns disabled verdict when API key is missing", async () => {
    const context = createMockContext({
      settings: {
        get: async (key: string) =>
          key === "llm-provider" ? "groq" : "",
      },
    } as Partial<import("@devvit/public-api").Devvit.Context>);

    const verdict = await runLLMVerdict(sampleIntel, context);
    expect(verdict.available).toBe(false);
  });

  it("parses successful Groq JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                tldr: "Obvious spam link.",
                suggestedAction: "remove",
                ruleHint: "No self-promotion",
                confidence: 0.92,
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = createMockContext({
      settings: {
        get: async (key: string) => {
          if (key === "llm-provider") return "groq";
          if (key === "llm-api-key") return "test-key";
          return "";
        },
      },
    } as Partial<import("@devvit/public-api").Devvit.Context>);

    const verdict = await runLLMVerdict(sampleIntel, context);
    expect(verdict.available).toBe(true);
    expect(verdict.suggestedAction).toBe("remove");
    expect(verdict.ruleHint).toBe("No self-promotion");
    expect(verdict.confidence).toBe(0.92);

    vi.unstubAllGlobals();
  });
});
