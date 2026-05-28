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
