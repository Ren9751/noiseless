import { supabase } from "./supabase";
import type { ScoredArticle } from "./types";

// 採点済み記事を articles + article_scores に保存する。
// 定時バッチ（batch.ts）と初回バッチ（initial-batch.ts）の共通保存経路。
// 採点に列を足すときはここ1か所だけ直せば両方に反映される。
export async function insertScoredArticle(
  userId: string,
  article: ScoredArticle,
): Promise<void> {
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
      image_url: article.image_url ?? null,
    })
    .select("id")
    .single();
  if (insErr) {
    console.error(`article insert failed: ${article.url}`, insErr);
    return;
  }

  const { error: scoreErr } = await supabase.from("article_scores").insert({
    article_id: inserted.id,
    user_id: userId,
    prompt_score: article.scoring.prompt_score,
    similarity_score: 0,
    final_score: article.scoring.prompt_score,
    score_reason: article.scoring.score_reason,
    title_ja: article.scoring.title_ja,
    matched_topic: article.scoring.matched_topic,
    is_serendipity: false,
  });
  if (scoreErr) {
    console.error(`article_scores insert failed: ${article.url}`, scoreErr);
  }
}
