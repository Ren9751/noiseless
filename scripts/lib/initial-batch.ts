import { supabase } from "./supabase";
import { dedupeByUrl } from "./dedup";
import { scoreArticle } from "./scoring";
import { fetchHatena } from "../fetchers/hatena";
import { fetchHackerNews } from "../fetchers/hackernews";
import { fetchArxiv } from "../fetchers/arxiv";
import { buildScoringText, capByScore, mapWithConcurrency } from "./initial-batch-utils";
import type { ArticleWithBody, RawEntry, ScoredArticle, SourceRow } from "./types";

const SCORE_THRESHOLD = 6;
const CONCURRENCY = 8;

async function fetchAllSources(sources: SourceRow[]): Promise<RawEntry[]> {
  const tasks = sources.map(async (s) => {
    try {
      switch (s.kind) {
        case "hatena":
          return await fetchHatena(s.id);
        case "hackernews":
          return await fetchHackerNews(s.id);
        case "arxiv":
          return await fetchArxiv(
            s.id,
            (s.config as { category?: string }).category ?? "cs.CY",
          );
        default:
          return [];
      }
    } catch (e) {
      console.error(`initial fetch failed for ${s.kind}:`, e);
      return [];
    }
  });
  return (await Promise.all(tasks)).flat();
}

async function filterNewUrls(entries: RawEntry[]): Promise<RawEntry[]> {
  if (entries.length === 0) return [];
  const urls = entries.map((e) => e.url);
  const { data } = await supabase.from("articles").select("url").in("url", urls);
  const existing = new Set((data ?? []).map((r) => r.url));
  return entries.filter((e) => !existing.has(e.url));
}

// オンボ直後の高速バッチ。本文取得はスキップし、並列採点して上位 limit 件を保存する。
// 保存件数を返す。
export async function runInitialBatch({
  userId,
  limit = 10,
}: {
  userId: string;
  limit?: number;
}): Promise<number> {
  const { data: profile, error: profErr } = await supabase
    .from("user_profile")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (profErr) throw profErr;

  const { data: sources, error: srcErr } = await supabase
    .from("sources")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (srcErr) throw srcErr;

  const raw = await fetchAllSources(sources as SourceRow[]);
  const fresh = await filterNewUrls(dedupeByUrl(raw));

  // 本文取得はしない: 採点テキストは body_hint ?? title
  const withBody: ArticleWithBody[] = fresh.map((e) => ({
    ...e,
    body_excerpt: buildScoringText(e),
  }));

  const scoringProfile = {
    interests: profile.interests,
    special_rules: profile.special_rules,
    it_level: profile.it_level ?? null,
  };

  const results = await mapWithConcurrency(withBody, CONCURRENCY, async (entry) => {
    try {
      const scoring = await scoreArticle(entry, scoringProfile);
      return { entry, scoring };
    } catch (e) {
      console.error(`initial scoring failed for ${entry.url}:`, e);
      return null;
    }
  });

  const scored: ScoredArticle[] = results
    .filter((r): r is NonNullable<typeof r> => r !== null && r.scoring.prompt_score >= SCORE_THRESHOLD)
    .map((r) => ({ ...r.entry, scoring: r.scoring }));

  const top = capByScore(scored, limit);

  for (const article of top) {
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
      })
      .select("id")
      .single();
    if (insErr) {
      console.error(`initial article insert failed: ${article.url}`, insErr);
      continue;
    }
    const { error: scoreErr } = await supabase.from("article_scores").insert({
      article_id: inserted.id,
      user_id: userId,
      prompt_score: article.scoring.prompt_score,
      similarity_score: 0,
      final_score: article.scoring.prompt_score,
      score_reason: article.scoring.score_reason,
      title_ja: article.scoring.title_ja,
      is_serendipity: false,
    });
    if (scoreErr) {
      console.error(`initial article_scores insert failed: ${article.url}`, scoreErr);
    }
  }

  return top.length;
}
