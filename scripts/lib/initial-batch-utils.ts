import type { RawEntry } from "./types";

// 採点で LLM に送る本文の最大文字数。入力トークン＝コストの主因なので、
// 採点・要約に十分な長さ（おおむね 800 字）に切り詰める。
// 全ソース（rss / はてな / arXiv）がこの関数を通るので、ここが唯一の cap。
const MAX_SCORING_CHARS = 800;

// 本文取得をスキップする初回バッチ用: 採点に使うテキストを決める。
export function buildScoringText(entry: RawEntry): string {
  const hint = entry.body_hint?.trim();
  return hint && hint.length > 0 ? hint.slice(0, MAX_SCORING_CHARS) : entry.title;
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

// ソースを交互に拾って limit 件に絞る（特定ソースに偏らせない）。
export function interleaveBySource<T extends { source_id: string }>(
  entries: T[],
  limit: number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const e of entries) {
    const arr = groups.get(e.source_id);
    if (arr) arr.push(e);
    else groups.set(e.source_id, [e]);
  }
  const queues = Array.from(groups.values());
  const result: T[] = [];
  let i = 0;
  while (result.length < limit && queues.some((q) => q.length > 0)) {
    const q = queues[i % queues.length];
    const item = q.shift();
    if (item) result.push(item);
    i++;
  }
  return result;
}
