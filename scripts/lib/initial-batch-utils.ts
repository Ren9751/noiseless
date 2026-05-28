import type { RawEntry } from "./types";

// 本文取得をスキップする初回バッチ用: 採点に使うテキストを決める。
export function buildScoringText(entry: RawEntry): string {
  const hint = entry.body_hint?.trim();
  return hint && hint.length > 0 ? hint : entry.title;
}

// prompt_score 降順で上位 limit 件に切り詰める。
export function capByScore<T extends { scoring: { prompt_score: number } }>(
  scored: T[],
  limit: number,
): T[] {
  return [...scored]
    .sort((a, b) => b.scoring.prompt_score - a.scoring.prompt_score)
    .slice(0, limit);
}

// 同時実行数を制限して fn を適用する（順序は保つ）。外部依存なし。
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  const workerCount = Math.min(Math.max(1, limit), items.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
