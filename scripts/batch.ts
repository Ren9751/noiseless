import { supabase } from "./lib/supabase";
import { dedupeByUrl } from "./lib/dedup";
import { buildScoringText } from "./lib/initial-batch-utils";
import { insertScoredArticle } from "./lib/persist-scored";
import { fetchLikedTitles, fetchDislikedTitles } from "./lib/signal-titles";
import { scoreArticle } from "./lib/scoring";
import { fetchHatena } from "./fetchers/hatena";
import { fetchHackerNews } from "./fetchers/hackernews";
import { fetchArxiv, DEFAULT_ARXIV_CATEGORIES } from "./fetchers/arxiv";
import { fetchRss } from "./fetchers/rss";
import type {
  ArticleWithBody,
  RawEntry,
  ScoredArticle,
  SourceRow,
} from "./lib/types";

const SCORE_THRESHOLD = 6;

// T13: 「毎日読む分が必ずある」ように、1バッチで最低この件数は保存する。
// 閾値を超えた記事がこれに満たない日だけ、閾値未満から点数順に補充する。
const MIN_DAILY = 15;

// T1: 取得から何日より古い記事を消すか。表示は直近48時間なので、数日ぶんの
// バッファを持たせて 3 日。いいね済み（ブックマーク）の記事は対象外で残す。
const RETENTION_DAYS = 3;

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

// 本文スクレイプはしない。フィード提供分があればそれ、無ければタイトルで採点する。
function attachBody(entry: RawEntry): ArticleWithBody {
  return { ...entry, body_excerpt: buildScoringText(entry) };
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

  // 3. 採点テキストを用意（本文スクレイプはしない。記事は捨てない）
  const withBody: ArticleWithBody[] = newEntries.map(attachBody);
  console.log(`${withBody.length} entries ready for scoring`);

  // 4. スコアリング。全件の点数を保持し、後で「閾値以上＋最低件数」を選ぶ。
  //    P6①: いいねした記事を「好んだ例」、T10: 興味なしを「避けた例」として注入する。
  const [likedTitles, dislikedTitles] = await Promise.all([
    fetchLikedTitles(userId),
    fetchDislikedTitles(userId),
  ]);
  console.log(
    `${likedTitles.length} liked + ${dislikedTitles.length} disliked titles injected into scoring`,
  );

  const allScored: ScoredArticle[] = [];
  for (const entry of withBody) {
    try {
      const scoring = await scoreArticle(entry, {
        interests: profile.interests,
        special_rules: profile.special_rules,
        it_level: profile.it_level ?? null,
        liked_titles: likedTitles,
        disliked_titles: dislikedTitles,
      });
      allScored.push({ ...entry, scoring });
    } catch (e) {
      console.error(`scoring failed for ${entry.url}:`, e);
    }
  }

  // 閾値以上を採用。T13: それが MIN_DAILY に満たない時だけ、閾値未満から
  // 点数の高い順に補充して下限を満たす（採点が薄い日のフォールバック）。
  const above = allScored.filter((a) => a.scoring.prompt_score >= SCORE_THRESHOLD);
  let scored: ScoredArticle[] = above;
  if (above.length < MIN_DAILY) {
    const below = allScored
      .filter((a) => a.scoring.prompt_score < SCORE_THRESHOLD)
      .sort((a, b) => b.scoring.prompt_score - a.scoring.prompt_score);
    scored = [...above, ...below.slice(0, MIN_DAILY - above.length)];
  }
  console.log(
    `${above.length} above threshold; ${scored.length} selected (min ${MIN_DAILY})`,
  );

  // 5. DB 書き込み（articles + article_scores）。保存は両バッチ共通ヘルパに集約。
  for (const article of scored) {
    await insertScoredArticle(userId, article);
  }

  // 6. 古い記事の掃除（T1）。いいね済みは残す。
  //    article_scores は articles への ON DELETE CASCADE で自動的に消える。
  const retentionCutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: likedRows, error: likedErr } = await supabase
    .from("likes")
    .select("article_id");
  if (likedErr) throw likedErr;
  const likedIds = (likedRows ?? []).map((l) => l.article_id as string);

  let deleteQuery = supabase
    .from("articles")
    .delete()
    .lt("fetched_at", retentionCutoff);
  if (likedIds.length > 0) {
    deleteQuery = deleteQuery.not("id", "in", `(${likedIds.join(",")})`);
  }
  const { data: deleted, error: delErr } = await deleteQuery.select("id");
  if (delErr) {
    console.error("cleanup failed:", delErr);
  } else {
    console.log(
      `${deleted?.length ?? 0} old articles deleted (older than ${RETENTION_DAYS}d, liked kept)`,
    );
  }

  console.log("=== noiseless batch done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
