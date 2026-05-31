# リンクアウト化・画像・RSSソース拡張 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** noiseless を「全文スクレイプ廃止＝フィード提供分のみ使うリンクアウト型」に変え、朝1回更新・フィード提供画像のサムネ表示・RSSソース拡張を実装する。

**Architecture:** 既存の初回バッチ（`initial-batch.ts`）が既に採用している「本文取得せず `body_hint ?? title` で採点」方式を定時バッチ（`batch.ts`）にも適用する。RSS フェッチャーを新設し、フィードが配信した本文・画像だけを使う。フロントは記事カードをサムネ型に変え、RSS はフィード名をラベル表示する。

**Tech Stack:** TypeScript / Next.js 15 (App Router) / Supabase (PostgreSQL) / `jsdom`（RSS・Atom パース）/ `vitest`（TDD）/ Claude Haiku。

---

## 設計の出典

- スペック: `docs/superpowers/specs/2026-05-31-linkout-images-rss-design.md`
- 大本設計: `docs/superpowers/specs/2026-05-18-noiseless-design.md`

## ファイル構成（変更マップ）

```
.github/workflows/batch.yml          # [modify] 夜cron削除、朝1本に
supabase/migrations/
  20260531000001_articles_image_url.sql   # [create] articles.image_url 追加
scripts/lib/types.ts                 # [modify] RawEntry に image_url 追加
scripts/fetchers/rss.ts              # [create] RSS2.0 / Atom パーサ + fetch
scripts/fetchers/hatena.ts           # [modify] hatena:imageurl から画像抽出
scripts/batch.ts                     # [modify] リンクアウト化・rss対応・image保存
scripts/lib/initial-batch.ts         # [modify] rss対応・image保存
scripts/lib/readability.ts           # [delete] スクレイプ廃止
scripts/seed.ts                      # [modify] RSSソース登録
app/lib/articles.ts                  # [modify] image_url / source_name を引く
app/components/article-card.tsx      # [modify] サムネ型レイアウト・フィード名ラベル
tests/fetchers/rss.test.ts           # [create] RSSパーサのテスト
tests/fetchers/hatena.test.ts        # [modify] 画像抽出のテスト追加
```

各ファイルの責務:
- `rss.ts`: RSS2.0 / Atom を `RawEntry[]` に変換（純粋関数 `parseRssFeed`）＋ HTTP 取得 `fetchRss`
- `batch.ts` / `initial-batch.ts`: 収集 → 採点 → DB 書き込みの進行制御
- `articles.ts`: タイムライン用のデータ取得・整形
- `article-card.tsx`: 1記事の表示

---

## Task 1: 更新を朝1回だけにする

**Files:**
- Modify: `.github/workflows/batch.yml`

- [ ] **Step 1: 夜の cron 行を削除する**

`.github/workflows/batch.yml` の `schedule:` を次の内容に置き換える（朝6:00 JST の 1 本だけ残す）:

```yaml
on:
  schedule:
    # 06:00 JST = 21:00 UTC (前日)
    - cron: '0 21 * * *'
  workflow_dispatch:
```

- [ ] **Step 2: コミット**

```bash
git add .github/workflows/batch.yml
git commit -m "ci: run batch once in the morning only"
```

---

## Task 2: マイグレーション — articles.image_url 追加

**Files:**
- Create: `supabase/migrations/20260531000001_articles_image_url.sql`

- [ ] **Step 1: マイグレーション SQL を作成**

`supabase/migrations/20260531000001_articles_image_url.sql`:

```sql
alter table articles
  add column if not exists image_url text;
```

- [ ] **Step 2: Supabase ダッシュボードで SQL を実行**

> **手動アクション**: Supabase ダッシュボード → SQL Editor に上記 SQL を貼って実行。Table Editor で `articles` に `image_url` 列が増えたことを確認。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260531000001_articles_image_url.sql
git commit -m "feat: add image_url column to articles"
```

---

## Task 3: 型に image_url を追加

**Files:**
- Modify: `scripts/lib/types.ts`

- [ ] **Step 1: `RawEntry` に `image_url` を追加**

`scripts/lib/types.ts` の `RawEntry` を次のように変更（`body_hint` の下に1行追加）:

```typescript
// fetcher が返す生エントリ（DB保存前）
export interface RawEntry {
  source_id: string;
  url: string;
  title: string;
  raw_metadata: Record<string, unknown>;
  published_at: string | null;
  // 本文。RSS や arXiv は最初から content を持つことがある。
  body_hint?: string | null;
  // フィードが提供する画像URL（無ければ undefined）。スクレイプはしない。
  image_url?: string | null;
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（既存 fetcher は image_url 未設定でも optional なのでOK）。

- [ ] **Step 3: コミット**

```bash
git add scripts/lib/types.ts
git commit -m "feat: add optional image_url to RawEntry"
```

---

## Task 4: RSS フェッチャー（TDD）

**Files:**
- Create: `tests/fetchers/rss.test.ts`
- Create: `scripts/fetchers/rss.ts`

- [ ] **Step 1: テストを書く**

`tests/fetchers/rss.test.ts`:

```typescript
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- rss`
Expected: FAIL（`parseRssFeed` が未定義）。

- [ ] **Step 3: 実装する**

`scripts/fetchers/rss.ts`:

```typescript
import { JSDOM } from "jsdom";
import type { RawEntry } from "../lib/types";

// content:encoded などに含まれる HTML を素のテキストに落とし、長すぎる本文は切る。
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

// フィードが自ら提供する画像 URL を拾う（任意ページからのスクレイプはしない）。
function pickImage(item: Element): string | null {
  const enclosure = item.querySelector("enclosure");
  const encUrl = enclosure?.getAttribute("url");
  const encType = enclosure?.getAttribute("type") ?? "";
  if (encUrl && encType.startsWith("image")) return encUrl;

  const thumb = item.getElementsByTagName("media:thumbnail")[0];
  const thumbUrl = thumb?.getAttribute("url");
  if (thumbUrl) return thumbUrl;

  for (const mc of Array.from(item.getElementsByTagName("media:content"))) {
    const medium = mc.getAttribute("medium");
    const type = mc.getAttribute("type") ?? "";
    const u = mc.getAttribute("url");
    if (u && (medium === "image" || type.startsWith("image"))) return u;
  }
  return null;
}

export function parseRssFeed(
  xml: string,
  sourceId: string,
  limit = 15,
): RawEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;

  // RSS 2.0 / RDF: <item>
  const items = Array.from(doc.querySelectorAll("item"));
  if (items.length > 0) {
    return items.slice(0, limit).map((item): RawEntry => {
      const title = item.querySelector("title")?.textContent?.trim() ?? "";
      const url = item.querySelector("link")?.textContent?.trim() ?? "";
      const date =
        item.querySelector("pubDate")?.textContent?.trim() ??
        item.getElementsByTagName("dc:date")[0]?.textContent?.trim() ??
        null;
      const encoded = item.getElementsByTagName("content:encoded")[0]?.textContent?.trim();
      const description = item.querySelector("description")?.textContent?.trim() ?? "";
      const body = encoded && encoded.length > 0 ? encoded : description;
      return {
        source_id: sourceId,
        url,
        title,
        raw_metadata: {},
        published_at: date,
        body_hint: stripHtml(body),
        image_url: pickImage(item),
      };
    });
  }

  // Atom: <entry>
  const entries = Array.from(doc.querySelectorAll("entry"));
  return entries.slice(0, limit).map((entry): RawEntry => {
    const title = (entry.querySelector("title")?.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const url =
      entry.querySelector("link[rel='alternate']")?.getAttribute("href") ??
      entry.querySelector("link")?.getAttribute("href") ??
      "";
    const date =
      entry.querySelector("published")?.textContent?.trim() ??
      entry.querySelector("updated")?.textContent?.trim() ??
      null;
    const content = entry.querySelector("content")?.textContent?.trim();
    const summary = entry.querySelector("summary")?.textContent?.trim() ?? "";
    const body = content && content.length > 0 ? content : summary;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: {},
      published_at: date,
      body_hint: stripHtml(body),
      image_url: pickImage(entry),
    };
  });
}

export async function fetchRss(
  sourceId: string,
  url: string,
  limit = 15,
): Promise<RawEntry[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "noiseless/1.0 (https://noiseless-black.vercel.app)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`rss fetch failed (${url}): ${res.status}`);
  const xml = await res.text();
  return parseRssFeed(xml, sourceId, limit);
}
```

- [ ] **Step 4: テスト再実行**

Run: `npm test -- rss`
Expected: 全テスト pass。

- [ ] **Step 5: コミット**

```bash
git add tests/fetchers/rss.test.ts scripts/fetchers/rss.ts
git commit -m "feat: add RSS/Atom fetcher with feed-provided images"
```

---

## Task 5: はてブ fetcher に画像抽出を追加（TDD）

はてブの人気エントリー RSS は `<hatena:imageurl>` を持つことがある。あれば拾う。

**Files:**
- Modify: `tests/fetchers/hatena.test.ts`
- Modify: `scripts/fetchers/hatena.ts`

- [ ] **Step 1: テストに画像ケースを追加**

`tests/fetchers/hatena.test.ts` の既存サンプル RSS の1つ目の `<item>` 内に `<hatena:imageurl>` を加え、アサーションを追加する。具体的には、サンプル定義の1つ目 item を次のように差し替える（`<hatena:bookmarkcount>` の次の行に1行追加）:

```xml
    <hatena:bookmarkcount>123</hatena:bookmarkcount>
    <hatena:imageurl>https://example.com/hatena-a.jpg</hatena:imageurl>
```

そして `describe("parseHatenaRss", ...)` の中に次の it を追加:

```typescript
  it("hatena:imageurl があれば image_url に入れる", () => {
    const entries = parseHatenaRss(SAMPLE_RSS, "source-id-1");
    expect(entries[0].image_url).toBe("https://example.com/hatena-a.jpg");
    expect(entries[1].image_url).toBeNull();
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test -- hatena`
Expected: FAIL（`image_url` が undefined で、`toBeNull()` も満たさない）。

- [ ] **Step 3: 実装を更新**

`scripts/fetchers/hatena.ts` の `parseHatenaRss` の map 内を次のように変更（`bookmarkcount` 算出の直後に1行、return に1プロパティ追加）:

```typescript
    const bookmarkcount = bookmarkText ? Number(bookmarkText) : 0;
    const imageUrl =
      item.getElementsByTagName("hatena:imageurl")[0]?.textContent?.trim() ?? null;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: { bookmarkcount, description },
      published_at: date,
      body_hint: description,
      image_url: imageUrl,
    };
```

- [ ] **Step 4: テスト再実行**

Run: `npm test -- hatena`
Expected: 全テスト pass。

- [ ] **Step 5: コミット**

```bash
git add tests/fetchers/hatena.test.ts scripts/fetchers/hatena.ts
git commit -m "feat: extract feed image from hatena RSS"
```

---

## Task 6: 定時バッチをリンクアウト化＋RSS対応＋画像保存

スクレイプ（`extractBody`）をやめ、`buildScoringText`（= `body_hint ?? title`）で採点する。本文が無い記事も捨てない。

**Files:**
- Modify: `scripts/batch.ts`

- [ ] **Step 1: import を差し替える**

`scripts/batch.ts` の先頭の import を次のように変更（`extractBody` を消し、`fetchRss` と `buildScoringText` を追加）:

```typescript
import { supabase } from "./lib/supabase";
import { dedupeByUrl } from "./lib/dedup";
import { buildScoringText } from "./lib/initial-batch-utils";
import { scoreArticle } from "./lib/scoring";
import { fetchHatena } from "./fetchers/hatena";
import { fetchHackerNews } from "./fetchers/hackernews";
import { fetchArxiv, DEFAULT_ARXIV_CATEGORIES } from "./fetchers/arxiv";
import { fetchRss } from "./fetchers/rss";
import type {
  ArticleWithBody,
  RawEntry,
  ScoredArticle,
  SourceRow,
} from "./lib/types";
```

- [ ] **Step 2: `fetchAllSources` の switch に rss を追加**

`fetchAllSources` 内の switch、`case "arxiv":` ブロックの直後（`default:` の前）に追加:

```typescript
        case "rss":
          return await fetchRss(s.id, (s.config as { url: string }).url);
```

- [ ] **Step 3: `attachBody` をリンクアウト型に置き換える**

既存の `attachBody`（`extractBody` を呼ぶ async 関数）を、次の同期関数に丸ごと差し替える:

```typescript
// 本文スクレイプはしない。フィード提供分があればそれ、無ければタイトルで採点する。
function attachBody(entry: RawEntry): ArticleWithBody {
  return { ...entry, body_excerpt: buildScoringText(entry) };
}
```

- [ ] **Step 4: main の「本文取得」ループを置き換える**

`main` 内の「3. 本文取得 (失敗は捨てる)」のブロック（`const withBody: ArticleWithBody[] = []` から for ループまで）を次に差し替える:

```typescript
  // 3. 採点テキストを用意（本文スクレイプはしない。記事は捨てない）
  const withBody: ArticleWithBody[] = newEntries.map(attachBody);
  console.log(`${withBody.length} entries ready for scoring`);
```

- [ ] **Step 5: articles insert に image_url を追加**

`main` 内の「5. DB 書き込み」の `articles` insert オブジェクトに `image_url` を1行追加:

```typescript
      .insert({
        source_id: article.source_id,
        url: article.url,
        title: article.title,
        body_excerpt: article.body_excerpt,
        summary: article.scoring.summary,
        raw_metadata: article.raw_metadata,
        published_at: article.published_at,
        image_url: article.image_url ?? null,
      })
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 7: コミット**

```bash
git add scripts/batch.ts
git commit -m "feat: link-out batch (no scraping), rss source, save image_url"
```

---

## Task 7: 初回バッチに RSS 対応と画像保存を追加

**Files:**
- Modify: `scripts/lib/initial-batch.ts`

- [ ] **Step 1: import に fetchRss を追加**

`scripts/lib/initial-batch.ts` の fetcher import 群に1行追加:

```typescript
import { fetchRss } from "../fetchers/rss";
```

- [ ] **Step 2: `fetchAllSources` の switch に rss を追加**

`case "arxiv":` ブロックの直後（`default:` の前）に追加:

```typescript
        case "rss":
          return await fetchRss(s.id, (s.config as { url: string }).url);
```

- [ ] **Step 3: articles insert に image_url を追加**

`runInitialBatch` 内の `articles` insert オブジェクトに1行追加:

```typescript
      .insert({
        source_id: article.source_id,
        url: article.url,
        title: article.title,
        body_excerpt: article.body_excerpt,
        summary: article.scoring.summary,
        raw_metadata: article.raw_metadata,
        published_at: article.published_at,
        image_url: article.image_url ?? null,
      })
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/initial-batch.ts
git commit -m "feat: support rss source and image_url in initial batch"
```

---

## Task 8: readability（スクレイプ）を削除

**Files:**
- Delete: `scripts/lib/readability.ts`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: ファイルを削除**

```bash
git rm scripts/lib/readability.ts
```

- [ ] **Step 2: 未使用依存を削除**

```bash
npm uninstall @mozilla/readability
```

期待: `package.json` の dependencies から `@mozilla/readability` が消える（`jsdom` は残す。RSS・arXiv パーサで使用中）。

- [ ] **Step 3: 参照が残っていないか確認**

Run: `npx tsc --noEmit`
Expected: エラーなし（`extractBody` の参照は Task 6 で除去済み）。

- [ ] **Step 4: コミット**

```bash
git add scripts/lib/readability.ts package.json package-lock.json
git commit -m "chore: remove full-text scraper (readability) for link-out model"
```

---

## Task 9: seed に RSS ソースを登録

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: sources 配列に RSS フィードを追加**

`scripts/seed.ts` の `const sources = [ ... ]` を次に差し替える（既存3つ + 検証済み RSS）:

```typescript
  // 初期 sources
  const sources = [
    { user_id: user.id, kind: "hatena", config: {}, enabled: true },
    { user_id: user.id, kind: "hackernews", config: {}, enabled: true },
    { user_id: user.id, kind: "arxiv", config: { categories: ["cs.CY", "cs.AI"] }, enabled: true },
    // --- RSS（フィード提供分のみ使用）---
    { user_id: user.id, kind: "rss", config: { name: "GIGAZINE", url: "https://gigazine.net/news/rss_2.0/" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "Import AI", url: "https://importai.substack.com/feed" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "The Markup", url: "https://themarkup.org/feeds/rss.xml" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "AI as Normal Technology", url: "https://www.normaltech.ai/feed" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }, enabled: true },
  ];
```

- [ ] **Step 2: seed を実行**

Run: `npm run seed`
Expected: `12 sources inserted` と表示される。

- [ ] **Step 3: コミット**

```bash
git add scripts/seed.ts
git commit -m "feat: seed curated RSS sources"
```

---

## Task 10: フロントのデータ取得に image_url と source_name を追加

**Files:**
- Modify: `app/lib/articles.ts`

- [ ] **Step 1: `TimelineArticle` に2フィールド追加**

`TimelineArticle` インターフェースに追加:

```typescript
export interface TimelineArticle {
  id: string;
  url: string;
  title: string;
  title_ja: string | null;
  summary: string | null;
  score_reason: string | null;
  prompt_score: number;
  final_score: number;
  source_kind: string;
  source_name: string | null;
  image_url: string | null;
  raw_metadata: Record<string, unknown>;
  fetched_at: string;
  liked: boolean;
}
```

- [ ] **Step 2: `ArticleRow` 型を更新**

```typescript
type ArticleRow = {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  raw_metadata: Record<string, unknown> | null;
  fetched_at: string;
  source: { kind: string; config: Record<string, unknown> | null };
};
```

- [ ] **Step 3: select に image_url と config を追加**

`.select(...)` 内の article サブセレクトを次に変更（`summary,` の次に `image_url,` を、`source:sources!inner ( kind )` を `( kind, config )` に）:

```typescript
      article:articles!inner (
        id,
        url,
        title,
        summary,
        image_url,
        raw_metadata,
        fetched_at,
        source:sources!inner ( kind, config )
      )
```

- [ ] **Step 4: マッピングに2フィールドを追加**

`return (rows ?? []).map(...)` の中の返却オブジェクトに追加:

```typescript
    return {
      id: article.id,
      url: article.url,
      title: article.title,
      title_ja: (r as { title_ja: string | null }).title_ja,
      summary: article.summary,
      score_reason: r.score_reason,
      prompt_score: r.prompt_score,
      final_score: r.final_score,
      source_kind: article.source.kind,
      source_name:
        (article.source.config as { name?: string } | null)?.name ?? null,
      image_url: article.image_url,
      raw_metadata: article.raw_metadata ?? {},
      fetched_at: article.fetched_at,
      liked: likedIds.has(article.id),
    };
```

- [ ] **Step 5: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 6: コミット**

```bash
git add app/lib/articles.ts
git commit -m "feat: select image_url and source name for timeline"
```

---

## Task 11: 記事カードをサムネ型にし、RSS はフィード名を表示

**Files:**
- Modify: `app/components/article-card.tsx`

- [ ] **Step 1: カードを書き換える**

`app/components/article-card.tsx` を次の内容に差し替える:

```tsx
import { Card } from "@/components/ui/card";
import type { TimelineArticle } from "@/app/lib/articles";
import { relativeTime, sourceLabel } from "@/app/lib/article-utils";
import { LikeButton } from "./like-button";

export function ArticleCard({ article }: { article: TimelineArticle }) {
  // RSS はフィード名（GIGAZINE 等）、それ以外は種別ラベル
  const label = article.source_name ?? sourceLabel(article.source_kind);

  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">[{label}]</span>
        <span>{relativeTime(article.fetched_at)}</span>
      </div>

      <div className="flex gap-3">
        {article.image_url && (
          // フィードが提供する画像のみ。素の img でシンプルに。
          <img
            src={article.image_url}
            alt=""
            loading="lazy"
            className="w-20 h-20 shrink-0 rounded object-cover bg-muted"
          />
        )}

        <div className="flex flex-col gap-2 min-w-0">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-semibold leading-snug hover:underline"
          >
            {article.title_ja ?? article.title}
          </a>
          {article.title_ja && article.title_ja !== article.title && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              原題: {article.title}
            </p>
          )}

          {article.summary && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {article.summary}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <LikeButton articleId={article.id} initiallyLiked={article.liked} />
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:underline truncate max-w-[60%]"
        >
          {new URL(article.url).hostname}
        </a>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: 型チェックと lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: エラーなし（`<img>` に対する Next の警告が出る場合があるが、remotePatterns 回避のため意図的。lint がエラーで止まるなら該当行に `{/* eslint-disable-next-line @next/next/no-img-element */}` を直前に追加する）。

- [ ] **Step 3: コミット**

```bash
git add app/components/article-card.tsx
git commit -m "feat: thumbnail card layout and feed-name label"
```

---

## Task 12: 全体の動作確認

**Files:** （変更なし。検証のみ）

- [ ] **Step 1: 全テスト**

Run: `npm test`
Expected: 全 pass（rss・hatena・arxiv・hackernews・dedup・initial-batch-utils）。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし。

- [ ] **Step 3: バッチをローカル実行**

> **前提**: Task 2 のマイグレーションと Task 9 の seed が適用済みであること。

Run: `npm run batch`
Expected: `=== noiseless batch done ===` まで到達。途中で RSS 各フィードの取得ログが出る。あるソースの取得が失敗しても他は継続する（`fetch failed for rss:` が出ても停止しない）。

- [ ] **Step 4: Supabase で確認**

Supabase ダッシュボード → Table Editor → `articles`:
- RSS 由来の記事が入っている
- 一部の記事に `image_url` が入っている（GIGAZINE 等、画像提供フィード）
- `body_excerpt` にフィード提供のテキストが入っている（HN 由来はタイトルのみのことがある）

- [ ] **Step 5: 画面で確認**

Run: `npm run dev` → ブラウザで `http://localhost:3000`
- 画像のある記事は左サムネ付き、無い記事はテキストのみで表示される
- RSS 記事のラベルがフィード名（例: `[GIGAZINE]`）になっている

- [ ] **Step 6: コミット不要**（コード変更がなければ）

---

## 完了条件

1. `batch.yml` の cron が朝1本（`0 21 * * *`）だけ。
2. `scripts/fetchers/rss.ts` が追加され、RSS2.0 / Atom と画像を正しくパースする（テスト pass）。
3. `articles.image_url` が追加され、フィード提供画像のある記事に値が入る。
4. タイムラインのカードがサムネ型で、画像があれば表示・無ければテキストのみ。
5. RSS 記事のカードにフィード名が表示される。
6. `readability.ts`（全文スクレイプ）が削除され、本文はフィード提供分のみ使用。
7. `npm test` 全 pass、`npx tsc --noEmit` エラーなし。
```
