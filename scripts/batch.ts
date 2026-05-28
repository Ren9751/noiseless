import { supabase } from "./lib/supabase";
import { dedupeByUrl } from "./lib/dedup";
import { extractBody } from "./lib/readability";
import { scoreArticle } from "./lib/scoring";
import { fetchHatena } from "./fetchers/hatena";
import { fetchHackerNews } from "./fetchers/hackernews";
import { fetchArxiv, DEFAULT_ARXIV_CATEGORIES } from "./fetchers/arxiv";
import type {
  ArticleWithBody,
  RawEntry,
  ScoredArticle,
  SourceRow,
} from "./lib/types";

const SCORE_THRESHOLD = 6;

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
            (s.config as { categories?: string[] }).categories ?? DEFAULT_ARXIV_CATEGORIES,
          );
        default:
          console.warn(`unsupported source kind: ${s.kind}`);
          return [];
      }
    } catch (e) {
      console.error(`fetch failed for ${s.kind}:`, e);
      return [];
    }
  });
  const results = await Promise.all(tasks);
  return results.flat();
}

async function filterNewEntries(entries: RawEntry[]): Promise<RawEntry[]> {
  if (entries.length === 0) return [];
  const urls = entries.map((e) => e.url);
  const { data } = await supabase.from("articles").select("url").in("url", urls);
  const existing = new Set((data ?? []).map((r) => r.url));
  return entries.filter((e) => !existing.has(e.url));
}

async function attachBody(entry: RawEntry): Promise<ArticleWithBody | null> {
  // body_hint があるソース (arxiv, RSS) はそれを優先
  if (entry.body_hint && entry.body_hint.length > 200) {
    return { ...entry, body_excerpt: entry.body_hint };
  }
  const body = await extractBody(entry.url);
  if (!body) return null;
  return { ...entry, body_excerpt: body };
}

async function main() {
  console.log("=== noiseless batch start ===");

  // 1. user と source を取得 (固定ユーザー)
  const userId = "00000000-0000-0000-0000-000000000001";
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

  console.log(`profile loaded. ${sources!.length} sources enabled.`);

  // 2. 並列取得 + 重複排除 + 既存URL除外
  const rawEntries = await fetchAllSources(sources as SourceRow[]);
  console.log(`fetched ${rawEntries.length} raw entries`);
  const deduped = dedupeByUrl(rawEntries);
  const newEntries = await filterNewEntries(deduped);
  console.log(`${newEntries.length} new entries after dedup`);

  // 3. 本文取得 (失敗は捨てる)
  const withBody: ArticleWithBody[] = [];
  for (const entry of newEntries) {
    const enriched = await attachBody(entry);
    if (enriched) withBody.push(enriched);
  }
  console.log(`${withBody.length} entries with body`);

  // 4. スコアリング (閾値未満は捨てる)
  const scored: ScoredArticle[] = [];
  for (const entry of withBody) {
    try {
      const scoring = await scoreArticle(entry, {
        interests: profile.interests,
        special_rules: profile.special_rules,
        it_level: profile.it_level ?? null,
      });
      if (scoring.prompt_score >= SCORE_THRESHOLD) {
        scored.push({ ...entry, scoring });
      }
    } catch (e) {
      console.error(`scoring failed for ${entry.url}:`, e);
    }
  }
  console.log(`${scored.length} entries scored above threshold`);

  // 5. DB 書き込み (articles を upsert、article_scores を insert)
  for (const article of scored) {
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
      console.error(`article insert failed: ${article.url}`, insErr);
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
      console.error(`article_scores insert failed: ${article.url}`, scoreErr);
    }
  }

  console.log("=== noiseless batch done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
