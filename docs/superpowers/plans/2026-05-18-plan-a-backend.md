# noiseless Plan A: バックエンド基盤 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** バッチ処理（記事収集・本文取得・LLM スコアリング・DB 書き込み）を GitHub Actions で定期実行し、Supabase に記事が溜まる状態を作る。

**Architecture:** Next.js プロジェクトとして scaffold し、`scripts/` 配下にバッチ処理ロジックを置く。バッチは `tsx` で TypeScript を直接実行。Supabase は PostgreSQL に `pgvector` 拡張を加えた構成。GitHub Actions が cron でバッチを呼び出し、結果を Supabase に書き込む。

**Tech Stack:**
- TypeScript 5.x
- Next.js 15 (App Router)
- Supabase (PostgreSQL + pgvector)
- `@supabase/supabase-js`
- `@mozilla/readability` + `jsdom`
- `@anthropic-ai/sdk` (Claude Haiku)
- `vitest` (テスト)
- `tsx` (TS 直接実行)
- `zod` (構造化出力スキーマ)

---

## ファイル構成（Plan A 完了時）

```
noiseless/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.mjs
├── .env.example
├── .env.local            (git ignored)
├── .gitignore
├── README.md
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260518000001_users_and_profile.sql
│       ├── 20260518000002_sources.sql
│       ├── 20260518000003_articles.sql
│       └── 20260518000004_scores_and_likes.sql
├── scripts/
│   ├── batch.ts                    # エントリポイント
│   ├── seed.ts                     # 初期データ投入
│   ├── lib/
│   │   ├── types.ts
│   │   ├── supabase.ts
│   │   ├── readability.ts
│   │   ├── scoring.ts
│   │   ├── llm.ts
│   │   └── dedup.ts
│   └── fetchers/
│       ├── hatena.ts
│       ├── hackernews.ts
│       └── arxiv.ts
├── tests/
│   ├── fetchers/
│   │   ├── hatena.test.ts
│   │   ├── hackernews.test.ts
│   │   └── arxiv.test.ts
│   └── lib/
│       └── dedup.test.ts
└── .github/
    └── workflows/
        └── batch.yml
```

各ファイルの責務:
- `scripts/batch.ts`: バッチ全体の進行制御
- `scripts/fetchers/*`: 各ソース固有の取得・パース
- `scripts/lib/readability.ts`: 本文抽出
- `scripts/lib/scoring.ts`: Claude Haiku でのスコアリング・要約生成
- `scripts/lib/dedup.ts`: URL ベースの重複排除（ピュア関数）
- `scripts/lib/types.ts`: 共通型（Article, Source, ScoredArticle など）
- `scripts/lib/supabase.ts`: Supabase クライアント生成
- `supabase/migrations/*`: スキーマ定義

---

## Task 1: Next.js プロジェクトの初期化

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.gitignore`

- [ ] **Step 1: Next.js プロジェクトを scaffold する**

プロジェクトディレクトリに移動した状態で（既存の `docs/` フォルダがあるため `--use-npm` 必要）:

```bash
cd "C:/Users/renki/OneDrive/Desktop/Project/noiseless"
npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir=false --import-alias="@/*" --no-turbopack --use-npm
```

プロンプトが出たら全て Enter（デフォルト採用）。既存ファイルがある場合は「Continue?」に Y。

期待: `package.json`, `tsconfig.json`, `next.config.mjs`, `app/`, `public/` などが作成される。

- [ ] **Step 2: 既存の docs フォルダが残っていることを確認**

```bash
ls docs/superpowers/specs/
```

期待: `2026-05-18-noiseless-design.md` が表示される。

- [ ] **Step 3: .gitignore に追加**

`.gitignore` の末尾に以下を追加:

```
# Environment
.env.local
.env*.local

# Supabase
supabase/.branches
supabase/.temp

# Test coverage
coverage/
```

- [ ] **Step 4: コミット**

```bash
git add .
git commit -m "chore: scaffold Next.js project"
```

---

## Task 2: バッチ用の依存パッケージをインストール

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 依存パッケージをインストール**

```bash
npm install @supabase/supabase-js @anthropic-ai/sdk @mozilla/readability jsdom zod
npm install -D tsx vitest @types/jsdom dotenv
```

- [ ] **Step 2: package.json の scripts セクションを編集**

`package.json` の `"scripts"` を次のように差し替える:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "batch": "tsx --env-file=.env.local scripts/batch.ts",
  "seed": "tsx --env-file=.env.local scripts/seed.ts",
  "test": "vitest run"
}
```

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: install batch dependencies"
```

---

## Task 3: Vitest の設定

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: `vitest.config.ts` を作成**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 2: 動作確認用に空の test を作る**

`tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: テストを実行**

```bash
npm test
```

期待: `1 passed` と表示される。

- [ ] **Step 4: コミット**

```bash
git add vitest.config.ts tests/smoke.test.ts
git commit -m "chore: setup vitest"
```

---

## Task 4: 環境変数テンプレートと Supabase クライアント

**Files:**
- Create: `.env.example`, `.env.local`, `scripts/lib/supabase.ts`

- [ ] **Step 1: `.env.example` を作成**

```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-key

# Reddit (optional, Phase 3 で使用)
# REDDIT_CLIENT_ID=
# REDDIT_CLIENT_SECRET=
```

- [ ] **Step 2: `.env.local` を作成**（手元で値を埋める。実際の値は Supabase プロジェクトを作ってから）

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

> **手動アクション**: Supabase 公式サイト (https://supabase.com) で新規プロジェクトを作成し、URL と Service Role Key を `.env.local` に貼り付ける。Anthropic Console (https://console.anthropic.com) で API キーを取得して貼り付ける。

- [ ] **Step 3: `scripts/lib/supabase.ts` を作成**

```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
```

- [ ] **Step 4: コミット**

```bash
git add .env.example scripts/lib/supabase.ts
git commit -m "feat: add supabase client and env template"
```

---

## Task 5: マイグレーション 1 — users と user_profile

**Files:**
- Create: `supabase/migrations/20260518000001_users_and_profile.sql`

- [ ] **Step 1: マイグレーション SQL を作成**

```sql
-- 拡張機能の有効化
create extension if not exists "uuid-ossp";

-- users テーブル
create table users (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- user_profile テーブル
create table user_profile (
  user_id uuid primary key references users(id) on delete cascade,
  interests jsonb not null default '[]'::jsonb,
  special_rules text not null default '',
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Supabase ダッシュボードで SQL を実行**

> **手動アクション**: Supabase ダッシュボード → SQL Editor で上記 SQL をペーストして実行。

確認: `users` と `user_profile` テーブルが Table Editor に表示される。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260518000001_users_and_profile.sql
git commit -m "feat: add users and user_profile schema"
```

---

## Task 6: マイグレーション 2 — sources

**Files:**
- Create: `supabase/migrations/20260518000002_sources.sql`

- [ ] **Step 1: マイグレーション SQL を作成**

```sql
create table sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('hatena', 'hackernews', 'reddit', 'rss', 'arxiv')),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index sources_user_id_enabled_idx on sources(user_id, enabled);
```

- [ ] **Step 2: Supabase ダッシュボードで SQL を実行**

> **手動アクション**: SQL Editor で実行。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260518000002_sources.sql
git commit -m "feat: add sources schema"
```

---

## Task 7: マイグレーション 3 — articles（pgvector 含む）

**Files:**
- Create: `supabase/migrations/20260518000003_articles.sql`

- [ ] **Step 1: マイグレーション SQL を作成**

```sql
-- pgvector 拡張の有効化（Phase 2 で使用、Phase 1 では NULL のままにしておく）
create extension if not exists "vector";

create table articles (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references sources(id) on delete cascade,
  url text not null unique,
  title text not null,
  title_ja text,
  body_excerpt text,
  summary text,
  raw_metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  embedding vector(1024)
);

create index articles_fetched_at_idx on articles(fetched_at desc);
create index articles_source_id_idx on articles(source_id);
```

- [ ] **Step 2: Supabase ダッシュボードで SQL を実行**

> **手動アクション**: SQL Editor で実行。pgvector 拡張が有効化されることを確認。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260518000003_articles.sql
git commit -m "feat: add articles schema with pgvector"
```

---

## Task 8: マイグレーション 4 — article_scores と likes

**Files:**
- Create: `supabase/migrations/20260518000004_scores_and_likes.sql`

- [ ] **Step 1: マイグレーション SQL を作成**

```sql
create table article_scores (
  article_id uuid not null references articles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  prompt_score int not null check (prompt_score between 0 and 10),
  similarity_score float not null default 0,
  final_score float not null,
  score_reason text,
  is_serendipity boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create index article_scores_user_final_idx on article_scores(user_id, final_score desc);

create table likes (
  user_id uuid not null references users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index likes_user_created_idx on likes(user_id, created_at desc);
```

- [ ] **Step 2: Supabase ダッシュボードで SQL を実行**

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260518000004_scores_and_likes.sql
git commit -m "feat: add article_scores and likes schema"
```

---

## Task 9: 共通型定義

**Files:**
- Create: `scripts/lib/types.ts`

- [ ] **Step 1: 型定義を作成**

```typescript
export type SourceKind = "hatena" | "hackernews" | "reddit" | "rss" | "arxiv";

export interface SourceRow {
  id: string;
  user_id: string;
  kind: SourceKind;
  config: Record<string, unknown>;
  enabled: boolean;
}

// fetcher が返す生エントリ（DB保存前）
export interface RawEntry {
  source_id: string;
  url: string;
  title: string;
  raw_metadata: Record<string, unknown>;
  published_at: string | null;
  // 本文。RSS や arXiv は最初から content を持つことがある。
  body_hint?: string | null;
}

// 本文抽出後
export interface ArticleWithBody extends RawEntry {
  body_excerpt: string;
}

// スコアリング結果
export interface ScoringResult {
  prompt_score: number;
  summary: string;
  score_reason: string;
}

// DB 書き込み用にまとめた最終形
export interface ScoredArticle extends ArticleWithBody {
  scoring: ScoringResult;
}
```

- [ ] **Step 2: コミット**

```bash
git add scripts/lib/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 10: 重複排除関数（TDD）

**Files:**
- Create: `tests/lib/dedup.test.ts`, `scripts/lib/dedup.ts`

- [ ] **Step 1: テストを書く**

`tests/lib/dedup.test.ts`:

```typescript
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npm test
```

期待: `dedupeByUrl` が未定義で失敗。

- [ ] **Step 3: 実装する**

`scripts/lib/dedup.ts`:

```typescript
import type { RawEntry } from "./types";

export function dedupeByUrl(entries: RawEntry[]): RawEntry[] {
  const seen = new Set<string>();
  const result: RawEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    result.push(entry);
  }
  return result;
}
```

- [ ] **Step 4: テスト再実行**

```bash
npm test
```

期待: 3 件すべて pass。

- [ ] **Step 5: コミット**

```bash
git add tests/lib/dedup.test.ts scripts/lib/dedup.ts
git commit -m "feat: add URL-based dedup function"
```

---

## Task 11: はてブ fetcher（TDD：パース部分のみ）

**Files:**
- Create: `tests/fetchers/hatena.test.ts`, `scripts/fetchers/hatena.ts`

はてブの「人気エントリー」は RSS で取得できる（`https://b.hatena.ne.jp/hotentry.rss`）。RSS のパースをテストする。

- [ ] **Step 1: テストを書く**

`tests/fetchers/hatena.test.ts`:

```typescript
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
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test
```

期待: `parseHatenaRss` が未定義で失敗。

- [ ] **Step 3: 実装**

`scripts/fetchers/hatena.ts`:

```typescript
import { JSDOM } from "jsdom";
import type { RawEntry } from "../lib/types";

export function parseHatenaRss(xml: string, sourceId: string): RawEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const items = Array.from(doc.querySelectorAll("item"));
  return items.map((item): RawEntry => {
    const url = item.querySelector("link")?.textContent?.trim() ?? "";
    const title = item.querySelector("title")?.textContent?.trim() ?? "";
    const description = item.querySelector("description")?.textContent?.trim() ?? "";
    const date = item.getElementsByTagName("dc:date")[0]?.textContent?.trim() ?? null;
    const bookmarkText = item.getElementsByTagName("hatena:bookmarkcount")[0]?.textContent?.trim();
    const bookmarkcount = bookmarkText ? Number(bookmarkText) : 0;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: { bookmarkcount, description },
      published_at: date,
      body_hint: description,
    };
  });
}

export async function fetchHatena(sourceId: string): Promise<RawEntry[]> {
  const res = await fetch("https://b.hatena.ne.jp/hotentry.rss");
  if (!res.ok) throw new Error(`hatena fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseHatenaRss(xml, sourceId);
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
npm test
```

期待: パース系のテストが pass。

- [ ] **Step 5: コミット**

```bash
git add tests/fetchers/hatena.test.ts scripts/fetchers/hatena.ts
git commit -m "feat: add hatena fetcher"
```

---

## Task 12: HN fetcher（TDD：パース部分のみ）

**Files:**
- Create: `tests/fetchers/hackernews.test.ts`, `scripts/fetchers/hackernews.ts`

HN は Algolia API (`https://hn.algolia.com/api/v1/search?tags=front_page`) を使う。JSON が返ってくるので、JSON → RawEntry の変換をテスト。

- [ ] **Step 1: テストを書く**

`tests/fetchers/hackernews.test.ts`:

```typescript
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
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test
```

期待: `parseAlgoliaResponse` が未定義で失敗。

- [ ] **Step 3: 実装**

`scripts/fetchers/hackernews.ts`:

```typescript
import type { RawEntry } from "../lib/types";

interface AlgoliaHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

export function parseAlgoliaResponse(json: AlgoliaResponse, sourceId: string): RawEntry[] {
  return json.hits
    .filter((hit) => hit.url !== null && hit.url !== "")
    .map((hit): RawEntry => ({
      source_id: sourceId,
      url: hit.url as string,
      title: hit.title,
      raw_metadata: {
        points: hit.points,
        num_comments: hit.num_comments,
        hn_id: hit.objectID,
      },
      published_at: hit.created_at,
    }));
}

export async function fetchHackerNews(sourceId: string): Promise<RawEntry[]> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50",
  );
  if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`);
  const json = (await res.json()) as AlgoliaResponse;
  return parseAlgoliaResponse(json, sourceId);
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
npm test
```

- [ ] **Step 5: コミット**

```bash
git add tests/fetchers/hackernews.test.ts scripts/fetchers/hackernews.ts
git commit -m "feat: add hackernews fetcher"
```

---

## Task 13: arXiv fetcher（TDD：パース部分のみ）

**Files:**
- Create: `tests/fetchers/arxiv.test.ts`, `scripts/fetchers/arxiv.ts`

arXiv API は Atom フィードを返す。`https://export.arxiv.org/api/query?search_query=cat:cs.CY&sortBy=submittedDate&sortOrder=descending&max_results=30`

- [ ] **Step 1: テストを書く**

`tests/fetchers/arxiv.test.ts`:

```typescript
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
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test
```

- [ ] **Step 3: 実装**

`scripts/fetchers/arxiv.ts`:

```typescript
import { JSDOM } from "jsdom";
import type { RawEntry } from "../lib/types";

export function parseArxivAtom(xml: string, sourceId: string): RawEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const entries = Array.from(doc.querySelectorAll("entry"));
  return entries.map((entry): RawEntry => {
    const title = (entry.querySelector("title")?.textContent ?? "").trim().replace(/\s+/g, " ");
    const summary = (entry.querySelector("summary")?.textContent ?? "").trim().replace(/\s+/g, " ");
    const url = entry.querySelector("link[rel='alternate']")?.getAttribute("href") ?? "";
    const published = entry.querySelector("published")?.textContent?.trim() ?? null;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: {},
      published_at: published,
      body_hint: summary,
    };
  });
}

export async function fetchArxiv(sourceId: string, category: string): Promise<RawEntry[]> {
  const url = `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(
    category,
  )}&sortBy=submittedDate&sortOrder=descending&max_results=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arxiv fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseArxivAtom(xml, sourceId);
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
npm test
```

- [ ] **Step 5: コミット**

```bash
git add tests/fetchers/arxiv.test.ts scripts/fetchers/arxiv.ts
git commit -m "feat: add arxiv fetcher"
```

---

## Task 14: 本文抽出（Readability）

**Files:**
- Create: `scripts/lib/readability.ts`

外部ページを取って Readability で抽出。テストは I/O が絡むのでスキップし、ローカル実行で確認する。

- [ ] **Step 1: 実装**

`scripts/lib/readability.ts`:

```typescript
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const MAX_LENGTH = 4000;

export async function extractBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; noiseless/0.1; +https://github.com/) ",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent) return null;
    const text = article.textContent.replace(/\s+/g, " ").trim();
    return text.slice(0, MAX_LENGTH);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: ローカルで手動確認**

`tmp/check-readability.ts` を一時的に作って試す:

```typescript
import { extractBody } from "../scripts/lib/readability";

async function main() {
  const url = "https://b.hatena.ne.jp/hotentry/it";
  const body = await extractBody(url);
  console.log("length:", body?.length);
  console.log("preview:", body?.slice(0, 200));
}

main();
```

実行:

```bash
npx tsx tmp/check-readability.ts
```

期待: 200 文字程度のプレビューが表示される。

- [ ] **Step 3: 確認後、tmp を削除**

```bash
rm -rf tmp/
```

- [ ] **Step 4: コミット**

```bash
git add scripts/lib/readability.ts
git commit -m "feat: add readability body extractor"
```

---

## Task 15: Anthropic クライアントと LLM ラッパー

**Files:**
- Create: `scripts/lib/llm.ts`

- [ ] **Step 1: 実装**

`scripts/lib/llm.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY must be set");
}

export const anthropic = new Anthropic({ apiKey });

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
```

- [ ] **Step 2: コミット**

```bash
git add scripts/lib/llm.ts
git commit -m "feat: add anthropic client wrapper"
```

---

## Task 16: スコアリング関数（構造化出力）

**Files:**
- Create: `scripts/lib/scoring.ts`

- [ ] **Step 1: 実装**

`scripts/lib/scoring.ts`:

```typescript
import { z } from "zod";
import { anthropic, HAIKU_MODEL } from "./llm";
import type { ArticleWithBody, ScoringResult } from "./types";

const SCORING_SCHEMA = z.object({
  prompt_score: z.number().int().min(1).max(10),
  summary: z.string(),
  score_reason: z.string(),
});

interface UserProfile {
  interests: Array<{ topic: string; weight: number }>;
  special_rules: string;
}

function buildPrompt(profile: UserProfile): string {
  const interestsList = profile.interests
    .map((i) => `- ${i.topic} (重要度 ${i.weight}/10)`)
    .join("\n");

  return `あなたは「自分専用ニュースタイムライン」のキュレーターです。
記事を以下のユーザープロフィールに照らしてスコアリングし、X (旧Twitter) の投稿1個分の本文を生成してください。

## ユーザーの興味分野
${interestsList}

## 特別ルール
${profile.special_rules || "（なし）"}

## スコアリング基準
- 興味分野の重要度を基礎スコアとする (1-10)
- 内容が薄い速報は -1
- 複数の興味分野にまたがる記事は +1
- 全く関係ない内容は 1-3

## X風本文 (summary) の要件
- 140〜280字
- タイトルの言い換えではなく、内容を踏まえた本文にする
- 結論／面白いポイント／読む価値 のいずれかが伝わる
- 主張・データ・論点を含める
- 絵文字・誇張・煽りは禁止
- 体言止め・断定はOK
- 日本語

## score_reason の要件
- なぜそのスコアか、20〜40字で簡潔に

## 出力形式（JSON）
{
  "prompt_score": 数値,
  "summary": "X風本文",
  "score_reason": "短い理由"
}`;
}

export async function scoreArticle(
  article: ArticleWithBody,
  profile: UserProfile,
): Promise<ScoringResult> {
  const userMessage = `タイトル: ${article.title}\n\n本文抜粋:\n${article.body_excerpt}`;

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: buildPrompt(profile),
    messages: [{ role: "user", content: userMessage }],
  });

  // assistant の応答テキストを取り出す
  const content = response.content[0];
  if (content.type !== "text") throw new Error("unexpected response type");
  const text = content.text;

  // JSON ブロックを抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("no JSON in response: " + text);

  const parsed = JSON.parse(jsonMatch[0]);
  return SCORING_SCHEMA.parse(parsed);
}
```

- [ ] **Step 2: コミット**

```bash
git add scripts/lib/scoring.ts
git commit -m "feat: add LLM scoring function"
```

---

## Task 17: シードデータスクリプト

**Files:**
- Create: `scripts/seed.ts`

固定ユーザーと初期 user_profile、初期 sources を投入する。

- [ ] **Step 1: 実装**

`scripts/seed.ts`:

```typescript
import { supabase } from "./lib/supabase";

async function main() {
  // 固定ユーザーを upsert
  const { data: user, error: userError } = await supabase
    .from("users")
    .upsert({ id: "00000000-0000-0000-0000-000000000001", display_name: "Me" })
    .select()
    .single();
  if (userError) throw userError;
  console.log("user:", user);

  // user_profile を upsert
  const interests = [
    { topic: "AI/LLM", weight: 10 },
    { topic: "Claude / Anthropic", weight: 10 },
    { topic: "プログラミング (Python, Web)", weight: 9 },
    { topic: "AI Safety", weight: 9 },
    { topic: "民主主義とテクノロジー", weight: 9 },
    { topic: "オープンソース", weight: 8 },
    { topic: "発達障害・特性", weight: 7 },
    { topic: "CS基礎 (アルゴリズム、数学)", weight: 7 },
    { topic: "セキュリティ", weight: 7 },
    { topic: "投資・金融", weight: 5 },
  ];
  const specialRules =
    "Claude Code に関する記事は必ずスコア 9 以上にする。芸能・エンタメ系のゴシップはスコア 1 にする。";

  const { error: profileError } = await supabase
    .from("user_profile")
    .upsert({
      user_id: user.id,
      interests,
      special_rules: specialRules,
    });
  if (profileError) throw profileError;
  console.log("profile updated");

  // 初期 sources
  const sources = [
    { user_id: user.id, kind: "hatena", config: {}, enabled: true },
    { user_id: user.id, kind: "hackernews", config: {}, enabled: true },
    { user_id: user.id, kind: "arxiv", config: { category: "cs.CY" }, enabled: true },
  ];
  // 既存と重複しないよう、kind 単位で upsert する代わりに、まず削除して入れ直す
  await supabase.from("sources").delete().eq("user_id", user.id);
  const { error: sourceError } = await supabase.from("sources").insert(sources);
  if (sourceError) throw sourceError;
  console.log(`${sources.length} sources inserted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: シード実行**

```bash
npm run seed
```

期待:
- `user: { id: '00000000-...', display_name: 'Me', ... }`
- `profile updated`
- `3 sources inserted`

確認: Supabase ダッシュボード Table Editor で `users`, `user_profile`, `sources` テーブルにデータが入っている。

- [ ] **Step 3: コミット**

```bash
git add scripts/seed.ts
git commit -m "feat: add seed script"
```

---

## Task 18: バッチエントリポイント

**Files:**
- Create: `scripts/batch.ts`

全てを呼び出す統合スクリプト。

- [ ] **Step 1: 実装**

`scripts/batch.ts`:

```typescript
import { supabase } from "./lib/supabase";
import { dedupeByUrl } from "./lib/dedup";
import { extractBody } from "./lib/readability";
import { scoreArticle } from "./lib/scoring";
import { fetchHatena } from "./fetchers/hatena";
import { fetchHackerNews } from "./fetchers/hackernews";
import { fetchArxiv } from "./fetchers/arxiv";
import type {
  ArticleWithBody,
  RawEntry,
  ScoredArticle,
  SourceRow,
} from "./lib/types";

const SCORE_THRESHOLD = 6;

async function fetchAllSources(sources: SourceRow[]): Promise<RawEntry[]> {
  const tasks = sources.map(async (s) => {
    try {
      switch (s.kind) {
        case "hatena":
          return await fetchHatena(s.id);
        case "hackernews":
          return await fetchHackerNews(s.id);
        case "arxiv":
          return await fetchArxiv(
            s.id,
            (s.config as { category: string }).category ?? "cs.CY",
          );
        default:
          console.warn(`unsupported source kind: ${s.kind}`);
          return [];
      }
    } catch (e) {
      console.error(`fetch failed for ${s.kind}:`, e);
      return [];
    }
  });
  const results = await Promise.all(tasks);
  return results.flat();
}

async function filterNewEntries(entries: RawEntry[]): Promise<RawEntry[]> {
  if (entries.length === 0) return [];
  const urls = entries.map((e) => e.url);
  const { data } = await supabase.from("articles").select("url").in("url", urls);
  const existing = new Set((data ?? []).map((r) => r.url));
  return entries.filter((e) => !existing.has(e.url));
}

async function attachBody(entry: RawEntry): Promise<ArticleWithBody | null> {
  // body_hint があるソース (arxiv, RSS) はそれを優先
  if (entry.body_hint && entry.body_hint.length > 200) {
    return { ...entry, body_excerpt: entry.body_hint };
  }
  const body = await extractBody(entry.url);
  if (!body) return null;
  return { ...entry, body_excerpt: body };
}

async function main() {
  console.log("=== noiseless batch start ===");

  // 1. user と source を取得 (固定ユーザー)
  const userId = "00000000-0000-0000-0000-000000000001";
  const { data: profile, error: profErr } = await supabase
    .from("user_profile")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (profErr) throw profErr;

  const { data: sources, error: srcErr } = await supabase
    .from("sources")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (srcErr) throw srcErr;

  console.log(`profile loaded. ${sources!.length} sources enabled.`);

  // 2. 並列取得 + 重複排除 + 既存URL除外
  const rawEntries = await fetchAllSources(sources as SourceRow[]);
  console.log(`fetched ${rawEntries.length} raw entries`);
  const deduped = dedupeByUrl(rawEntries);
  const newEntries = await filterNewEntries(deduped);
  console.log(`${newEntries.length} new entries after dedup`);

  // 3. 本文取得 (失敗は捨てる)
  const withBody: ArticleWithBody[] = [];
  for (const entry of newEntries) {
    const enriched = await attachBody(entry);
    if (enriched) withBody.push(enriched);
  }
  console.log(`${withBody.length} entries with body`);

  // 4. スコアリング (閾値未満は捨てる)
  const scored: ScoredArticle[] = [];
  for (const entry of withBody) {
    try {
      const scoring = await scoreArticle(entry, {
        interests: profile.interests,
        special_rules: profile.special_rules,
      });
      if (scoring.prompt_score >= SCORE_THRESHOLD) {
        scored.push({ ...entry, scoring });
      }
    } catch (e) {
      console.error(`scoring failed for ${entry.url}:`, e);
    }
  }
  console.log(`${scored.length} entries scored above threshold`);

  // 5. DB 書き込み (articles を upsert、article_scores を insert)
  for (const article of scored) {
    const { data: inserted, error: insErr } = await supabase
      .from("articles")
      .insert({
        source_id: article.source_id,
        url: article.url,
        title: article.title,
        body_excerpt: article.body_excerpt,
        summary: article.scoring.summary,
        raw_metadata: article.raw_metadata,
        published_at: article.published_at,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error(`article insert failed: ${article.url}`, insErr);
      continue;
    }
    const { error: scoreErr } = await supabase.from("article_scores").insert({
      article_id: inserted.id,
      user_id: userId,
      prompt_score: article.scoring.prompt_score,
      similarity_score: 0,
      final_score: article.scoring.prompt_score,
      score_reason: article.scoring.score_reason,
      is_serendipity: false,
    });
    if (scoreErr) {
      console.error(`score insert failed: ${article.url}`, scoreErr);
    }
  }

  console.log("=== noiseless batch done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: コミット**

```bash
git add scripts/batch.ts
git commit -m "feat: add batch entrypoint"
```

---

## Task 19: ローカル実行と動作確認

外部 API への実呼び出しを伴うので、慎重に。

- [ ] **Step 1: バッチを実行**

```bash
npm run batch
```

期待される出力例:

```
=== noiseless batch start ===
profile loaded. 3 sources enabled.
fetched 80 raw entries
65 new entries after dedup
40 entries with body
12 entries scored above threshold
=== noiseless batch done ===
```

数字は実際の取得結果による。

- [ ] **Step 2: Supabase で確認**

Supabase ダッシュボード → Table Editor → `articles` テーブル。
- 記事が入っていることを確認
- `summary` カラムに 140〜280 字の日本語本文が入っていることを確認
- `body_excerpt` カラムに本文が入っていることを確認

`article_scores` テーブル:
- `prompt_score` が 6 以上
- `final_score` が `prompt_score` と同じ値（Phase 1 では）
- `score_reason` に短文の理由

- [ ] **Step 3: コミットは不要**（コードは変えていない）

エラーがあれば、エラー内容に応じてコードを修正してから次のタスクへ。

---

## Task 20: GitHub Actions ワークフロー

**Files:**
- Create: `.github/workflows/batch.yml`

- [ ] **Step 1: ワークフローを作成**

`.github/workflows/batch.yml`:

```yaml
name: noiseless batch

on:
  schedule:
    # 21:00 JST = 12:00 UTC
    - cron: '0 12 * * *'
    # 06:00 JST = 21:00 UTC (前日)
    - cron: '0 21 * * *'
  workflow_dispatch:

jobs:
  batch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run batch
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx scripts/batch.ts
```

注意: ローカルでは `tsx --env-file=.env.local scripts/batch.ts` だったが、GitHub Actions では `env:` でセットするので `--env-file` は不要。

- [ ] **Step 2: コミット**

```bash
git add .github/workflows/batch.yml
git commit -m "ci: add github actions batch workflow"
```

- [ ] **Step 3: GitHub リポジトリを作成して push**

GitHub で `noiseless` リポジトリを新規作成（private 推奨）。

```bash
git remote add origin https://github.com/<username>/noiseless.git
git push -u origin master
```

- [ ] **Step 4: GitHub Secrets を設定**

> **手動アクション**: GitHub リポジトリ → Settings → Secrets and variables → Actions で以下を追加:
> - `SUPABASE_URL`
> - `SUPABASE_SERVICE_ROLE_KEY`
> - `ANTHROPIC_API_KEY`

- [ ] **Step 5: 手動実行で動作確認**

GitHub Actions タブ → "noiseless batch" → "Run workflow"。
成功すれば Supabase に新しい記事が追加されているはず。

---

## Task 21: README を整備

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README を上書き**

`README.md`:

```markdown
# noiseless

自分の関心に最適化されたタイムライン型 Web アプリ。「ノイズのない X」をコンセプトとした自分専用情報源。

## ステータス

Phase 1 (MVP) 実装中。

- ✅ Plan A: バックエンド基盤 (本リポジトリ)
- ⬜️ Plan B: フロントエンド (タイムライン、いいね、設定 UI)

## アーキテクチャ

- **バッチ処理**: GitHub Actions で 1 日 2 回 (06:00 / 21:00 JST)、TypeScript (`tsx`) で実行
- **DB**: Supabase (PostgreSQL + pgvector)
- **LLM**: Claude Haiku (`claude-haiku-4-5-20251001`)
- **フロント**: Next.js 15 (App Router) on Vercel

## セットアップ

### 1. 環境変数

`.env.local` を作成:

\`\`\`
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
\`\`\`

### 2. 依存インストール

\`\`\`bash
npm install
\`\`\`

### 3. Supabase スキーマ適用

`supabase/migrations/` 内の SQL を Supabase ダッシュボードの SQL Editor で順に実行。

### 4. シードデータ投入

\`\`\`bash
npm run seed
\`\`\`

### 5. バッチを手動実行

\`\`\`bash
npm run batch
\`\`\`

## テスト

\`\`\`bash
npm test
\`\`\`

## 設計ドキュメント

- 設計書: `docs/superpowers/specs/2026-05-18-noiseless-design.md`
- 実装計画: `docs/superpowers/plans/2026-05-18-plan-a-backend.md`
```

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "docs: write README"
```

---

## 完了条件

Plan A が完了したと言えるのは、以下すべてを満たした時:

1. ローカルで `npm run batch` を実行すると、Supabase に記事と article_scores が書き込まれる
2. GitHub Actions の workflow_dispatch（手動実行）で同じ動作が確認できる
3. cron スケジュール（1 日 2 回）が登録されている
4. Supabase Table Editor で `articles.summary` を見ると、X 風の 140〜280 字の本文が入っている
5. `npm test` で全テスト pass する

これで「フロントエンドはまだないが、データだけが毎日溜まっていく」状態になる。Plan B（フロントエンド）と並行して、ここから Plan B 開発期間中もデータが蓄積されていく。
