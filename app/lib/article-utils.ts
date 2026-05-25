export function sortByFinalScore<T extends { final_score: number; fetched_at: string }>(
  articles: T[],
): T[] {
  return [...articles].sort((a, b) => {
    if (b.final_score !== a.final_score) return b.final_score - a.final_score;
    return b.fetched_at.localeCompare(a.fetched_at);
  });
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
