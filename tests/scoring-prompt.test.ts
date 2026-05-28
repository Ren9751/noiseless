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
});
