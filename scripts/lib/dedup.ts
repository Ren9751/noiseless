import type { RawEntry } from "./types";

export function dedupeByUrl(entries: RawEntry[]): RawEntry[] {
  const seen = new Set<string>();
  const result: RawEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    result.push(entry);
  }
  return result;
}
