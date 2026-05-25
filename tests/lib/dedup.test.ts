import { describe, it, expect } from "vitest";
import { dedupeByUrl } from "../../scripts/lib/dedup";
import type { RawEntry } from "../../scripts/lib/types";

function entry(url: string, title: string): RawEntry {
  return {
    source_id: "s1",
    url,
    title,
    raw_metadata: {},
    published_at: null,
  };
}

describe("dedupeByUrl", () => {
  it("同一URLは1件にまとめる", () => {
    const entries = [
      entry("https://a.com/1", "A1"),
      entry("https://a.com/1", "A1 dup"),
      entry("https://a.com/2", "A2"),
    ];
    const result = dedupeByUrl(entries);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.url)).toEqual(["https://a.com/1", "https://a.com/2"]);
  });

  it("空配列ならそのまま返す", () => {
    expect(dedupeByUrl([])).toEqual([]);
  });

  it("最初に出現したものを優先する", () => {
    const entries = [
      entry("https://a.com/1", "first"),
      entry("https://a.com/1", "second"),
    ];
    const result = dedupeByUrl(entries);
    expect(result[0].title).toBe("first");
  });
});
