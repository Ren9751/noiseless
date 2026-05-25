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
