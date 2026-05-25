import { z } from "zod";
import { anthropic, HAIKU_MODEL } from "./llm";
import type { ArticleWithBody, ScoringResult } from "./types";

const SCORING_SCHEMA = z.object({
  prompt_score: z.number().int().min(1).max(10),
  title_ja: z.string(),
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
- 中学生でも内容が伝わる、平易で親しみやすい日本語
- タイトルの言い換えではなく、本文の中身を踏まえる
- 「結論」「面白いポイント」「読む価値」のいずれかが伝わる
- 学術論文調（「〜の認識論」「〜性」「〜における〇〇」など抽象表現の連発）は禁止
- 専門用語・カタカナ語の連発は避ける。使う場合は短く補足
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

  const content = response.content[0];
  if (content.type !== "text") throw new Error("unexpected response type");
  const text = content.text;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("no JSON in response: " + text);

  const parsed = JSON.parse(jsonMatch[0]);
  return SCORING_SCHEMA.parse(parsed);
}
