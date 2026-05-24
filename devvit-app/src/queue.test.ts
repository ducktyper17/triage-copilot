import { describe, expect, it } from "vitest";

import { formatNextQueueHint } from "./queue.js";

describe("formatNextQueueHint", () => {
  it("returns null when no next item", () => {
    expect(formatNextQueueHint(null)).toBeNull();
  });

  it("formats post hint with url", () => {
    const text = formatNextQueueHint({
      id: "t3_next",
      kind: "post",
      title: "Suspicious link post",
      permalink: "/r/test/comments/abc/",
      url: "https://www.reddit.com/r/test/comments/abc/",
    });
    expect(text).toContain("NEXT QUEUE ITEM");
    expect(text).toContain("Post: Suspicious link post");
    expect(text).toContain("https://www.reddit.com");
  });
});
