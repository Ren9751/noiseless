import { describe, it, expect } from "vitest";
import { groupOfTopic, balanceByGroup } from "../app/lib/article-utils";

describe("groupOfTopic", () => {
  it("既知トピックは所属グループに対応する", () => {
    expect(groupOfTopic("Python")).toBe("プログラミング言語");
    expect(groupOfTopic("LLM・大規模言語モデル")).toBe("AI・機械学習");
    expect(groupOfTopic("React・Next.js")).toBe("Web・フロントエンド");
  });
  it("null・未知トピックは「その他」", () => {
    expect(groupOfTopic(null)).toBe("その他");
    expect(groupOfTopic("存在しないトピック")).toBe("その他");
  });
});

describe("balanceByGroup", () => {
  const mk = (final_score: number, matched_topic: string | null, id: string) => ({
    final_score,
    matched_topic,
    id,
  });

  it("1グループが埋め尽くさないよう交互に並べる", () => {
    // 純粋な点数順だと AI が上位を独占するが、グループ均等で交互になる
    const arts = [
      mk(10, "LLM・大規模言語モデル", "ai1"),
      mk(9, "LLM・大規模言語モデル", "ai2"),
      mk(8, "LLM・大規模言語モデル", "ai3"),
      mk(7, "Python", "py1"),
      mk(6, "Python", "py2"),
    ];
    const out = balanceByGroup(arts).map((a) => a.id);
    expect(out).toEqual(["ai1", "py1", "ai2", "py2", "ai3"]);
  });

  it("ラウンド内は先頭の点数が高いグループ順", () => {
    const arts = [
      mk(5, "Python", "py"),
      mk(9, "LLM・大規模言語モデル", "ai"),
    ];
    // py のほうが先頭にあるが、点数の高い ai が先
    expect(balanceByGroup(arts).map((a) => a.id)).toEqual(["ai", "py"]);
  });

  it("1グループだけなら点数順を保つ", () => {
    const arts = [
      mk(9, "Python", "a"),
      mk(7, "Python", "b"),
      mk(5, "Python", "c"),
    ];
    expect(balanceByGroup(arts).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("記事を取りこぼさない", () => {
    const arts = [mk(5, null, "a"), mk(4, "Python", "b"), mk(3, "Go", "c")];
    expect(balanceByGroup(arts)).toHaveLength(3);
  });
});
