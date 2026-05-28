import { describe, it, expect } from "vitest";
import { isOnboarded } from "../app/lib/onboarding-gate";

describe("isOnboarded", () => {
  it("onboarded_at が null なら未完了", () => {
    expect(isOnboarded(null)).toBe(false);
  });
  it("onboarded_at に値があれば完了", () => {
    expect(isOnboarded("2026-05-28T10:00:00Z")).toBe(true);
  });
});
