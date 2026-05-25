import { describe, it, expect } from "vitest";
import {
  mergeLikedFlag,
  relativeTime,
  sortByFinalScore,
  sourceLabel,
} from "../../../app/lib/article-utils";

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

describe("relativeTime", () => {
  const now = new Date("2026-05-25T12:00:00Z");

  it("1分未満は たった今", () => {
    expect(relativeTime("2026-05-25T11:59:30Z", now)).toBe("たった今");
  });
  it("分単位を返す", () => {
    expect(relativeTime("2026-05-25T11:45:00Z", now)).toBe("15分前");
  });
  it("時間単位を返す", () => {
    expect(relativeTime("2026-05-25T09:00:00Z", now)).toBe("3時間前");
  });
  it("日単位を返す (7日未満)", () => {
    expect(relativeTime("2026-05-22T12:00:00Z", now)).toBe("3日前");
  });
});

describe("sourceLabel", () => {
  it("既知のソースは日本語に変換", () => {
    expect(sourceLabel("hatena")).toBe("はてブ");
    expect(sourceLabel("hackernews")).toBe("HN");
    expect(sourceLabel("arxiv")).toBe("arXiv");
  });
  it("未知のソースはそのまま返す", () => {
    expect(sourceLabel("custom")).toBe("custom");
  });
});
