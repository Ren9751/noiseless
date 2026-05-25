import { describe, it, expect } from "vitest";
import { parseArxivAtom } from "../../scripts/fetchers/arxiv";

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2605.00001v1</id>
    <title>A study on social impact of AI</title>
    <summary>This paper investigates the social impact of AI.</summary>
    <published>2026-05-01T00:00:00Z</published>
    <link href="http://arxiv.org/abs/2605.00001v1" rel="alternate" type="text/html"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2605.00002v1</id>
    <title>Privacy preserving recommendation systems</title>
    <summary>We propose a privacy-preserving recommendation framework.</summary>
    <published>2026-05-02T00:00:00Z</published>
    <link href="http://arxiv.org/abs/2605.00002v1" rel="alternate" type="text/html"/>
  </entry>
</feed>`;

describe("parseArxivAtom", () => {
  it("Atom フィードから論文情報を抽出する", () => {
    const entries = parseArxivAtom(SAMPLE_ATOM, "src-arxiv");
    expect(entries).toHaveLength(2);
    expect(entries[0].title).toBe("A study on social impact of AI");
    expect(entries[0].url).toBe("http://arxiv.org/abs/2605.00001v1");
    expect(entries[0].body_hint).toContain("social impact");
  });
});
