import { describe, it, expect } from "vitest";
import {
  buildScoringText,
  capByScore,
  mapWithConcurrency,
} from "../scripts/lib/initial-batch-utils";
import type { RawEntry } from "../scripts/lib/types";

const mk = (title: string, body_hint?: string | null): RawEntry => ({
  source_id: "s",
  url: "u",
  title,
  raw_metadata: {},
  published_at: null,
  body_hint,
});

describe("buildScoringText", () => {
  it("body_hint があればそれを使う", () => {
    expect(buildScoringText(mk("T", "abstract text"))).toBe("abstract text");
  });
  it("body_hint が無ければ title", () => {
    expect(buildScoringText(mk("T", null))).toBe("T");
    expect(buildScoringText(mk("T"))).toBe("T");
  });
  it("body_hint が空白だけなら title", () => {
    expect(buildScoringText(mk("T", "   "))).toBe("T");
  });
});

describe("capByScore", () => {
  it("prompt_score 降順で上位N件", () => {
    const items = [
      { id: 1, scoring: { prompt_score: 5 } },
      { id: 2, scoring: { prompt_score: 9 } },
      { id: 3, scoring: { prompt_score: 7 } },
    ];
    const top2 = capByScore(items, 2);
    expect(top2.map((x) => x.id)).toEqual([2, 3]);
  });
});

describe("mapWithConcurrency", () => {
  it("全件処理して順序を保つ", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8]);
  });
  it("同時実行数を超えない", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return null;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
