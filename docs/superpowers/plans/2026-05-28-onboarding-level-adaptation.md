# オンボーディング & レベル適応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初回利用時に興味分野とITレベルを聞き取り、レコメンドを興味に揃え、本文（summary）の難易度をレベルに合わせる。

**Architecture:** `user_profile` に `it_level` / `onboarded_at` を追加。Server Component 側で未完了なら `/onboarding` へ redirect。2ステップのクライアントウィザードで興味とレベルを集め、1つの Server Action で保存。バッチ側はレベルをスコアリングプロンプトの難易度指示に反映（新規記事のみ）。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL), Tailwind, @base-ui/react, vitest, Anthropic SDK（バッチ）。

設計書: `docs/superpowers/specs/2026-05-28-onboarding-level-design.md`

---

## 事前メモ（重要）

- `AGENTS.md` の指示どおり、**この Next.js は通常版と異なる可能性がある**。UIコードを書く前に `node_modules/next/dist/docs/` の該当ガイド（`redirect`, `usePathname`, Server Actions）を確認すること。
- vitest は `tests/**/*.test.ts` のみを対象にし、**パスエイリアス無し・node 環境**で動く（`vitest.config.ts`）。テストは相対パスで import する。
- テスト対象の純粋モジュールは **`server-only` / `@supabase/supabase-js` / `@anthropic-ai/sdk` を import してはいけない**（import すると env 必須でテストが落ちる）。
- 既存ファイルのパスエイリアスは `@/` = プロジェクトルート。
- 固定ユーザーID: `00000000-0000-0000-0000-000000000001`。

## ファイル構成（このプランで触るもの）

**新規作成**
- `supabase/migrations/20260528000001_onboarding.sql` — 列追加
- `scripts/lib/difficulty.ts` — レベル→本文難易度指示（純粋）
- `scripts/lib/scoring-prompt.ts` — プロンプト組み立て（純粋。`buildPrompt` を `scoring.ts` から分離）
- `app/lib/onboarding-data.ts` — 興味カテゴリ・レベル定義・例文（純粋）
- `app/lib/onboarding-gate.ts` — `isOnboarded`（純粋）
- `app/lib/onboarding-validation.ts` — 入力バリデーション（純粋）
- `app/onboarding/page.tsx` — ゲート＋ウィザード描画（Server Component）
- `app/onboarding/onboarding-wizard.tsx` — 2ステップウィザード（Client Component）
- `tests/difficulty.test.ts`, `tests/scoring-prompt.test.ts`, `tests/onboarding-gate.test.ts`, `tests/onboarding-validation.test.ts`, `tests/onboarding-data.test.ts`

**変更**
- `scripts/lib/scoring.ts` — `buildPrompt` を分離モジュールから import、`ScoringProfile` に `it_level`
- `scripts/batch.ts` — `it_level` をスコアリングへ渡す
- `scripts/seed.ts` — 未完了ユーザーで初期化
- `app/lib/profile.ts` — `it_level` / `onboarded_at` を型と select に追加
- `app/lib/actions.ts` — `completeOnboarding` 追加
- `app/page.tsx` — 未完了なら `/onboarding` へ redirect
- `app/components/nav.tsx` — `/onboarding` では非表示（client 化）

---

## Task 1: マイグレーション（列追加）

**Files:**
- Create: `supabase/migrations/20260528000001_onboarding.sql`

- [ ] **Step 1: マイグレーションSQLを書く**

```sql
-- user_profile にオンボーディング用の列を追加
alter table user_profile
  add column it_level smallint,
  add column onboarded_at timestamptz;
```

- [ ] **Step 2: DB に適用する**

このプロジェクトの Supabase 運用に合わせて適用する（Supabase CLI を使うなら `supabase db push`、なければ Supabase ダッシュボードの SQL Editor に上記SQLを貼って実行）。**DBへの接続が必要なので、実行前にユーザーへ確認すること。**

- [ ] **Step 3: 適用を確認する**

Supabase の Table Editor か SQL Editor で `user_profile` に `it_level` (smallint, nullable) と `onboarded_at` (timestamptz, nullable) が増えていることを確認。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260528000001_onboarding.sql
git commit -m "feat(db): add it_level and onboarded_at to user_profile"
```

---

## Task 2: 難易度モジュール（レベル→本文指示）

**Files:**
- Create: `scripts/lib/difficulty.ts`
- Test: `tests/difficulty.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/difficulty.test.ts
import { describe, it, expect } from "vitest";
import { difficultyInstruction, resolveLevel, DEFAULT_LEVEL } from "../scripts/lib/difficulty";

describe("resolveLevel", () => {
  it("null は中級(3)に丸める", () => {
    expect(resolveLevel(null)).toBe(DEFAULT_LEVEL);
    expect(DEFAULT_LEVEL).toBe(3);
  });
  it("範囲外も中級(3)に丸める", () => {
    expect(resolveLevel(0)).toBe(3);
    expect(resolveLevel(6)).toBe(3);
  });
  it("1〜5はそのまま", () => {
    expect(resolveLevel(1)).toBe(1);
    expect(resolveLevel(5)).toBe(5);
  });
});

describe("difficultyInstruction", () => {
  it("入門は『ITをほぼ知らない』向けの指示を含む", () => {
    expect(difficultyInstruction(1)).toContain("ITをほぼ知らない");
  });
  it("エキスパートは『研究者・上級エンジニア』向けの指示を含む", () => {
    expect(difficultyInstruction(5)).toContain("研究者・上級エンジニア");
  });
  it("null は中級の指示になる", () => {
    expect(difficultyInstruction(null)).toBe(difficultyInstruction(3));
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npm test -- difficulty`
Expected: FAIL（`scripts/lib/difficulty.ts` が無い）

- [ ] **Step 3: 実装する**

```typescript
// scripts/lib/difficulty.ts
export const DEFAULT_LEVEL = 3;

// レベル(1-5) → X風本文の難易度指示。scoring プロンプトに差し込む。
export const DIFFICULTY_BY_LEVEL: Record<number, string> = {
  1: "想定読者は「ITをほぼ知らない人」。専門用語・カタカナ語は避け、使うなら必ず一言で補足する。日常の例えを使い、中学生でも分かる平易さにする",
  2: "想定読者は「アプリ・サーバー・データ程度の基本語が分かる人」。基本語は前提にし、少し難しい用語だけ短く補足する。高校生〜文系大学生に伝わる平易さにする",
  3: "想定読者は「普段からIT記事を読む人」。API・データベース・Git など一般的なIT用語は説明なしで使い、専門的な用語だけ軽く補足する",
  4: "想定読者は「現役エンジニア」。技術用語はそのまま使い、仕組みや背景に踏み込んだ表現も使ってよい",
  5: "想定読者は「研究者・上級エンジニア」。最新の専門用語や概念もそのまま使い、冗長な説明は省いて要点と含意を濃く短くまとめる",
};

export function resolveLevel(level: number | null | undefined): number {
  if (level == null || level < 1 || level > 5) return DEFAULT_LEVEL;
  return level;
}

export function difficultyInstruction(level: number | null | undefined): string {
  return DIFFICULTY_BY_LEVEL[resolveLevel(level)];
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npm test -- difficulty`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add scripts/lib/difficulty.ts tests/difficulty.test.ts
git commit -m "feat(batch): add difficulty instruction by IT level"
```

---

## Task 3: プロンプト分離 + レベル反映 + バッチ配線

**Files:**
- Create: `scripts/lib/scoring-prompt.ts`
- Test: `tests/scoring-prompt.test.ts`
- Modify: `scripts/lib/scoring.ts`
- Modify: `scripts/batch.ts:101-104`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/scoring-prompt.test.ts
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
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npm test -- scoring-prompt`
Expected: FAIL（`scripts/lib/scoring-prompt.ts` が無い）

- [ ] **Step 3: `scoring-prompt.ts` を実装する**

`scripts/lib/scoring.ts` の現在の `buildPrompt` と `UserProfile` をこのファイルへ移し、難易度行をレベル可変にする。

```typescript
// scripts/lib/scoring-prompt.ts
import { difficultyInstruction } from "./difficulty";

export interface ScoringProfile {
  interests: Array<{ topic: string; weight: number }>;
  special_rules: string;
  it_level: number | null;
}

export function buildPrompt(profile: ScoringProfile): string {
  const interestsList = profile.interests
    .map((i) => `- ${i.topic} (重要度 ${i.weight}/10)`)
    .join("\n");

  return `あなたは「自分専用ニュースタイムライン」のキュレーターです。
記事を以下のユーザープロフィールに照らしてスコアリングし、日本語タイトルと X (旧Twitter) の投稿1個分の本文を生成してください。

## ユーザーの興味分野
${interestsList}

## 特別ルール
${profile.special_rules || "（なし）"}

## スコアリング基準
- 興味分野の重要度を基礎スコアとする (1-10)
- 内容が薄い速報は -1
- 複数の興味分野にまたがる記事は +1
- 全く関係ない内容は 1-3

## title_ja の要件
- 25〜60字程度の自然な日本語タイトル
- 原文タイトルが既に日本語ならそのまま使う
- 原文が英語等なら、内容に即した日本語タイトルに意訳する（直訳ではなく自然な日本語）
- 終止符不要、煽り・絵文字禁止

## X風本文 (summary) の要件
- 140〜280字
- ${difficultyInstruction(profile.it_level)}
- タイトルの言い換えではなく、本文の中身を踏まえる
- 「結論」「面白いポイント」「読む価値」のいずれかが伝わる
- 学術論文調（「〜の認識論」「〜性」「〜における〇〇」など抽象表現の連発）は禁止
- 抽象的な言い回しではなく、具体例や数字で書く
- 体言止め・断定はOK、絵文字・誇張・煽りは禁止

## score_reason の要件
- なぜそのスコアか、20〜40字で簡潔に

## 出力形式（JSON）
{
  "prompt_score": 数値,
  "title_ja": "日本語タイトル",
  "summary": "X風本文",
  "score_reason": "短い理由"
}`;
}
```

- [ ] **Step 4: `scoring.ts` を分離後の形に書き換える**

`buildPrompt` 定義とローカル `UserProfile` を削除し、新モジュールから import する。

```typescript
// scripts/lib/scoring.ts
import { z } from "zod";
import { anthropic, HAIKU_MODEL } from "./llm";
import { buildPrompt, type ScoringProfile } from "./scoring-prompt";
import type { ArticleWithBody, ScoringResult } from "./types";

const SCORING_SCHEMA = z.object({
  prompt_score: z.number().int().min(1).max(10),
  title_ja: z.string(),
  summary: z.string(),
  score_reason: z.string(),
});

export async function scoreArticle(
  article: ArticleWithBody,
  profile: ScoringProfile,
): Promise<ScoringResult> {
  const userMessage = `タイトル: ${article.title}\n\n本文抜粋:\n${article.body_excerpt}`;

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    system: buildPrompt(profile),
    messages: [{ role: "user", content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("unexpected response type");
  const text = content.text;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("no JSON in response: " + text);

  const parsed = JSON.parse(jsonMatch[0]);
  return SCORING_SCHEMA.parse(parsed);
}
```

- [ ] **Step 5: `batch.ts` でレベルを渡す**

`scripts/batch.ts` の `scoreArticle` 呼び出し（現状101〜104行付近）を次に変更する。

```typescript
      const scoring = await scoreArticle(entry, {
        interests: profile.interests,
        special_rules: profile.special_rules,
        it_level: profile.it_level ?? null,
      });
```

（`profile` は `select("*")` 取得済みなので `it_level` を含む。）

- [ ] **Step 6: テストと型チェック**

Run: `npm test -- scoring-prompt`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 7: コミット**

```bash
git add scripts/lib/scoring-prompt.ts scripts/lib/scoring.ts scripts/batch.ts tests/scoring-prompt.test.ts
git commit -m "feat(batch): adapt summary difficulty to user IT level"
```

---

## Task 4: seed を未完了ユーザーで初期化

**Files:**
- Modify: `scripts/seed.ts:13-37`

- [ ] **Step 1: `interests` / `special_rules` を空にして upsert する**

`scripts/seed.ts` の interests 配列・specialRules・profile upsert 部分（13〜37行）を次に置き換える。`it_level` / `onboarded_at` は指定しない（= null のまま）。

```typescript
  // user_profile を upsert（オンボーディング前のまっさら状態）
  const interests: { topic: string; weight: number }[] = [];
  const specialRules = "";

  const { error: profileError } = await supabase
    .from("user_profile")
    .upsert({
      user_id: user.id,
      interests,
      special_rules: specialRules,
      it_level: null,
      onboarded_at: null,
    });
  if (profileError) throw profileError;
  console.log("profile reset to pre-onboarding state");
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 3: コミット**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): start fixed user in pre-onboarding state"
```

---

## Task 5: profile.ts に列を反映

**Files:**
- Modify: `app/lib/profile.ts`

- [ ] **Step 1: 型と select を更新する**

`app/lib/profile.ts` を次に変更（`UserProfile` に2項目追加、`select` に2列追加）。

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
  it_level: number | null;
  onboarded_at: string | null;
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabaseServer
    .from("user_profile")
    .select("user_id, interests, special_rules, it_level, onboarded_at")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  if (!Array.isArray(data.interests)) {
    throw new Error("user_profile.interests must be an array");
  }
  return data as UserProfile;
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/lib/profile.ts
git commit -m "feat: include it_level and onboarded_at in UserProfile"
```

---

## Task 6: オンボーディング判定（isOnboarded）

**Files:**
- Create: `app/lib/onboarding-gate.ts`
- Test: `tests/onboarding-gate.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/onboarding-gate.test.ts
import { describe, it, expect } from "vitest";
import { isOnboarded } from "../app/lib/onboarding-gate";

describe("isOnboarded", () => {
  it("onboarded_at が null なら未完了", () => {
    expect(isOnboarded(null)).toBe(false);
  });
  it("onboarded_at に値があれば完了", () => {
    expect(isOnboarded("2026-05-28T10:00:00Z")).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npm test -- onboarding-gate`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 実装する**

```typescript
// app/lib/onboarding-gate.ts
export function isOnboarded(onboardedAt: string | null): boolean {
  return onboardedAt != null;
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npm test -- onboarding-gate`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add app/lib/onboarding-gate.ts tests/onboarding-gate.test.ts
git commit -m "feat: add isOnboarded gate helper"
```

---

## Task 7: 入力バリデーション

**Files:**
- Create: `app/lib/onboarding-validation.ts`
- Test: `tests/onboarding-validation.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/onboarding-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateOnboardingInput } from "../app/lib/onboarding-validation";

const ok = [{ topic: "AI Safety", weight: 7 }];

describe("validateOnboardingInput", () => {
  it("興味が0件なら例外", () => {
    expect(() => validateOnboardingInput([], 3)).toThrow();
  });
  it("レベルが範囲外なら例外", () => {
    expect(() => validateOnboardingInput(ok, 0)).toThrow();
    expect(() => validateOnboardingInput(ok, 6)).toThrow();
  });
  it("レベルが整数でなければ例外", () => {
    expect(() => validateOnboardingInput(ok, 2.5)).toThrow();
  });
  it("topic が空なら例外", () => {
    expect(() => validateOnboardingInput([{ topic: "  ", weight: 7 }], 3)).toThrow();
  });
  it("正常入力は例外を投げない", () => {
    expect(() => validateOnboardingInput(ok, 3)).not.toThrow();
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npm test -- onboarding-validation`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 実装する**

```typescript
// app/lib/onboarding-validation.ts
import type { Interest } from "./profile";

export function validateOnboardingInput(interests: Interest[], itLevel: number): void {
  if (!Array.isArray(interests) || interests.length === 0) {
    throw new Error("興味分野を1つ以上選んでください");
  }
  for (const i of interests) {
    if (typeof i.topic !== "string" || i.topic.trim() === "") {
      throw new Error("topic は空にできない");
    }
    if (!Number.isFinite(i.weight) || i.weight < 1 || i.weight > 10) {
      throw new Error("weight は 1〜10");
    }
  }
  if (!Number.isInteger(itLevel) || itLevel < 1 || itLevel > 5) {
    throw new Error("レベルは 1〜5");
  }
}
```

> 注: `import type` は実行時に消えるので `profile.ts`（server-only）を引きずらない。node 環境のテストで安全。

- [ ] **Step 4: テストが通るのを確認**

Run: `npm test -- onboarding-validation`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add app/lib/onboarding-validation.ts tests/onboarding-validation.test.ts
git commit -m "feat: add onboarding input validation"
```

---

## Task 8: カテゴリ・レベル定義（定数）

**Files:**
- Create: `app/lib/onboarding-data.ts`
- Test: `tests/onboarding-data.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// tests/onboarding-data.test.ts
import { describe, it, expect } from "vitest";
import { INTEREST_CATEGORIES, LEVELS, DEFAULT_INTEREST_WEIGHT } from "../app/lib/onboarding-data";

describe("onboarding-data", () => {
  it("AI Safety がカテゴリに含まれる", () => {
    const all = INTEREST_CATEGORIES.flatMap((g) => g.topics);
    expect(all).toContain("AI Safety・アラインメント");
  });
  it("レベルは5段階で value が 1..5", () => {
    expect(LEVELS).toHaveLength(5);
    expect(LEVELS.map((l) => l.value)).toEqual([1, 2, 3, 4, 5]);
  });
  it("各レベルに例文がある", () => {
    for (const l of LEVELS) {
      expect(l.example.length).toBeGreaterThan(20);
    }
  });
  it("デフォルト重みは7", () => {
    expect(DEFAULT_INTEREST_WEIGHT).toBe(7);
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npm test -- onboarding-data`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 実装する**

```typescript
// app/lib/onboarding-data.ts
export const DEFAULT_INTEREST_WEIGHT = 7;

export interface CategoryGroup {
  group: string;
  topics: string[];
}

export const INTEREST_CATEGORIES: CategoryGroup[] = [
  {
    group: "AI・機械学習",
    topics: [
      "AI / LLM全般",
      "AI Safety・アラインメント",
      "機械学習・ディープラーニング",
      "データサイエンス・統計",
      "自然言語処理(NLP)",
      "コンピュータビジョン",
      "画像・動画生成(拡散モデル)",
      "音声認識・音声合成",
      "強化学習",
      "AIエージェント・自動化",
      "MLOps・モデル運用",
      "レコメンドシステム",
      "AI倫理・規制",
      "ロボティクス",
    ],
  },
  {
    group: "プログラミング言語",
    topics: [
      "Python",
      "JavaScript・TypeScript",
      "Rust",
      "Go",
      "C・C++",
      "Java・Kotlin",
      "C#・.NET",
      "Swift",
      "Ruby",
      "関数型プログラミング",
      "WebAssembly",
    ],
  },
  {
    group: "Web・フロントエンド",
    topics: [
      "フロントエンド全般",
      "React・Next.js",
      "Vue・Svelte",
      "CSS・デザインシステム",
      "ブラウザ・Web標準",
      "パフォーマンス最適化",
    ],
  },
  {
    group: "バックエンド・アーキテクチャ",
    topics: [
      "バックエンド全般",
      "API設計(REST・GraphQL)",
      "マイクロサービス",
      "分散システム",
      "イベント駆動・メッセージング",
      "認証・認可",
    ],
  },
  {
    group: "インフラ・運用",
    topics: [
      "クラウド(AWS・GCP・Azure)",
      "DevOps・CI/CD",
      "コンテナ・Kubernetes",
      "IaC(Terraform等)",
      "監視・オブザーバビリティ",
      "ネットワーク",
      "SRE・信頼性",
    ],
  },
  {
    group: "データ",
    topics: [
      "データベース(RDB)",
      "NoSQL・分散DB",
      "データエンジニアリング",
      "データ基盤・分析基盤",
      "ベクトルDB・検索",
    ],
  },
  {
    group: "モバイル・ゲーム・ハード",
    topics: [
      "モバイルアプリ開発",
      "ゲーム開発",
      "グラフィックス・3D",
      "組み込み・IoT",
      "半導体・チップ設計",
      "OS・カーネル",
      "ハードウェア・自作",
    ],
  },
  {
    group: "セキュリティ・プライバシー",
    topics: [
      "セキュリティ全般",
      "暗号技術",
      "プライバシー・データ保護",
      "脆弱性・攻撃手法",
      "認証・ゼロトラスト",
    ],
  },
  {
    group: "CS基礎・理論",
    topics: [
      "アルゴリズム・データ構造",
      "数学(線形代数・確率・統計)",
      "コンパイラ・言語処理系",
      "計算理論・形式手法",
      "量子コンピュータ",
    ],
  },
  {
    group: "プロダクト・キャリア・社会",
    topics: [
      "スタートアップ・起業",
      "プロダクトマネジメント",
      "UX・デザイン",
      "オープンソース",
      "テックキャリア・働き方",
      "開発生産性・チーム",
      "テクノロジーと社会(倫理・民主主義)",
      "テック業界・大手動向",
      "暗号資産・ブロックチェーン",
      "フィンテック・投資×テック",
      "科学全般(宇宙・生物・物理)",
      "ガジェット・消費者向けテック",
    ],
  },
];

export interface LevelOption {
  value: number; // 1-5
  label: string;
  audience: string;
  example: string; // そのレベルで書いた本文の例
}

export const LEVELS: LevelOption[] = [
  {
    value: 1,
    label: "入門",
    audience: "ITはこれから。専門用語はほとんど分からない",
    example:
      "AIが、前に話した内容を覚えていられるようになりました。今までは会話のたびに忘れていましたが、これからは「この前の続き」ができます。人と話しているような自然なやり取りに近づきます。",
  },
  {
    value: 2,
    label: "初級",
    audience: "「アプリ・サーバー・データ」くらいは分かる",
    example:
      "AIに「記憶」の仕組みが加わりました。これまでは会話ごとにリセットされていましたが、過去のやり取りを保存して後から参照できます。毎回ゼロから説明し直す手間が減ります。",
  },
  {
    value: 3,
    label: "中級",
    audience: "普段からIT記事を読む。情報系の学生〜若手エンジニア",
    example:
      "LLMに長期メモリ機能が実装。従来はコンテキスト内の情報しか保持できなかったが、会話履歴を外部に保存して必要時に参照する。RAG的にユーザー文脈を永続化する形。",
  },
  {
    value: 4,
    label: "上級",
    audience: "現役エンジニア。仕組みや背景まで読みたい",
    example:
      "LLMの長期記憶を外部ベクトルストアへの非同期書き込みと検索で実現。会話ごとに embedding を生成・保存し、推論時に関連度の高い断片だけをコンテキストへ注入する。文脈保持とレイテンシのトレードオフ設計が肝。",
  },
  {
    value: 5,
    label: "エキスパート",
    audience: "研究者・上級エンジニア。最新の専門用語もそのままで良い",
    example:
      "長期記憶層を、書き込み時の embedding 生成と読み出し時の ANN 検索で構成。注入はトップ k に限定しテールレイテンシを抑える。課題は記憶の鮮度管理と、検索ノイズによるハルシネーション誘発のトレードオフ。",
  },
];
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npm test -- onboarding-data`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add app/lib/onboarding-data.ts tests/onboarding-data.test.ts
git commit -m "feat: add interest categories and level definitions"
```

---

## Task 9: completeOnboarding サーバーアクション

**Files:**
- Modify: `app/lib/actions.ts`

- [ ] **Step 1: アクションを追加する**

`app/lib/actions.ts` の先頭 import 群に追記し、末尾に関数を追加する。

import 追記:

```typescript
import { validateOnboardingInput } from "./onboarding-validation";
```

末尾に追加:

```typescript
export async function completeOnboarding(
  interests: Interest[],
  itLevel: number,
): Promise<void> {
  validateOnboardingInput(interests, itLevel);
  const now = new Date().toISOString();
  const { error } = await supabaseServer
    .from("user_profile")
    .update({
      interests,
      it_level: itLevel,
      onboarded_at: now,
      updated_at: now,
    })
    .eq("user_id", FIXED_USER_ID);
  if (error) throw error;
  revalidatePath("/");
}
```

> redirect はアクション内で呼ばない（クライアントの try/catch が NEXT_REDIRECT を握り潰すため）。保存成功後、クライアント側で `router.push("/")` する。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/lib/actions.ts
git commit -m "feat: add completeOnboarding server action"
```

---

## Task 10: オンボーディングウィザード（クライアント）

**Files:**
- Create: `app/onboarding/onboarding-wizard.tsx`

- [ ] **Step 1: 事前に Next.js 16 のクライアントナビゲーション仕様を確認**

`node_modules/next/dist/docs/` で `useRouter` / `router.push` の v16 仕様を確認する（`use client` 下での `next/navigation` からの import であること）。

- [ ] **Step 2: ウィザードを実装する**

```tsx
// app/onboarding/onboarding-wizard.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/app/lib/actions";
import {
  INTEREST_CATEGORIES,
  LEVELS,
  DEFAULT_INTEREST_WEIGHT,
} from "@/app/lib/onboarding-data";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(topic: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  function finish() {
    if (level == null) return;
    setError(null);
    const interests = Array.from(selected).map((topic) => ({
      topic,
      weight: DEFAULT_INTEREST_WEIGHT,
    }));
    startTransition(async () => {
      try {
        await completeOnboarding(interests, level);
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">ステップ {step} / 2</div>

      {step === 1 && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold">興味のある分野を選んでください</h1>
            <p className="text-sm text-muted-foreground">
              選んだ分野に合わせて、最初のタイムラインを組み立てます（後から設定で変更できます）。
            </p>
          </div>
          {INTEREST_CATEGORIES.map((g) => (
            <div key={g.group} className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">{g.group}</div>
              <div className="flex flex-wrap gap-2">
                {g.topics.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={selected.has(t) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleTopic(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={selected.size === 0}>
              次へ
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold">今の自分に近いレベルを選んでください</h1>
            <p className="text-sm text-muted-foreground">
              記事の本文を、選んだレベルの読みやすさで書きます。例文を見て選んでください。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={cn(
                  "text-left rounded-lg border p-3 transition-colors",
                  level === l.value
                    ? "border-primary bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">{l.label}</div>
                <div className="text-xs text-muted-foreground">{l.audience}</div>
                <p className="text-sm mt-2">{l.example}</p>
              </button>
            ))}
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
              戻る
            </Button>
            <Button onClick={finish} disabled={level == null || pending}>
              {pending ? "保存中…" : "はじめる"}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 4: コミット**

```bash
git add app/onboarding/onboarding-wizard.tsx
git commit -m "feat: add onboarding wizard client component"
```

---

## Task 11: オンボーディングページ（ゲート＋描画）

**Files:**
- Create: `app/onboarding/page.tsx`

- [ ] **Step 1: 事前に Next.js 16 の redirect 仕様を確認**

`node_modules/next/dist/docs/` で `redirect`（`next/navigation`）の v16 仕様を確認する。

- [ ] **Step 2: ページを実装する**

```tsx
// app/onboarding/page.tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/app/lib/profile";
import { isOnboarded } from "@/app/lib/onboarding-gate";
import { OnboardingWizard } from "./onboarding-wizard";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function OnboardingPage() {
  const profile = await getProfile(FIXED_USER_ID);
  if (isOnboarded(profile.onboarded_at)) {
    redirect("/");
  }
  return <OnboardingWizard />;
}
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 4: コミット**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: add onboarding page with completed-user redirect"
```

---

## Task 12: タイムラインにゲートを追加

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 未完了なら /onboarding へ redirect する**

`app/page.tsx` を次に変更（profile 取得＋ゲートを先頭に追加）。

```tsx
import { redirect } from "next/navigation";
import { getTimelineArticles } from "./lib/articles";
import { getProfile } from "./lib/profile";
import { isOnboarded } from "./lib/onboarding-gate";
import { ArticleCard } from "./components/article-card";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function TimelinePage() {
  const profile = await getProfile(FIXED_USER_ID);
  if (!isOnboarded(profile.onboarded_at)) {
    redirect("/onboarding");
  }

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

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 3: コミット**

```bash
git add app/page.tsx
git commit -m "feat: gate timeline behind onboarding"
```

---

## Task 13: オンボーディング中は Nav を隠す

**Files:**
- Modify: `app/components/nav.tsx`

- [ ] **Step 1: 事前に usePathname の仕様を確認**

`node_modules/next/dist/docs/` で `usePathname`（`next/navigation`）の v16 仕様を確認する。

- [ ] **Step 2: Nav を client 化し、/onboarding では非表示にする**

```tsx
// app/components/nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/onboarding")) return null;

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

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: 型エラーなし

- [ ] **Step 4: コミット**

```bash
git add app/components/nav.tsx
git commit -m "feat: hide nav during onboarding"
```

---

## Task 14: 手動エンドツーエンド確認

**Files:** （変更なし。ブラウザで動作確認）

前提: Task 1 のマイグレーションが DB に適用済みであること。`.env.local` に Supabase の接続情報があること。

- [ ] **Step 1: 未完了状態にリセット**

Run: `npm run seed`
Expected: `profile reset to pre-onboarding state` が出る

- [ ] **Step 2: 全テストを通す**

Run: `npm test`
Expected: 追加した5ファイルのテストが全て PASS

- [ ] **Step 3: 開発サーバーを起動して通しで確認**

Run: `npm run dev`

ブラウザで以下を確認:
1. `/` を開くと `/onboarding` に飛ぶ
2. オンボーディング中は上部 Nav が出ない
3. 興味を0個だと「次へ」が押せない／1個以上で押せる
4. ステップ2でレベルを選ぶと例文付きで選択状態になる／選ぶまで「はじめる」が押せない
5. 「はじめる」でタイムライン（`/`）に戻る。Nav が再表示される
6. `/settings` を開くと、選んだ興味が重み7で入っている
7. `/onboarding` を再度開くと `/` に飛ばされる（完了済みのため）

- [ ] **Step 4: （任意）難易度の反映を確認**

`npm run batch` を実行できる環境なら、オンボーディング後にバッチを回し、新規記事の本文が選んだレベルの難易度感になっているかを確認する。コストがかかるので任意。

- [ ] **Step 5: 最終コミット（もし未コミットの調整があれば）**

```bash
git status
```

---

## 完了の定義

- `npm test` が全て PASS（difficulty / scoring-prompt / onboarding-gate / onboarding-validation / onboarding-data）
- `npx tsc --noEmit` が型エラーなし
- 手動確認（Task 14 Step 3）の7項目が全て通る
- マイグレーションが DB に適用済み
