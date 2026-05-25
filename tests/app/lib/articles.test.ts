import { describe, it, expect } from "vitest";
import { mergeLikedFlag, sortByFinalScore } from "../../../app/lib/article-utils";

describe("sortByFinalScore", () => {
  it("final_score 降順、同点なら fetched_at 降順で並べる", () => {
    const articles = [
      { id: "a", final_score: 7, fetched_at: "2026-05-25T10:00:00Z" },
      { id: "b", final_score: 9, fetched_at: "2026-05-25T08:00:00Z" },
      { id: "c", final_score: 7, fetched_at: "2026-05-25T12:00:00Z" },
    ];
    const result = sortByFinalScore(articles);
    expect(result.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });
});

describe("mergeLikedFlag", () => {
  it("いいね済みURLのフラグを true にする", () => {
    const articles = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const likedIds = new Set(["a", "c"]);
    const result = mergeLikedFlag(articles, likedIds);
    expect(result.find((a) => a.id === "a")?.liked).toBe(true);
    expect(result.find((a) => a.id === "b")?.liked).toBe(false);
    expect(result.find((a) => a.id === "c")?.liked).toBe(true);
  });
});
