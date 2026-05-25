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
