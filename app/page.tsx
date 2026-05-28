import { redirect } from "next/navigation";
import { getTimelineArticles } from "./lib/articles";
import { getProfile } from "./lib/profile";
import { isOnboarded } from "./lib/onboarding-gate";
import { ArticleCard } from "./components/article-card";
import { PreparingFeed } from "./components/preparing-feed";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function TimelinePage() {
  const profile = await getProfile(FIXED_USER_ID);
  if (!isOnboarded(profile.onboarded_at)) {
    redirect("/onboarding");
  }

  const articles = await getTimelineArticles(FIXED_USER_ID, 50);

  if (articles.length === 0) {
    return <PreparingFeed />;
  }

  return (
    <main className="max-w-2xl mx-auto p-4 flex flex-col gap-3">
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
      <div className="text-center text-xs text-muted-foreground py-8">
        ── 今日は以上です ──
      </div>
    </main>
  );
}
