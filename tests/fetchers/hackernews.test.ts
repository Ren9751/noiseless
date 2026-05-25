import { describe, it, expect } from "vitest";
import { parseAlgoliaResponse } from "../../scripts/fetchers/hackernews";

const SAMPLE = {
  hits: [
    {
      objectID: "12345",
      title: "A great article",
      url: "https://example.com/a",
      points: 200,
      num_comments: 50,
      created_at: "2026-05-18T03:00:00Z",
    },
    {
      objectID: "12346",
      title: "Ask HN: something",
      url: null,
      points: 80,
      num_comments: 30,
      created_at: "2026-05-18T02:30:00Z",
    },
  ],
};

describe("parseAlgoliaResponse", () => {
  it("URL がある hit のみ採用する", () => {
    const entries = parseAlgoliaResponse(SAMPLE, "src-hn");
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe("https://example.com/a");
  });

  it("points と comments を raw_metadata に詰める", () => {
    const entries = parseAlgoliaResponse(SAMPLE, "src-hn");
    expect(entries[0].raw_metadata.points).toBe(200);
    expect(entries[0].raw_metadata.num_comments).toBe(50);
  });
});
