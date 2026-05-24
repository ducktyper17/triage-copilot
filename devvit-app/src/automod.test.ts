import { describe, expect, it } from "vitest";

import {
  formatAutoModWarning,
  gatherAutoModIntel,
  markAutomodOnTarget,
} from "./automod.js";
import { createMockContext } from "./test/mockContext.js";

describe("formatAutoModWarning", () => {
  it("returns null when no automod context", () => {
    expect(
      formatAutoModWarning({ actedOnTarget: false, recentAuthorActions: [] })
    ).toBeNull();
  });

  it("warns when automod touched target", () => {
    const text = formatAutoModWarning({
      actedOnTarget: true,
      recentAuthorActions: ["removecomment (1d ago)"],
    });
    expect(text).toContain("AUTOMOD CONTEXT");
    expect(text).toContain("already touched");
    expect(text).toContain("removecomment");
  });
});

describe("gatherAutoModIntel", () => {
  it("reads redis flags for target and author", async () => {
    const context = createMockContext();
    await markAutomodOnTarget("t3_abc", context);
    await context.redis.set(
      "triage:automod-author:testsub:spammer",
      JSON.stringify(["filter (2d ago)"])
    );

    const intel = await gatherAutoModIntel(
      {
        targetId: "t3_abc",
        targetKind: "post",
        subredditName: "testsub",
        authorUsername: "spammer",
        bodyText: "spam",
      },
      context
    );

    expect(intel.actedOnTarget).toBe(true);
    expect(intel.recentAuthorActions).toContain("filter (2d ago)");
  });
});
