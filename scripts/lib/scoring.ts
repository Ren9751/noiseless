import { z } from "zod";
import { getAnthropic, HAIKU_MODEL } from "./llm";
import { buildPrompt, type ScoringProfile } from "./scoring-prompt";
import type { ArticleWithBody, ScoringResult } from "./types";

const SCORING_SCHEMA = z.object({
  prompt_score: z.number().int().min(1).max(10),
  title_ja: z.string(),
  summary: z.string(),
  score_reason: z.string(),
  // "なし"・空文字は「該当カテゴリなし」として null に正規化する（T6）
  matched_topic: z
    .string()
    .optional()
    .transform((t) => {
      const v = (t ?? "").trim();
      return v === "" || v === "なし" ? null : v;
    }),
});

// ひらがな・カタカナ・漢字を含むか（= 日本語タイトルとみなす）
function hasJapanese(text: string): boolean {
  return /[぀-ヿ㐀-鿿]/.test(text);
}

export async function scoreArticle(
  article: ArticleWithBody,
  profile: ScoringProfile,
): Promise<ScoringResult> {
  const userMessage = `タイトル: ${article.title}\n\n本文抜粋:\n${article.body_excerpt}`;

  const response = await getAnthropic().messages.create({
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

  const parsed = SCORING_SCHEMA.parse(JSON.parse(jsonMatch[0]));

  // 原文タイトルが既に日本語なら、意訳せず原文をそのまま使う（翻訳調の違和感を避ける）
  if (hasJapanese(article.title)) {
    parsed.title_ja = article.title;
  }

  return parsed;
}
