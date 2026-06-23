import { supabase } from "./supabase";

// P6①: いいねした記事の直近タイトルを採点プロンプトに「タイトル直接列挙」で注入するため、
// 新しい順に最大 limit 件の title_ja を返す。
export async function fetchLikedTitles(userId: string, limit = 20): Promise<string[]> {
  const { data: rows, error } = await supabase
    .from("likes")
    .select("article_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ids = (rows ?? []).map((r) => r.article_id as string);
  if (ids.length === 0) return [];

  const { data: scoreRows, error: scoreErr } = await supabase
    .from("article_scores")
    .select("article_id, title_ja")
    .eq("user_id", userId)
    .in("article_id", ids);
  if (scoreErr) throw scoreErr;

  const titleById = new Map<string, string>();
  for (const r of scoreRows ?? []) {
    if (r.title_ja) titleById.set(r.article_id as string, r.title_ja as string);
  }

  // いいねした新しい順を維持して返す（タイトルが無いものは落とす）。
  return ids
    .map((id) => titleById.get(id))
    .filter((t): t is string => Boolean(t));
}
