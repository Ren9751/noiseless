import { describe, it, expect } from "vitest";
import { parseHatenaRss } from "../../scripts/fetchers/hatena";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns="http://purl.org/rss/1.0/"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:hatena="http://www.hatena.ne.jp/info/xmlns#">
  <item rdf:about="https://example.com/article1">
    <title>テスト記事1</title>
    <link>https://example.com/article1</link>
    <description>記事の説明文</description>
    <dc:date>2026-05-18T06:00:00+09:00</dc:date>
    <hatena:bookmarkcount>123</hatena:bookmarkcount>
  </item>
  <item rdf:about="https://example.com/article2">
    <title>テスト記事2</title>
    <link>https://example.com/article2</link>
    <description>記事の説明文2</description>
    <dc:date>2026-05-18T05:00:00+09:00</dc:date>
    <hatena:bookmarkcount>45</hatena:bookmarkcount>
  </item>
</rdf:RDF>`;

describe("parseHatenaRss", () => {
  it("RSS から記事を抽出する", () => {
    const entries = parseHatenaRss(SAMPLE_RSS, "source-id-1");
    expect(entries).toHaveLength(2);
    expect(entries[0].url).toBe("https://example.com/article1");
    expect(entries[0].title).toBe("テスト記事1");
    expect(entries[0].raw_metadata.bookmarkcount).toBe(123);
    expect(entries[0].published_at).toContain("2026-05-18");
  });

  it("source_id を全エントリに付ける", () => {
    const entries = parseHatenaRss(SAMPLE_RSS, "src-X");
    expect(entries.every((e) => e.source_id === "src-X")).toBe(true);
  });
});
