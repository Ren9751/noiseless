import "server-only";
import { supabaseServer } from "./supabase-server";

export { sortByFinalScore, mergeLikedFlag } from "./article-utils";

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

type ArticleRow = {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  raw_metadata: Record<string, unknown> | null;
  fetched_at: string;
  source: { kind: string };
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
