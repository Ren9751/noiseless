import { supabase } from "./lib/supabase";
import { getAnthropic, HAIKU_MODEL } from "./lib/llm";

function hasJapanese(text: string): boolean {
  return /[぀-ヿ㐀-鿿]/.test(text);
}

async function translateTitle(title: string): Promise<string> {
  const response = await getAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 200,
    system:
      "ニュース記事の英語タイトルを、内容に即した自然な日本語タイトルに意訳します。25〜60字程度。終止符不要、絵文字禁止。「Turing-Complete」「Machine Learning」「LLM」など確立された訳語・カタカナ語は適切に使う。返答は日本語タイトルのみ、説明や引用符は不要。",
    messages: [{ role: "user", content: title }],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("unexpected response");
  return content.text.trim().replace(/^["「]|["」]$/g, "");
}

async function main() {
  const { data: rows, error } = await supabase
    .from("article_scores")
    .select("article_id, user_id, article:articles!inner(title)")
    .is("title_ja", null);
  if (error) throw error;
  console.log(`backfill 対象: ${rows?.length ?? 0} 件`);

  let translated = 0;
  let copied = 0;
  for (const r of rows ?? []) {
    const title = (r.article as unknown as { title: string }).title;
    let title_ja: string;
    if (hasJapanese(title)) {
      title_ja = title;
      copied++;
    } else {
      title_ja = await translateTitle(title);
      translated++;
    }
    const { error: updateErr } = await supabase
      .from("article_scores")
      .update({ title_ja })
      .eq("article_id", r.article_id)
      .eq("user_id", r.user_id);
    if (updateErr) {
      console.error(`update failed for ${r.article_id}:`, updateErr);
      continue;
    }
    console.log(`  ${title.slice(0, 50)} -> ${title_ja.slice(0, 50)}`);
  }
  console.log(`done. copied=${copied}, translated=${translated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
