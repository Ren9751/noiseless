import { supabase } from "./supabase";
import { dedupeByUrl } from "./dedup";
import { insertScoredArticle } from "./persist-scored";
import { scoreArticle } from "./scoring";
import { fetchHatena } from "../fetchers/hatena";
import { fetchHackerNews } from "../fetchers/hackernews";
import { fetchArxiv, DEFAULT_ARXIV_CATEGORIES } from "../fetchers/arxiv";
import { fetchRss } from "../fetchers/rss";
import {
  buildScoringText,
  capByScore,
  interleaveBySource,
  mapWithConcurrency,
} from "./initial-batch-utils";
import type { ArticleWithBody, RawEntry, ScoredArticle, SourceRow } from "./types";

// 本文なしで採点する初回バッチは点が辛めに出るので、通常バッチより低い合格ラインにする
// （呼び水として数件を埋め、質は定時バッチが後から底上げする）
const SCORE_THRESHOLD = 4;
const CONCURRENCY = 8;
// Anthropic のレート枠（出力1万トークン/分）に収まるよう採点する候補数を絞る。
// CANDIDATE_LIMIT × max_tokens(1024) が 1万を超えないこと。
const CANDIDATE_LIMIT = 8;

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
        case "rss":
          return await fetchRss(s.id, (s.config as { url: string }).url);
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
  // レート制限内に収めるため、ソースを交互に拾って候補を絞る
  const candidates = interleaveBySource(fresh, CANDIDATE_LIMIT);
  console.log(
    `[initial-batch] fetched=${raw.length} fresh=${fresh.length} candidates=${candidates.length}`,
  );

  // 本文取得はしない: 採点テキストは body_hint ?? title
  const withBody: ArticleWithBody[] = candidates.map((e) => ({
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

  console.log(`[initial-batch] passedThreshold=${scored.length}`);
  const top = capByScore(scored, limit);
  console.log(`[initial-batch] willSave=${top.length}`);

  for (const article of top) {
    await insertScoredArticle(userId, article);
  }

  return top.length;
}
