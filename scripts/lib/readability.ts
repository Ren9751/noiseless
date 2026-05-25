import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const MAX_LENGTH = 4000;

export async function extractBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; noiseless/0.1; +https://github.com/) ",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent) return null;
    const text = article.textContent.replace(/\s+/g, " ").trim();
    return text.slice(0, MAX_LENGTH);
  } catch {
    return null;
  }
}
