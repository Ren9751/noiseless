import { JSDOM } from "jsdom";
import type { RawEntry } from "../lib/types";

export function parseHatenaRss(xml: string, sourceId: string): RawEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const items = Array.from(doc.querySelectorAll("item"));
  return items.map((item): RawEntry => {
    const url = item.querySelector("link")?.textContent?.trim() ?? "";
    const title = item.querySelector("title")?.textContent?.trim() ?? "";
    const description = item.querySelector("description")?.textContent?.trim() ?? "";
    const date = item.getElementsByTagName("dc:date")[0]?.textContent?.trim() ?? null;
    const bookmarkText = item.getElementsByTagName("hatena:bookmarkcount")[0]?.textContent?.trim();
    const bookmarkcount = bookmarkText ? Number(bookmarkText) : 0;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: { bookmarkcount, description },
      published_at: date,
      body_hint: description,
    };
  });
}

export async function fetchHatena(sourceId: string): Promise<RawEntry[]> {
  const res = await fetch("https://b.hatena.ne.jp/hotentry.rss");
  if (!res.ok) throw new Error(`hatena fetch failed: ${res.status}`);
  const xml = await res.text();
  return parseHatenaRss(xml, sourceId);
}
