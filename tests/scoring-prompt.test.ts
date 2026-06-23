import { describe, it, expect } from "vitest";
import { buildPrompt } from "../scripts/lib/scoring-prompt";

const base = {
  interests: [{ topic: "AI Safety", weight: 9 }],
  special_rules: "",
};

describe("buildPrompt", () => {
  it("興味分野を本文に含む", () => {
    const p = buildPrompt({ ...base, it_level: 3 });
    expect(p).toContain("AI Safety");
    expect(p).toContain("重要度 9/10");
  });
  it("入門レベルの難易度指示を含む", () => {
    const p = buildPrompt({ ...base, it_level: 1 });
    expect(p).toContain("ITをほぼ知らない");
  });
  it("エキスパートレベルの難易度指示を含む", () => {
    const p = buildPrompt({ ...base, it_level: 5 });
    expect(p).toContain("研究者・上級エンジニア");
  });
  it("レベルnullは中級の指示になる", () => {
    const p = buildPrompt({ ...base, it_level: null });
    expect(p).toContain("普段からIT記事を読む人");
  });

  it("いいねがある時だけ「最近いいねした記事」を注入する（P6①）", () => {
    const without = buildPrompt({ ...base, it_level: 3 });
    expect(without).not.toContain("最近いいねした記事");

    const withLikes = buildPrompt({
      ...base,
      it_level: 3,
      liked_titles: ["量子コンピュータの誤り訂正が前進", "RAGの再ランク手法を比較"],
    });
    expect(withLikes).toContain("最近いいねした記事");
    expect(withLikes).toContain("量子コンピュータの誤り訂正が前進");
    expect(withLikes).toContain("RAGの再ランク手法を比較");
  });

  it("liked_titles が空配列なら注入しない", () => {
    const p = buildPrompt({ ...base, it_level: 3, liked_titles: [] });
    expect(p).not.toContain("最近いいねした記事");
  });

  it("disliked_titles がある時だけ「興味なし」例を注入する（T10）", () => {
    const without = buildPrompt({ ...base, it_level: 3 });
    expect(without).not.toContain("興味なし」にした記事");

    const withDislikes = buildPrompt({
      ...base,
      it_level: 3,
      disliked_titles: ["芸能ゴシップまとめ", "今日の星座占いランキング"],
    });
    expect(withDislikes).toContain("興味なし」にした記事");
    expect(withDislikes).toContain("芸能ゴシップまとめ");
    expect(withDislikes).toContain("今日の星座占いランキング");
  });

  it("disliked_titles が空配列なら注入しない", () => {
    const p = buildPrompt({ ...base, it_level: 3, disliked_titles: [] });
    expect(p).not.toContain("興味なし」にした記事");
  });
});
