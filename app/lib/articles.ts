import "server-only";
import { supabaseServer } from "./supabase-server";
import { balanceByGroup } from "./article-utils";

export { sortByFinalScore, mergeLikedFlag } from "./article-utils";

// 「今日のニュース」を見せたいので、直近に取得した記事だけを対象にする。
// これを入れないと、全期間で最高スコアの少数の古い記事がフィード先頭に
// 居座り続け、毎日同じ顔ぶれになってしまう（新着はほぼ8点で下に埋もれる）。
// バッチは毎日回るので、48時間あれば直近1〜2回ぶんを安定して拾える。
const RECENT_WINDOW_HOURS = 48;

export interface TimelineArticle {
  id: string;
  url: string;
  title: string;
  title_ja: string | null;
  summary: string | null;
  score_reason: string | null;
  prompt_score: number;
  final_score: number;
  matched_topic: string | null;
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
  const cutoff = new Date(
    Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows, error } = await supabaseServer
    .from("article_scores")
    .select(
      `
      prompt_score,
      final_score,
      score_reason,
      title_ja,
      matched_topic,
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
    .gte("article.fetched_at", cutoff)
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

  const articles = (rows ?? []).map((r): TimelineArticle => {
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
      matched_topic: (r as { matched_topic: string | null }).matched_topic,
      source_kind: article.source.kind,
      source_name:
        (article.source.config as { name?: string } | null)?.name ?? null,
      image_url: article.image_url,
      raw_metadata: article.raw_metadata ?? {},
      fetched_at: article.fetched_at,
      liked: likedIds.has(article.id),
    };
  });

  // T6: 興味グループ単位で均等になるよう並べ替える（特定カテゴリの埋め尽くし防止）。
  return balanceByGroup(articles);
}
