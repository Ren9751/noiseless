import type { RawEntry } from "../lib/types";

interface AlgoliaHit {
  objectID: string;
  title: string;
  // Ask HN / Show HN(テキスト投稿) は url キー自体が無い(undefined)ことがある
  url?: string | null;
  points: number;
  num_comments: number;
  created_at: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

export function parseAlgoliaResponse(json: AlgoliaResponse, sourceId: string): RawEntry[] {
  return json.hits
    .filter((hit) => Boolean(hit.url))
    .map((hit): RawEntry => ({
      source_id: sourceId,
      url: hit.url as string,
      title: hit.title,
      raw_metadata: {
        points: hit.points,
        num_comments: hit.num_comments,
        hn_id: hit.objectID,
      },
      published_at: hit.created_at,
    }));
}

export async function fetchHackerNews(sourceId: string): Promise<RawEntry[]> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50",
  );
  if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`);
  const json = (await res.json()) as AlgoliaResponse;
  return parseAlgoliaResponse(json, sourceId);
}
