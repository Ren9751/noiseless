import { redirect } from "next/navigation";
import { getTimelineArticles } from "./lib/articles";
import { getProfile } from "./lib/profile";
import { isOnboarded } from "./lib/onboarding-gate";
import { DismissibleArticle } from "./components/dismissible-article";
import { PreparingFeed } from "./components/preparing-feed";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

// オンボーディングの出し分けは、リクエストごとに最新のプロフィールを見る必要がある。
// 静的キャッシュされると古い状態で固定されるため、毎回サーバーでレンダリングさせる。
export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const profile = await getProfile(FIXED_USER_ID);
  if (!isOnboarded(profile.onboarded_at)) {
    redirect("/onboarding");
  }

  const articles = await getTimelineArticles(FIXED_USER_ID, 50);

  if (articles.length === 0) {
    return <PreparingFeed />;
  }

  // 「いつのニュースか」を分かりやすくするため、上部に日付・曜日を表示する。
  // サーバーの時刻は UTC のことが多いので、JST を明示して計算する。
  const today = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col gap-3">
      <header className="pb-1">
        <p className="text-sm font-medium text-muted-foreground">{today}</p>
      </header>
      {articles.map((a) => (
        <DismissibleArticle key={a.id} article={a} />
      ))}
      <div className="text-center text-xs text-muted-foreground py-8">
        ── 今日は以上です ──
      </div>
    </main>
  );
}
