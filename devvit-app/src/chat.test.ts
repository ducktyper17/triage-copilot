import { describe, expect, it } from "vitest";

import { appendModChat, formatModChat, getModChat } from "./chat.js";
import { createMockContext } from "./test/mockContext.js";

describe("mod chat", () => {
  it("appends and retrieves messages", async () => {
    const context = createMockContext();
    await appendModChat("t3_abc", "alice", "checking reports", context);
    await appendModChat("t3_abc", "bob", "I got this one", context);

    const messages = await getModChat("t3_abc", context);
    expect(messages).toHaveLength(2);
    expect(messages[0].username).toBe("alice");
    expect(messages[1].text).toBe("I got this one");
  });

  it("formats chat block for intel summary", () => {
    const text = formatModChat([
      { username: "alice", text: "spam pattern?", at: Date.now() - 30_000 },
    ]);
    expect(text).toContain("MOD CHAT");
    expect(text).toContain("u/alice");
    expect(text).toContain("spam pattern?");
  });
});
