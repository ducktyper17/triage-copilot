import { describe, expect, it } from "vitest";

import {
  formatLoadBalancer,
  getModLoadsToday,
  recordModAction,
} from "./stats.js";
import { createMockContext } from "./test/mockContext.js";

describe("mod load stats", () => {
  it("tracks per-mod triage counts for today", async () => {
    const context = createMockContext();
    await recordModAction("testsub", "alice", context);
    await recordModAction("testsub", "alice", context);
    await recordModAction("testsub", "bob", context);

    const loads = await getModLoadsToday("testsub", context);
    expect(loads).toEqual([
      { username: "alice", count: 2 },
      { username: "bob", count: 1 },
    ]);
  });

  it("suggests load balancing when one mod is overloaded", () => {
    const text = formatLoadBalancer(
      [
        { username: "alice", count: 20 },
        { username: "bob", count: 3 },
      ],
      "alice"
    );
    expect(text).toContain("LOAD BALANCER");
    expect(text).toContain("u/bob");
  });

  it("shows team leader for moderate load", () => {
    const text = formatLoadBalancer(
      [
        { username: "alice", count: 5 },
        { username: "bob", count: 8 },
      ],
      "alice"
    );
    expect(text).toContain("team leader: u/bob");
  });
});
