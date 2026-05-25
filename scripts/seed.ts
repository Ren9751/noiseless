import { supabase } from "./lib/supabase";

async function main() {
  // 固定ユーザーを upsert
  const { data: user, error: userError } = await supabase
    .from("users")
    .upsert({ id: "00000000-0000-0000-0000-000000000001", display_name: "Me" })
    .select()
    .single();
  if (userError) throw userError;
  console.log("user:", user);

  // user_profile を upsert
  const interests = [
    { topic: "AI/LLM", weight: 10 },
    { topic: "Claude / Anthropic", weight: 10 },
    { topic: "プログラミング (Python, Web)", weight: 9 },
    { topic: "AI Safety", weight: 9 },
    { topic: "民主主義とテクノロジー", weight: 9 },
    { topic: "オープンソース", weight: 8 },
    { topic: "発達障害・特性", weight: 7 },
    { topic: "CS基礎 (アルゴリズム、数学)", weight: 7 },
    { topic: "セキュリティ", weight: 7 },
    { topic: "投資・金融", weight: 5 },
  ];
  const specialRules =
    "Claude Code に関する記事は必ずスコア 9 以上にする。芸能・エンタメ系のゴシップはスコア 1 にする。";

  const { error: profileError } = await supabase
    .from("user_profile")
    .upsert({
      user_id: user.id,
      interests,
      special_rules: specialRules,
    });
  if (profileError) throw profileError;
  console.log("profile updated");

  // 初期 sources
  const sources = [
    { user_id: user.id, kind: "hatena", config: {}, enabled: true },
    { user_id: user.id, kind: "hackernews", config: {}, enabled: true },
    { user_id: user.id, kind: "arxiv", config: { category: "cs.CY" }, enabled: true },
  ];
  // 既存と重複しないよう、kind 単位で upsert する代わりに、まず削除して入れ直す
  await supabase.from("sources").delete().eq("user_id", user.id);
  const { error: sourceError } = await supabase.from("sources").insert(sources);
  if (sourceError) throw sourceError;
  console.log(`${sources.length} sources inserted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
