import { INTEREST_CATEGORIES } from "./onboarding-data";

export function sortByFinalScore<T extends { final_score: number; fetched_at: string }>(
  articles: T[],
): T[] {
  return [...articles].sort((a, b) => {
    if (b.final_score !== a.final_score) return b.final_score - a.final_score;
    return b.fetched_at.localeCompare(a.fetched_at);
  });
}

// matched_topic（興味トピック）→ 所属グループ名 の対応表。
const TOPIC_TO_GROUP = new Map<string, string>(
  INTEREST_CATEGORIES.flatMap((g) => g.topics.map((t) => [t, g.group] as const)),
);

const NO_GROUP = "その他";

// 記事のタグから所属グループを引く。未タグ・未知トピックは「その他」。
export function groupOfTopic(topic: string | null): string {
  if (!topic) return NO_GROUP;
  return TOPIC_TO_GROUP.get(topic) ?? NO_GROUP;
}

// T6: 興味グループ単位で均等に並べ替える。
// 入力は final_score 降順を前提。グループごとのキューを作り、各ラウンドで
// 「先頭の点数が高いグループ順」に1件ずつ取り出す（＝高得点は上に残しつつ、
// 特定グループがフィードを埋め尽くさないようにする）。
export function balanceByGroup<
  T extends { final_score: number; matched_topic: string | null },
>(articles: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const a of articles) {
    const g = groupOfTopic(a.matched_topic);
    const arr = buckets.get(g);
    if (arr) arr.push(a);
    else buckets.set(g, [a]);
  }

  const result: T[] = [];
  while (result.length < articles.length) {
    const heads = [...buckets.values()]
      .filter((q) => q.length > 0)
      .sort((a, b) => b[0].final_score - a[0].final_score);
    for (const q of heads) result.push(q.shift()!);
  }
  return result;
}

export function mergeLikedFlag<T extends { id: string }>(
  articles: T[],
  likedIds: Set<string>,
): (T & { liked: boolean })[] {
  return articles.map((a) => ({ ...a, liked: likedIds.has(a.id) }));
}

export function sourceLabel(kind: string): string {
  switch (kind) {
    case "hatena":
      return "はてブ";
    case "hackernews":
      return "HN";
    case "arxiv":
      return "arXiv";
    case "reddit":
      return "Reddit";
    case "rss":
      return "RSS";
    default:
      return kind;
  }
}

export function relativeTime(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
