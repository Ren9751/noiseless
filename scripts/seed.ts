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

  // user_profile を upsert（オンボーディング前のまっさら状態）
  const interests: { topic: string; weight: number }[] = [];
  const specialRules = "";

  const { error: profileError } = await supabase
    .from("user_profile")
    .upsert({
      user_id: user.id,
      interests,
      special_rules: specialRules,
      it_level: null,
      onboarded_at: null,
    });
  if (profileError) throw profileError;
  console.log("profile reset to pre-onboarding state");

  // 初期 sources
  const sources = [
    { user_id: user.id, kind: "hatena", config: {}, enabled: true },
    { user_id: user.id, kind: "hackernews", config: {}, enabled: true },
    { user_id: user.id, kind: "arxiv", config: { categories: ["cs.CY"] }, enabled: true },
    // --- RSS（フィード提供分のみ使用）---
    { user_id: user.id, kind: "rss", config: { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "The Markup", url: "https://themarkup.org/feeds/rss.xml" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" }, enabled: true },
    { user_id: user.id, kind: "rss", config: { name: "WIRED Japan", url: "https://wired.jp/feed/rss" }, enabled: true },
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
