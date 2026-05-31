import { describe, it, expect } from "vitest";
import { parseRssFeed } from "../../scripts/fetchers/rss";

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>記事A</title>
      <link>https://example.com/a</link>
      <pubDate>Mon, 18 May 2026 06:00:00 +0900</pubDate>
      <description>短い説明A</description>
      <content:encoded><![CDATA[<p>本文Aの<strong>HTML</strong>付き全文。</p>]]></content:encoded>
      <enclosure url="https://example.com/a.jpg" type="image/jpeg" length="12345"/>
    </item>
    <item>
      <title>記事B</title>
      <link>https://example.com/b</link>
      <pubDate>Mon, 18 May 2026 05:00:00 +0900</pubDate>
      <description>説明Bのみ</description>
      <media:thumbnail url="https://example.com/b-thumb.png"/>
    </item>
    <item>
      <title>記事C</title>
      <link>https://example.com/c</link>
      <description>説明C</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom記事</title>
    <link href="https://example.com/atom1" rel="alternate" type="text/html"/>
    <published>2026-05-18T00:00:00Z</published>
    <summary>Atomのまとめ</summary>
    <content type="html">&lt;p&gt;Atom本文&lt;/p&gt;</content>
  </entry>
</feed>`;

describe("parseRssFeed (RSS 2.0)", () => {
  it("item からタイトル・URL・日付を抽出する", () => {
    const entries = parseRssFeed(RSS2, "src-rss");
    expect(entries).toHaveLength(3);
    expect(entries[0].title).toBe("記事A");
    expect(entries[0].url).toBe("https://example.com/a");
    expect(entries[0].published_at).toContain("2026");
    expect(entries.every((e) => e.source_id === "src-rss")).toBe(true);
  });

  it("content:encoded があれば本文に使い、HTMLタグは除去する", () => {
    const entries = parseRssFeed(RSS2, "src-rss");
    expect(entries[0].body_hint).toContain("本文A");
    expect(entries[0].body_hint).not.toContain("<");
  });

  it("content:encoded が無ければ description を本文に使う", () => {
    const entries = parseRssFeed(RSS2, "src-rss");
    expect(entries[1].body_hint).toBe("説明Bのみ");
  });

  it("enclosure(image) と media:thumbnail から画像を拾う", () => {
    const entries = parseRssFeed(RSS2, "src-rss");
    expect(entries[0].image_url).toBe("https://example.com/a.jpg");
    expect(entries[1].image_url).toBe("https://example.com/b-thumb.png");
  });

  it("画像が無ければ image_url は null", () => {
    const entries = parseRssFeed(RSS2, "src-rss");
    expect(entries[2].image_url).toBeNull();
  });

  it("limit で件数を絞る", () => {
    const entries = parseRssFeed(RSS2, "src-rss", 2);
    expect(entries).toHaveLength(2);
  });
});

describe("parseRssFeed (Atom)", () => {
  it("entry からタイトル・URL・本文を抽出する", () => {
    const entries = parseRssFeed(ATOM, "src-atom");
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("Atom記事");
    expect(entries[0].url).toBe("https://example.com/atom1");
    expect(entries[0].body_hint).toContain("Atom本文");
    expect(entries[0].body_hint).not.toContain("<");
  });
});

describe("parseRssFeed (本文HTMLからの画像)", () => {
  const FEED_WITH_BODY_IMG = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>本文に画像</title>
      <link>https://example.com/x</link>
      <description><![CDATA[<p>説明文 <img src="https://example.com/in-body.jpg" alt="x"> 続き</p>]]></description>
    </item>
  </channel>
</rss>`;

  it("専用タグが無ければ本文の最初の<img>を image_url に使う", () => {
    const entries = parseRssFeed(FEED_WITH_BODY_IMG, "src");
    expect(entries[0].image_url).toBe("https://example.com/in-body.jpg");
  });
});
