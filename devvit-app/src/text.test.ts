import { describe, expect, it } from "vitest";

import {
  buildSparkline,
  contentFingerprint,
  similarityScore,
} from "./text.js";

describe("contentFingerprint", () => {
  it("normalizes and strips short words", () => {
    const fp = contentFingerprint("Buy NOW!!! cheap crypto spam link");
    expect(fp).toContain("cheap");
    expect(fp).toContain("crypto");
    expect(fp).not.toContain("buy");
  });
});

describe("similarityScore", () => {
  it("returns 1 for identical fingerprints", () => {
    const fp = "spam crypto cheap offer";
    expect(similarityScore(fp, fp)).toBe(1);
  });

  it("returns 0 for disjoint fingerprints", () => {
    expect(similarityScore("apple banana cherry", "dog elephant fox")).toBe(0);
  });

  it("returns partial score for overlapping words", () => {
    const score = similarityScore(
      "spam crypto cheap",
      "spam crypto offer"
    );
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(1);
  });
});

describe("buildSparkline", () => {
  it("renders ASCII bars and total count", () => {
    const { sparkline, total } = buildSparkline([0, 1, 2, 5, 1]);
    expect(total).toBe(9);
    expect(sparkline.length).toBe(5);
    expect(sparkline).toMatch(/[▁▂▃▄▅▆▇█]/);
  });
});
