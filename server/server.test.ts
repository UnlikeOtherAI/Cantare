import { describe, expect, it } from "vitest";
import { backgroundPrompt, parseBackgroundRequest } from "./backgrounds";
import { RateLimiter } from "./rateLimit";

describe("parseBackgroundRequest", () => {
  it("accepts a prompt and defaults size and quality", () => {
    expect(parseBackgroundRequest({ prompt: "  wet slate bar top  " })).toEqual({ prompt: "wet slate bar top", size: "1024x1536", quality: "high" });
  });

  it("rejects empty and oversized prompts", () => {
    expect(() => parseBackgroundRequest({ prompt: "" })).toThrow();
    expect(() => parseBackgroundRequest({ prompt: "x".repeat(1001) })).toThrow();
    expect(() => parseBackgroundRequest(null)).toThrow();
  });

  it("ignores unknown sizes", () => {
    expect(parseBackgroundRequest({ prompt: "beach", size: "4096x4096" }).size).toBe("1024x1536");
  });
});

describe("backgroundPrompt", () => {
  it("keeps products out of the plate", () => {
    const prompt = backgroundPrompt("sunlit beach bar");
    expect(prompt).toContain("Do not include any cans");
    expect(prompt.endsWith("Scene: sunlit beach bar")).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("limits per key per window and refunds", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.take("a")).toBe(0);
    expect(limiter.take("a")).toBe(0);
    expect(limiter.take("a")).toBe(1000);
    expect(limiter.take("b")).toBe(0);
    limiter.refund("a");
    expect(limiter.take("a")).toBe(0);
    now = 1000;
    expect(limiter.take("a")).toBe(0);
  });
});
