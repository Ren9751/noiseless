# noiseless Plan B: フロントエンド 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 のフロントエンドを実装する — タイムライン（スコア順表示・いいねボタン）と設定画面（興味プロフィール編集・特別ルール）。固定 1 ユーザー、Supabase に蓄積された記事をスコア順に表示し、いいねを記録できる状態にする。

**Architecture:** Next.js 16 App Router を使い、Server Components から Supabase に直接アクセスして記事を取得する。Mutation は Server Actions で行う (設計書の「Route Handlers」より Next.js 16 では Server Actions の方が自然)。UI は shadcn/ui コンポーネントを最小限だけ採用。

**Tech Stack:**
- Next.js 16.2.6 (App Router)
- React 19.2.4
- TypeScript 5.x
- Tailwind CSS 4
- shadcn/ui (button / card / input / slider / textarea)
- `@supabase/supabase-js` (既存)
- vitest (既存)

---

## 設計ポリシー (Plan A から継承)

### テスト戦略
- **テスト対象**: `app/lib/articles.ts` の記事取得関数 (純粋部分)、Server Action のロジック
- **テストしない**: UI コンポーネント、Supabase との実通信、画面遷移 (手動確認)
- UI は MVP で一番変わる部分なので、E2E は今は導入しない (YAGNI)

### エラー処理の境界
- 画面表示時に **Supabase 接続失敗** → throw、Next.js の `error.tsx` で捕捉
- 画面表示時に **記事 0 件** → フォールバック (「データがまだありません」表示)
- いいね/設定更新の **Server Action 失敗** → クライアントに Error を返す、UI 側でメッセージ表示
- 設定 interests の **データ形式不正** → throw (内部データの破損は落ちる方が安全)

### ロガー
- `console.log` / `console.error` のまま (MVP では十分、Phase 4 以降で再考)

---

## ファイル構成 (Plan B 完了時に追加されるもの)

```
noiseless/
├── app/
│   ├── layout.tsx               # 修正: Nav 追加、メタ情報
│   ├── page.tsx                 # 上書き: タイムライン
│   ├── globals.css              # 既存 (Tailwind, shadcn の CSS 変数)
│   ├── error.tsx                # 新規: エラー境界
│   ├── settings/
│   │   └── page.tsx             # 新規: 設定画面
│   ├── lib/
│   │   ├── supabase-server.ts   # 新規: サーバー用 Supabase クライアント
│   │   ├── articles.ts          # 新規: 記事取得関数
│   │   ├── profile.ts           # 新規: プロフィール取得関数
│   │   └── actions.ts           # 新規: Server Actions (いいね・プロフィール更新)
│   └── components/
│       ├── article-card.tsx     # 新規: 記事カード (Server)
│       ├── like-button.tsx      # 新規: いいねボタン (Client)
│       ├── nav.tsx              # 新規: ナビゲーション
│       ├── interest-editor.tsx  # 新規: 興味分野エディタ (Client)
│       └── special-rules-editor.tsx  # 新規: 特別ルールエディタ (Client)
│   └── components/ui/           # shadcn/ui 生成物 (自動)
├── tests/
│   └── app/lib/
│       └── articles.test.ts     # 新規: 並び替えロジックのテスト
├── components.json              # 新規: shadcn 設定
├── lib/utils.ts                 # 新規: shadcn 標準の cn 関数 (自動)
```

各ファイルの責務:
- `app/lib/supabase-server.ts`: サーバー側専用の Supabase クライアント (`server-only` でクライアント誤用を防ぐ)
- `app/lib/articles.ts`: タイムライン用記事 + スコア + いいね済みフラグの取得
- `app/lib/profile.ts`: ユーザープロフィール取得
- `app/lib/actions.ts`: いいね追加/取り消し・プロフィール更新の Server Actions
- `app/page.tsx`: タイムライン (Server Component で記事を fetch して描画)
- `app/settings/page.tsx`: 設定画面
- `app/components/article-card.tsx`: 記事カード本体 (Server)
- `app/components/like-button.tsx`: クリックで Server Action 呼ぶ Client Component
- `app/components/nav.tsx`: 上部ナビ (タイムライン / 設定)
- `app/components/interest-editor.tsx`: 興味分野の追加/削除/重み変更フォーム
- `app/components/special-rules-editor.tsx`: 特別ルール (textarea)

---

## 固定値

- 固定ユーザー ID: `00000000-0000-0000-0000-000000000001`
- タイムライン表示上限: 50 件
- 並び順: `final_score DESC, fetched_at DESC`

---

## Task 1: shadcn/ui のセットアップ

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/*`

- [ ] **Step 1: shadcn/ui を初期化**

```bash
npx shadcn@latest init
```

プロンプトで:
- Style: `New York` (推奨)
- Base color: `Neutral`
- CSS variables: `Yes`
- その他はデフォルト

期待: `components.json`, `lib/utils.ts` が作成され、`app/globals.css` に CSS 変数が追記される。

- [ ] **Step 2: 必要な UI コンポーネントを追加**

```bash
npx shadcn@latest add button card input textarea slider
```

期待: `components/ui/button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `slider.tsx` が生成される。

- [ ] **Step 3: 動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いてエラーが出ないことを確認 (まだ Next.js デフォルトページが表示される)。Ctrl+C で停止。

- [ ] **Step 4: コミット**

```bash
git add components.json lib/ components/ app/globals.css package.json package-lock.json
git commit -m "chore: setup shadcn/ui with base components"
```

---

## Task 2: サーバー用 Supabase クライアント + 記事取得関数 (TDD)

**Files:**
- Create: `app/lib/supabase-server.ts`, `app/lib/articles.ts`, `app/lib/profile.ts`
- Create: `tests/app/lib/articles.test.ts`

- [ ] **Step 1: `server-only` を依存追加**

```bash
npm install server-only
```

`server-only` パッケージは「このモジュールがクライアントから import されたらビルドエラーにする」マーカー。`supabase-server.ts` で service_role キーを使うので必須。

- [ ] **Step 2: `app/lib/supabase-server.ts` を作成**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabaseServer = createClient(url, key, {
  auth: { persistSession: false },
});
```

`scripts/lib/supabase.ts` とほぼ同内容だが、`server-only` を付けることでクライアントバンドルへの混入を防ぐ。

- [ ] **Step 3: 記事+スコア取得の型を定義**

`app/lib/articles.ts` (型定義のみ先に置く):

```typescript
import "server-only";
import { supabaseServer } from "./supabase-server";

export interface TimelineArticle {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  score_reason: string | null;
  prompt_score: number;
  final_score: number;
  source_kind: string;
  raw_metadata: Record<string, unknown>;
  fetched_at: string;
  liked: boolean;
}

export async function getTimelineArticles(
  userId: string,
  limit = 50,
): Promise<TimelineArticle[]> {
  throw new Error("not implemented");
}
```

- [ ] **Step 4: 記事取得関数のテストを書く**

`tests/app/lib/articles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mergeLikedFlag, sortByFinalScore } from "../../../app/lib/articles";

describe("sortByFinalScore", () => {
  it("final_score 降順、同点なら fetched_at 降順で並べる", () => {
    const articles = [
      { id: "a", final_score: 7, fetched_at: "2026-05-25T10:00:00Z" },
      { id: "b", final_score: 9, fetched_at: "2026-05-25T08:00:00Z" },
      { id: "c", final_score: 7, fetched_at: "2026-05-25T12:00:00Z" },
    ];
    const result = sortByFinalScore(articles);
    expect(result.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });
});

describe("mergeLikedFlag", () => {
  it("いいね済みURLのフラグを true にする", () => {
    const articles = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const likedIds = new Set(["a", "c"]);
    const result = mergeLikedFlag(articles, likedIds);
    expect(result.find((a) => a.id === "a")?.liked).toBe(true);
    expect(result.find((a) => a.id === "b")?.liked).toBe(false);
    expect(result.find((a) => a.id === "c")?.liked).toBe(true);
  });
});
```

- [ ] **Step 5: テスト失敗を確認**

```bash
npm test
```

期待: `sortByFinalScore` と `mergeLikedFlag` が未定義で失敗。

- [ ] **Step 6: 関数を実装**

`app/lib/articles.ts` を上書き:

```typescript
import "server-only";
import { supabaseServer } from "./supabase-server";

export interface TimelineArticle {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  score_reason: string | null;
  prompt_score: number;
  final_score: number;
  source_kind: string;
  raw_metadata: Record<string, unknown>;
  fetched_at: string;
  liked: boolean;
}

export function sortByFinalScore<T extends { final_score: number; fetched_at: string }>(
  articles: T[],
): T[] {
  return [...articles].sort((a, b) => {
    if (b.final_score !== a.final_score) return b.final_score - a.final_score;
    return b.fetched_at.localeCompare(a.fetched_at);
  });
}

export function mergeLikedFlag<T extends { id: string }>(
  articles: T[],
  likedIds: Set<string>,
): (T & { liked: boolean })[] {
  return articles.map((a) => ({ ...a, liked: likedIds.has(a.id) }));
}

export async function getTimelineArticles(
  userId: string,
  limit = 50,
): Promise<TimelineArticle[]> {
  // 記事 + スコア + ソース種別を取得
  const { data: rows, error } = await supabaseServer
    .from("article_scores")
    .select(
      `
      prompt_score,
      final_score,
      score_reason,
      article:articles!inner (
        id,
        url,
        title,
        summary,
        raw_metadata,
        fetched_at,
        source:sources!inner ( kind )
      )
    `,
    )
    .eq("user_id", userId)
    .order("final_score", { ascending: false })
    .order("computed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  // いいね済み ID を取得
  const articleIds = (rows ?? []).map((r) => (r.article as any).id);
  const { data: likes } = await supabaseServer
    .from("likes")
    .select("article_id")
    .eq("user_id", userId)
    .in("article_id", articleIds.length > 0 ? articleIds : ["00000000-0000-0000-0000-000000000000"]);
  const likedIds = new Set((likes ?? []).map((l) => l.article_id as string));

  return (rows ?? []).map((r): TimelineArticle => {
    const article = r.article as any;
    return {
      id: article.id,
      url: article.url,
      title: article.title,
      summary: article.summary,
      score_reason: r.score_reason,
      prompt_score: r.prompt_score,
      final_score: r.final_score,
      source_kind: article.source.kind,
      raw_metadata: article.raw_metadata ?? {},
      fetched_at: article.fetched_at,
      liked: likedIds.has(article.id),
    };
  });
}
```

- [ ] **Step 7: テスト pass を確認**

```bash
npm test
```

期待: 既存テストとあわせて全 pass。

- [ ] **Step 8: `app/lib/profile.ts` を作成**

```typescript
import "server-only";
import { supabaseServer } from "./supabase-server";

export interface Interest {
  topic: string;
  weight: number;
}

export interface UserProfile {
  user_id: string;
  interests: Interest[];
  special_rules: string;
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabaseServer
    .from("user_profile")
    .select("user_id, interests, special_rules")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  if (!Array.isArray(data.interests)) {
    throw new Error("user_profile.interests must be an array");
  }
  return data as UserProfile;
}
```

- [ ] **Step 9: コミット**

```bash
git add app/lib/ tests/app/ package.json package-lock.json
git commit -m "feat: add server-side data access layer (articles, profile)"
```

---

## Task 3: ArticleCard コンポーネント (Server)

**Files:**
- Create: `app/components/article-card.tsx`

ソースバッジ、取得時刻 (相対表現)、原タイトル、X 風本文、評価理由、出典 URL、いいねボタンを 1 カードに収めるコンポーネント。

- [ ] **Step 1: ソース名表記マップを決める**

`app/lib/articles.ts` の末尾に追加:

```typescript
export function sourceLabel(kind: string): string {
  switch (kind) {
    case "hatena":
      return "はてブ";
    case "hackernews":
      return "HN";
    case "arxiv":
      return "arXiv";
    case "reddit":
      return "Reddit";
    case "rss":
      return "RSS";
    default:
      return kind;
  }
}

export function relativeTime(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
```

- [ ] **Step 2: relativeTime のテストを追加**

`tests/app/lib/articles.test.ts` に追記:

```typescript
import { relativeTime, sourceLabel } from "../../../app/lib/articles";

describe("relativeTime", () => {
  const now = new Date("2026-05-25T12:00:00Z");

  it("1分未満は たった今", () => {
    expect(relativeTime("2026-05-25T11:59:30Z", now)).toBe("たった今");
  });
  it("分単位を返す", () => {
    expect(relativeTime("2026-05-25T11:45:00Z", now)).toBe("15分前");
  });
  it("時間単位を返す", () => {
    expect(relativeTime("2026-05-25T09:00:00Z", now)).toBe("3時間前");
  });
  it("日単位を返す (7日未満)", () => {
    expect(relativeTime("2026-05-22T12:00:00Z", now)).toBe("3日前");
  });
});

describe("sourceLabel", () => {
  it("既知のソースは日本語に変換", () => {
    expect(sourceLabel("hatena")).toBe("はてブ");
    expect(sourceLabel("hackernews")).toBe("HN");
    expect(sourceLabel("arxiv")).toBe("arXiv");
  });
  it("未知のソースはそのまま返す", () => {
    expect(sourceLabel("custom")).toBe("custom");
  });
});
```

- [ ] **Step 3: テスト pass を確認**

```bash
npm test
```

期待: 新規 7 ケース含めて全 pass。

- [ ] **Step 4: `app/components/article-card.tsx` を作成**

```tsx
import { Card } from "@/components/ui/card";
import type { TimelineArticle } from "@/app/lib/articles";
import { relativeTime, sourceLabel } from "@/app/lib/articles";
import { LikeButton } from "./like-button";

export function ArticleCard({ article }: { article: TimelineArticle }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">[{sourceLabel(article.source_kind)}]</span>
        <span>{relativeTime(article.fetched_at)}</span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-semibold leading-snug hover:underline"
      >
        {article.title}
      </a>

      {article.summary && (
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {article.summary}
        </p>
      )}

      {article.score_reason && (
        <p className="text-xs text-muted-foreground italic">
          評価: {article.score_reason}
        </p>
      )}

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

- [ ] **Step 5: コミット**

```bash
git add app/components/article-card.tsx app/lib/articles.ts tests/app/lib/articles.test.ts
git commit -m "feat: add ArticleCard component with relative time and source label"
```

---

## Task 4: LikeButton + いいね Server Action

**Files:**
- Create: `app/components/like-button.tsx`
- Create: `app/lib/actions.ts`

- [ ] **Step 1: `app/lib/actions.ts` を作成 (いいね部分のみ)**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase-server";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function toggleLike(articleId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabaseServer
      .from("likes")
      .delete()
      .eq("user_id", FIXED_USER_ID)
      .eq("article_id", articleId);
    if (error) throw error;
  } else {
    const { error } = await supabaseServer
      .from("likes")
      .insert({ user_id: FIXED_USER_ID, article_id: articleId });
    // 競合 (二重押下) は 23505 で来るが無視する
    if (error && error.code !== "23505") throw error;
  }
  revalidatePath("/");
}
```

`FIXED_USER_ID` は seed と一致。Phase 4 で認証導入時に `getCurrentUser()` に置き換える。

- [ ] **Step 2: `app/components/like-button.tsx` を作成**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleLike } from "@/app/lib/actions";

export function LikeButton({
  articleId,
  initiallyLiked,
}: {
  articleId: string;
  initiallyLiked: boolean;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !liked;
    setLiked(next); // 楽観的更新
    startTransition(async () => {
      try {
        await toggleLike(articleId, !next);
      } catch {
        setLiked(!next); // 失敗時ロールバック
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className={liked ? "text-red-500 hover:text-red-600" : ""}
      aria-pressed={liked}
      aria-label={liked ? "いいねを取り消す" : "いいね"}
    >
      {liked ? "♥" : "♡"}
    </Button>
  );
}
```

楽観的更新: クリック直後に UI が変わる。失敗したら元に戻す (CLAUDE.md「ミスしてもすぐやり直せるように」)。

- [ ] **Step 3: コミット**

```bash
git add app/lib/actions.ts app/components/like-button.tsx
git commit -m "feat: add LikeButton with optimistic update and toggleLike Server Action"
```

---

## Task 5: タイムラインページ

**Files:**
- Modify: `app/page.tsx`
- Create: `app/error.tsx`

- [ ] **Step 1: 既存の `app/page.tsx` を上書き**

```tsx
import { getTimelineArticles } from "./lib/articles";
import { ArticleCard } from "./components/article-card";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function TimelinePage() {
  const articles = await getTimelineArticles(FIXED_USER_ID, 50);

  if (articles.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        まだ記事がありません。バッチを実行して記事を取り込んでください。
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-3">
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
      <div className="text-center text-xs text-muted-foreground py-8">
        ── 今日は以上です ──
      </div>
    </main>
  );
}
```

「下までスクロールしたら『今日は以上です』で打ち切り」(設計書) を、無限スクロールでなく単純に末尾固定で実現。

- [ ] **Step 2: `app/error.tsx` を作成**

```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-4 text-center">
      <h2 className="text-lg font-semibold">エラーが発生しました</h2>
      <p className="text-sm text-muted-foreground break-words">{error.message}</p>
      <button
        onClick={reset}
        className="self-center px-4 py-2 rounded bg-foreground text-background text-sm"
      >
        再試行
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開く。

期待:
- 71 件の記事カードがスコア順 (final_score 降順) で表示される
- 各カードに [はてブ]/[HN]/[arXiv] のラベル
- タイトル、X風本文、評価理由、いいねボタン (♡)
- 末尾に「── 今日は以上です ──」
- いいねボタンを押すと ♡ → ♥ に変わる
- もう一度押すと ♥ → ♡ に戻る

スクリーンショットを撮るか、目視で確認。Ctrl+C で停止。

- [ ] **Step 4: コミット**

```bash
git add app/page.tsx app/error.tsx
git commit -m "feat: add timeline page and error boundary"
```

---

## Task 6: Nav + ルートレイアウト調整

**Files:**
- Create: `app/components/nav.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: `app/components/nav.tsx` を作成**

```tsx
import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b sticky top-0 bg-background z-10">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          noiseless
        </Link>
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          設定
        </Link>
      </div>
    </nav>
  );
}
```

シンプルに 2 リンクだけ。設計書の「歯車アイコン」は文字「設定」で代替 (アイコン依存を避けて MVP は軽量に)。

- [ ] **Step 2: `app/layout.tsx` を編集**

`app/layout.tsx` を読んで、現状の中身を確認した上で、Nav を差し込む。

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./components/nav";

export const metadata: Metadata = {
  title: "noiseless",
  description: "自分の関心に最適化されたタイムライン",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

既存の `app/layout.tsx` にあるフォント設定 (Geist など) はそのまま残す方が良い。Step では実際のファイル内容を読み取って、Nav と metadata だけ追加するように **編集** すること。

- [ ] **Step 3: 動作確認**

```bash
npm run dev
```

ブラウザで:
- 上部に "noiseless / 設定" の Nav が表示される
- Nav はスクロールしても固定 (sticky)
- "設定" リンクをクリックすると `/settings` に飛ぶ (まだ 404)

- [ ] **Step 4: コミット**

```bash
git add app/components/nav.tsx app/layout.tsx
git commit -m "feat: add navigation with timeline and settings links"
```

---

## Task 7: 設定画面 + プロフィール更新 Server Action

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/components/interest-editor.tsx`
- Create: `app/components/special-rules-editor.tsx`
- Modify: `app/lib/actions.ts`

- [ ] **Step 1: `app/lib/actions.ts` にプロフィール更新を追加**

`app/lib/actions.ts` の **ファイル先頭の import セクション** に追加:

```typescript
import type { Interest } from "./profile";
```

`app/lib/actions.ts` の **末尾** に以下の関数を追記:

```typescript
export async function updateInterests(interests: Interest[]): Promise<void> {
  for (const i of interests) {
    if (typeof i.topic !== "string" || i.topic.trim() === "") {
      throw new Error("topic は空にできない");
    }
    if (!Number.isFinite(i.weight) || i.weight < 1 || i.weight > 10) {
      throw new Error("weight は 1〜10");
    }
  }
  const { error } = await supabaseServer
    .from("user_profile")
    .update({ interests, updated_at: new Date().toISOString() })
    .eq("user_id", FIXED_USER_ID);
  if (error) throw error;
  revalidatePath("/");
}

export async function updateSpecialRules(specialRules: string): Promise<void> {
  const { error } = await supabaseServer
    .from("user_profile")
    .update({ special_rules: specialRules, updated_at: new Date().toISOString() })
    .eq("user_id", FIXED_USER_ID);
  if (error) throw error;
  revalidatePath("/");
}
```

バリデーション (空 topic 禁止、weight 1-10) は Server Action 内で実施。

- [ ] **Step 2: `app/components/interest-editor.tsx` を作成**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { updateInterests } from "@/app/lib/actions";
import type { Interest } from "@/app/lib/profile";

export function InterestEditor({ initial }: { initial: Interest[] }) {
  const [items, setItems] = useState<Interest[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<Interest>) {
    setItems((cur) => cur.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function add() {
    setItems((cur) => [...cur, { topic: "", weight: 5 }]);
  }

  function remove(index: number) {
    setItems((cur) => cur.filter((_, i) => i !== index));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateInterests(items.filter((i) => i.topic.trim() !== ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={it.topic}
            onChange={(e) => update(i, { topic: e.target.value })}
            placeholder="興味分野"
            className="flex-1"
          />
          <div className="flex items-center gap-2 w-48">
            <Slider
              value={[it.weight]}
              onValueChange={(v) => update(i, { weight: v[0] })}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-sm w-6 text-right">{it.weight}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => remove(i)}>
            ×
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={add}>
          + 追加
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app/components/special-rules-editor.tsx` を作成**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSpecialRules } from "@/app/lib/actions";

export function SpecialRulesEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateSpecialRules(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="例: Claude Code に関する記事はスコア 9 以上にする"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `app/settings/page.tsx` を作成**

```tsx
import { getProfile } from "@/app/lib/profile";
import { InterestEditor } from "@/app/components/interest-editor";
import { SpecialRulesEditor } from "@/app/components/special-rules-editor";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function SettingsPage() {
  const profile = await getProfile(FIXED_USER_ID);

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">興味分野</h2>
        <p className="text-sm text-muted-foreground">
          重要度 (1〜10) でスコアの基礎が決まります。次回バッチから反映されます。
        </p>
        <InterestEditor initial={profile.interests} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">特別ルール</h2>
        <p className="text-sm text-muted-foreground">
          スコアリングプロンプトに直接挿入される文字列。例外的なスコア調整に。
        </p>
        <SpecialRulesEditor initial={profile.special_rules} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: 動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/settings`:
- 興味分野が 10 項目表示される (seed で入れた内容)
- スライダーで重みを変更できる
- × ボタンで項目削除
- + 追加 で空項目を追加
- 保存 ボタンを押すと「保存中…」→「保存」に戻る
- 特別ルールの textarea で編集 → 保存
- リロードして変更が反映されていることを確認

- [ ] **Step 6: コミット**

```bash
git add app/settings/ app/components/interest-editor.tsx app/components/special-rules-editor.tsx app/lib/actions.ts
git commit -m "feat: add settings page with interest and special rules editors"
```

---

## Task 8: 動作確認 + スタイリング微調整

**Files:**
- Modify (as needed): `app/page.tsx`, `app/components/article-card.tsx`, `app/globals.css`

ここはコードを書くというより、実際に画面を見て微修正するタスク。

- [ ] **Step 1: タイムラインを目視確認**

```bash
npm run dev
```

チェックリスト:
- [ ] カードの余白が窮屈すぎない / 広すぎない
- [ ] 行間 (leading) が日本語として読みやすい
- [ ] スコア順に並んでいる (final_score 高いものが上)
- [ ] いいねボタンが見やすい色
- [ ] ソースバッジ ([はてブ] など) が一目で識別できる
- [ ] 評価理由が浮いて見えない (太字や色で主張しすぎない)
- [ ] サイトのナビ (上部) が他コンテンツとぶつからない

- [ ] **Step 2: 必要に応じてクラス調整**

例: カード間隔を広げたい → `app/page.tsx` の `gap-3` を `gap-4` に。

具体的な修正は目視次第なので、ここでは個別の Step は書かない。気になった部分だけ調整する。

- [ ] **Step 3: いいねの動作を確認**

- [ ] ♡ を 1 回クリック → 即座に ♥ (赤) に変わる
- [ ] DB に行が追加される (Supabase Table Editor で `likes` を見る)
- [ ] もう一度クリック → ♡ に戻る
- [ ] DB から行が消える

- [ ] **Step 4: 設定の動作を確認**

- [ ] 興味分野の重みをスライダーで動かす
- [ ] 保存 → リロード → 変更が反映されている
- [ ] Supabase Table Editor で `user_profile.interests` が更新されている
- [ ] 特別ルールを編集 → 保存 → リロード → 反映
- [ ] バリデーション: topic を空にして保存しようとすると、空項目は除外される (filter してから渡しているので)

- [ ] **Step 5: バッチ再実行で新規記事のスコアが反映されることを確認 (任意)**

```bash
npm run batch
```

完了後にタイムラインをリロードし、新しい記事が追加されているか確認。スコアリングプロンプトには更新後の interests が使われる。

- [ ] **Step 6: スタイル調整があればコミット**

修正があれば:

```bash
git add app/
git commit -m "style: tweak spacing and colors based on visual review"
```

修正なしの場合はスキップ。

---

## Task 9: README 更新 & 最終チェック

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README の Status セクションを更新**

`README.md` 内の `## ステータス` を:

```markdown
## ステータス

Phase 1 (MVP) 完了。

- ✅ Plan A: バックエンド基盤 (バッチ処理 + DB)
- ✅ Plan B: フロントエンド (タイムライン・いいね・設定)
- ⬜ GitHub Actions の本番有効化 (リポジトリ作成 + Secrets 設定)
- ⬜ Vercel デプロイ
```

`## ディレクトリ構成` に Plan B で追加されたパスを追記:

```
app/
├── lib/                   # サーバー側データアクセス + Server Actions
├── components/            # UI コンポーネント (Server / Client)
├── settings/              # 設定画面
└── page.tsx               # タイムライン
```

- [ ] **Step 2: 設計ドキュメント参照を追記**

`README.md` 末尾の `## 設計ドキュメント` に:

```markdown
- Plan B (フロントエンド): `docs/superpowers/plans/2026-05-25-plan-b-frontend.md`
```

- [ ] **Step 3: 全テスト pass を最終確認**

```bash
npm test
```

期待: 全テスト pass。

- [ ] **Step 4: TypeScript の型チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 5: lint**

```bash
npm run lint
```

期待: エラーなし (警告があれば内容次第で許容)。

- [ ] **Step 6: コミット**

```bash
git add README.md
git commit -m "docs: update README to reflect Phase 1 MVP completion"
```

---

## 完了条件

Plan B が完了したと言えるのは、以下すべてを満たした時:

1. `npm run dev` でタイムラインが表示され、71 件以上の記事がスコア順に並ぶ
2. いいねボタンを押すと UI が即座に反映され、Supabase の `likes` テーブルに記録される
3. 設定画面で興味分野の追加・削除・重み変更ができ、Supabase の `user_profile.interests` が更新される
4. 設定画面で特別ルールを編集・保存できる
5. `npm test` で全テスト pass する
6. `npx tsc --noEmit` でエラーなし
7. `npm run lint` でエラーなし
8. 設定変更後に `npm run batch` を再実行すると、新しい設定でスコアリングされた記事が DB に追加される

これで Phase 1 MVP が「動く状態」になる。次の段階は:

- GitHub Actions の本番有効化 (push, Secrets 設定) → 毎日自動でデータが溜まり始める
- Vercel にデプロイして、自分のスマホからも見られるようにする (任意)
- Phase 2: 学習層 (埋め込み + 個人化スコア + セレンディピティ枠)
