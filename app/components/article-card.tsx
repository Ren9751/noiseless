import { Card } from "@/components/ui/card";
import type { TimelineArticle } from "@/app/lib/articles";
import { relativeTime, sourceLabel } from "@/app/lib/article-utils";
import { LikeButton } from "./like-button";

export function ArticleCard({ article }: { article: TimelineArticle }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">[{sourceLabel(article.source_kind)}]</span>
        <span>{relativeTime(article.fetched_at)}</span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-semibold leading-snug hover:underline"
      >
        {article.title_ja ?? article.title}
      </a>
      {article.title_ja && article.title_ja !== article.title && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          原題: {article.title}
        </p>
      )}

      {article.summary && (
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {article.summary}
        </p>
      )}

      {article.score_reason && (
        <p className="text-xs text-muted-foreground italic">
          評価: {article.score_reason}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <LikeButton articleId={article.id} initiallyLiked={article.liked} />
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:underline truncate max-w-[60%]"
        >
          {new URL(article.url).hostname}
        </a>
      </div>
    </Card>
  );
}
