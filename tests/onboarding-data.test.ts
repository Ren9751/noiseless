import { describe, it, expect } from "vitest";
import { INTEREST_CATEGORIES, LEVELS, DEFAULT_INTEREST_WEIGHT } from "../app/lib/onboarding-data";

describe("onboarding-data", () => {
  it("AI Safety がカテゴリに含まれる", () => {
    const all = INTEREST_CATEGORIES.flatMap((g) => g.topics);
    expect(all).toContain("AI Safety・アラインメント");
  });
  it("レベルは5段階で value が 1..5", () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map((l) => l.value)).toEqual([1, 2, 3, 4, 5]);
  });
  it("各レベルに例文がある", () => {
    for (const l of LEVELS) {
      expect(l.example.length).toBeGreaterThan(20);
    }
  });
  it("デフォルト重みは7", () => {
    expect(DEFAULT_INTEREST_WEIGHT).toBe(7);
  });
});
