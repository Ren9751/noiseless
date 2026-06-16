import { JSDOM } from "jsdom";
import type { RawEntry } from "../lib/types";

export function parseArxivAtom(xml: string, sourceId: string): RawEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const entries = Array.from(doc.querySelectorAll("entry"));
  return entries.map((entry): RawEntry => {
    const title = (entry.querySelector("title")?.textContent ?? "").trim().replace(/\s+/g, " ");
    const summary = (entry.querySelector("summary")?.textContent ?? "").trim().replace(/\s+/g, " ");
    const url = entry.querySelector("link[rel='alternate']")?.getAttribute("href") ?? "";
    const published = entry.querySelector("published")?.textContent?.trim() ?? null;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: {},
      published_at: published,
      body_hint: summary,
    };
  });
}

// P3 の決定により cs.CY（Computers and Society）のみ。サラッと読める社会・倫理寄りに絞る。
export const DEFAULT_ARXIV_CATEGORIES = ["cs.CY"];

export async function fetchArxiv(
  sourceId: string,
  categories: string[],
): Promise<RawEntry[]> {
  const query = categories.map((c) => `cat:${c}`).join("+OR+");
  const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=30`;
  // arxiv は無記名リクエストを 429 で弾きやすいので、自分を名乗る
  const res = await fetch(url, {
    headers: { "User-Agent": "noiseless/1.0 (https://noiseless-black.vercel.app)" },
  });
  if (!res.ok) throw new Error(`arxiv fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseArxivAtom(xml, sourceId);
}
