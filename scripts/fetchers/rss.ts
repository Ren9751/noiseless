import { JSDOM } from "jsdom";
import type { RawEntry } from "../lib/types";

// content:encoded などに含まれる HTML を素のテキストに落とし、長すぎる本文は切る。
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
}

// フィードが自ら提供する画像 URL を拾う（任意ページからのスクレイプはしない）。
function pickImage(item: Element): string | null {
  const enclosure = item.querySelector("enclosure");
  const encUrl = enclosure?.getAttribute("url");
  const encType = enclosure?.getAttribute("type") ?? "";
  if (encUrl && encType.startsWith("image")) return encUrl;

  const thumb = item.getElementsByTagName("media:thumbnail")[0];
  const thumbUrl = thumb?.getAttribute("url");
  if (thumbUrl) return thumbUrl;

  for (const mc of Array.from(item.getElementsByTagName("media:content"))) {
    const medium = mc.getAttribute("medium");
    const type = mc.getAttribute("type") ?? "";
    const u = mc.getAttribute("url");
    if (u && (medium === "image" || type.startsWith("image"))) return u;
  }
  return null;
}

export function parseRssFeed(
  xml: string,
  sourceId: string,
  limit = 15,
): RawEntry[] {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;

  // RSS 2.0 / RDF: <item>
  const items = Array.from(doc.querySelectorAll("item"));
  if (items.length > 0) {
    return items.slice(0, limit).map((item): RawEntry => {
      const title = item.querySelector("title")?.textContent?.trim() ?? "";
      const url = item.querySelector("link")?.textContent?.trim() ?? "";
      const date =
        item.querySelector("pubDate")?.textContent?.trim() ??
        item.getElementsByTagName("dc:date")[0]?.textContent?.trim() ??
        null;
      const encoded = item.getElementsByTagName("content:encoded")[0]?.textContent?.trim();
      const description = item.querySelector("description")?.textContent?.trim() ?? "";
      const body = encoded && encoded.length > 0 ? encoded : description;
      return {
        source_id: sourceId,
        url,
        title,
        raw_metadata: {},
        published_at: date,
        body_hint: stripHtml(body),
        image_url: pickImage(item),
      };
    });
  }

  // Atom: <entry>
  const entries = Array.from(doc.querySelectorAll("entry"));
  return entries.slice(0, limit).map((entry): RawEntry => {
    const title = (entry.querySelector("title")?.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const url =
      entry.querySelector("link[rel='alternate']")?.getAttribute("href") ??
      entry.querySelector("link")?.getAttribute("href") ??
      "";
    const date =
      entry.querySelector("published")?.textContent?.trim() ??
      entry.querySelector("updated")?.textContent?.trim() ??
      null;
    const content = entry.querySelector("content")?.textContent?.trim();
    const summary = entry.querySelector("summary")?.textContent?.trim() ?? "";
    const body = content && content.length > 0 ? content : summary;
    return {
      source_id: sourceId,
      url,
      title,
      raw_metadata: {},
      published_at: date,
      body_hint: stripHtml(body),
      image_url: pickImage(entry),
    };
  });
}

export async function fetchRss(
  sourceId: string,
  url: string,
  limit = 15,
): Promise<RawEntry[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "noiseless/1.0 (https://noiseless-black.vercel.app)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`rss fetch failed (${url}): ${res.status}`);
  const xml = await res.text();
  return parseRssFeed(xml, sourceId, limit);
}
