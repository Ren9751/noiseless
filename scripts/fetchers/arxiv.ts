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

export async function fetchArxiv(sourceId: string, category: string): Promise<RawEntry[]> {
  const url = `https://export.arxiv.org/api/query?search_query=cat:${encodeURIComponent(
    category,
  )}&sortBy=submittedDate&sortOrder=descending&max_results=30`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arxiv fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseArxivAtom(xml, sourceId);
}
