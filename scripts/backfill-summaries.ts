import { supabase } from "./lib/supabase";
import { anthropic, HAIKU_MODEL } from "./lib/llm";

const SYSTEM_PROMPT = `あなたはニュース記事の要約を作る人です。読者は技術や社会に興味を持つ一般の人で、専門家ではありません。
記事のタイトルと本文を読んで、X (旧Twitter) の投稿1個分の長さで分かりやすく紹介してください。

## 出力の要件
- 140〜280字
- 中学生でも内容が伝わる、平易で親しみやすい日本語
- タイトルの言い換えではなく、本文の中身を踏まえる
- 「結論」「面白いポイント」「読む価値」のいずれかが伝わる
- 学術論文調（「〜の認識論」「〜性」「〜における〇〇」など抽象表現の連発）は禁止
- 専門用語・カタカナ語の連発は避ける。使う場合は短く補足
- 抽象的な言い回しではなく、具体例や数字で書く
- 体言止め・断定はOK、絵文字・誇張・煽りは禁止
- 返答は本文のみ。前置きや「要約:」などのラベル不要`;

async function summarize(title: string, body: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `タイトル: ${title}\n\n本文抜粋:\n${body}` },
    ],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("unexpected response");
  return content.text.trim();
}

async function main() {
  const { data: rows, error } = await supabase
    .from("articles")
    .select("id, title, body_excerpt");
  if (error) throw error;
  console.log(`対象: ${rows?.length ?? 0} 件`);

  let count = 0;
  for (const r of rows ?? []) {
    if (!r.body_excerpt) {
      console.log(`  [skip] ${r.title.slice(0, 40)} (no body_excerpt)`);
      continue;
    }
    const newSummary = await summarize(r.title, r.body_excerpt);
    const { error: updateErr } = await supabase
      .from("articles")
      .update({ summary: newSummary })
      .eq("id", r.id);
    if (updateErr) {
      console.error(`update failed for ${r.id}:`, updateErr);
      continue;
    }
    count++;
    console.log(
      `[${count}] ${r.title.slice(0, 40)}\n  -> ${newSummary.slice(0, 100)}`,
    );
  }
  console.log(`done. updated ${count} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
