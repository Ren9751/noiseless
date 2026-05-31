import "server-only";
import { supabaseServer } from "./supabase-server";

export { sortByFinalScore, mergeLikedFlag } from "./article-utils";

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

export async function getTimelineArticles(
  userId: string,
  limit = 50,
): Promise<TimelineArticle[]> {
  const { data: rows, error } = await supabaseServer
    .from("article_scores")
    .select(
      `
      prompt_score,
      final_score,
      score_reason,
      title_ja,
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
    `,
    )
    .eq("user_id", userId)
    .order("final_score", { ascending: false })
    .order("computed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const articleIds = (rows ?? []).map((r) => (r.article as unknown as ArticleRow).id);
  const { data: likes } = await supabaseServer
    .from("likes")
    .select("article_id")
    .eq("user_id", userId)
    .in(
      "article_id",
      articleIds.length > 0 ? articleIds : ["00000000-0000-0000-0000-000000000000"],
    );
  const likedIds = new Set((likes ?? []).map((l) => l.article_id as string));

  return (rows ?? []).map((r): TimelineArticle => {
    const article = r.article as unknown as ArticleRow;
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
  });
}
