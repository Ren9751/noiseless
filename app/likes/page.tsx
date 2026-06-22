import { getLikedArticles } from "../lib/articles";
import { ArticleCard } from "../components/article-card";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

// いいねの増減を即反映したいので毎回サーバーでレンダリングする。
export const dynamic = "force-dynamic";

export default async function LikesPage() {
  const articles = await getLikedArticles(FIXED_USER_ID);

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col gap-3">
      <header className="pb-1">
        <p className="text-sm font-medium text-muted-foreground">
          いいねした記事{articles.length > 0 ? `（${articles.length}）` : ""}
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          まだいいねした記事はありません。
          <br />
          フィードで ♡ を押すと、ここに後から読める形で溜まっていきます。
        </p>
      ) : (
        articles.map((a) => <ArticleCard key={a.id} article={a} />)
      )}
    </main>
  );
}
