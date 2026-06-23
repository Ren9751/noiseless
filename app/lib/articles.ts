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

type ScoreRow = {
  prompt_score: number;
  final_score: number;
  score_reason: string | null;
  title_ja: string | null;
  matched_topic: string | null;
  article: ArticleRow;
};

// article_scores ＋ 記事本体の共通 select。タイムラインといいね一覧で使い回す。
const SCORE_SELECT = `
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
`;

function toTimelineArticle(r: ScoreRow, liked: boolean): TimelineArticle {
  const article = r.article;
  return {
    id: article.id,
    url: article.url,
    title: article.title,
    title_ja: r.title_ja,
    summary: article.summary,
    score_reason: r.score_reason,
    prompt_score: r.prompt_score,
    final_score: r.final_score,
    matched_topic: r.matched_topic,
    source_kind: article.source.kind,
    source_name: (article.source.config as { name?: string } | null)?.name ?? null,
    image_url: article.image_url,
    raw_metadata: article.raw_metadata ?? {},
    fetched_at: article.fetched_at,
    liked,
  };
}

export async function getTimelineArticles(
  userId: string,
  limit = 50,
): Promise<TimelineArticle[]> {
  const cutoff = new Date(
    Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabaseServer
    .from("article_scores")
    .select(SCORE_SELECT)
    .eq("user_id", userId)
    .gte("article.fetched_at", cutoff)
    .order("final_score", { ascending: false })
    .order("computed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ScoreRow[];
  if (rows.length === 0) return [];

  const articleIds = rows.map((r) => r.article.id);
  const [{ data: likes }, { data: dislikes }] = await Promise.all([
    supabaseServer
      .from("likes")
      .select("article_id")
      .eq("user_id", userId)
      .in("article_id", articleIds),
    // T10: 「興味なし」にした記事はタイムラインから除外する。
    supabaseServer
      .from("dislikes")
      .select("article_id")
      .eq("user_id", userId)
      .in("article_id", articleIds),
  ]);
  const likedIds = new Set((likes ?? []).map((l) => l.article_id as string));
  const dislikedIds = new Set((dislikes ?? []).map((d) => d.article_id as string));

  const articles = rows
    .filter((r) => !dislikedIds.has(r.article.id))
    .map((r) => toTimelineArticle(r, likedIds.has(r.article.id)));

  // T6: 興味グループ単位で均等になるよう並べ替える（特定カテゴリの埋め尽くし防止）。
  return balanceByGroup(articles);
}

// T3: いいね（＝あとで見るブックマーク）一覧。48時間ウィンドウは無視し、
// いいねした新しい順に全件返す。古くなっても消えない（T1の掃除はいいねを残す）。
export async function getLikedArticles(userId: string): Promise<TimelineArticle[]> {
  const { data: likeRows, error: likeErr } = await supabaseServer
    .from("likes")
    .select("article_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (likeErr) throw likeErr;

  const order = (likeRows ?? []).map((l) => l.article_id as string);
  if (order.length === 0) return [];

  const { data, error } = await supabaseServer
    .from("article_scores")
    .select(SCORE_SELECT)
    .eq("user_id", userId)
    .in("article_id", order);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ScoreRow[];

  const byId = new Map<string, TimelineArticle>();
  for (const r of rows) byId.set(r.article.id, toTimelineArticle(r, true));

  // いいねした順（新しい順）に整列して返す。
  return order
    .map((id) => byId.get(id))
    .filter((a): a is TimelineArticle => a != null);
}
