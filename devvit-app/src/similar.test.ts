import { describe, expect, it } from "vitest";

import {
  findSimilarRemovals,
  formatSimilarRemovals,
  recordRemovalForSimilarity,
} from "./similar.js";
import { createMockContext } from "./test/mockContext.js";

describe("similar removals", () => {
  it("finds matches above threshold after recording", async () => {
    const context = createMockContext();
    const body =
      "buy cheap cryptocurrency investment opportunity guaranteed returns";

    await recordRemovalForSimilarity(
      "testsub",
      "t3_old",
      body,
      "No spam",
      "Crypto scam removed",
      context
    );

    const matches = await findSimilarRemovals(
      "testsub",
      body,
      context,
      "t3_new"
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].score).toBeGreaterThanOrEqual(0.35);
    expect(matches[0].ruleHint).toBe("No spam");
  });

  it("excludes current target id", async () => {
    const context = createMockContext();
    const body = "identical spam message about cheap crypto deals";

    await recordRemovalForSimilarity(
      "testsub",
      "t3_same",
      body,
      null,
      "Removed",
      context
    );

    const matches = await findSimilarRemovals(
      "testsub",
      body,
      context,
      "t3_same"
    );
    expect(matches).toEqual([]);
  });

  it("formats matches for display", () => {
    const text = formatSimilarRemovals([
      {
        targetId: "t3_x",
        ruleHint: "Spam",
        tldr: "Crypto scam",
        daysAgo: 2,
        score: 0.72,
      },
    ]);
    expect(text).toContain("SIMILAR TO RECENTLY REMOVED");
    expect(text).toContain("72% match");
    expect(text).toContain("Spam");
  });
});
