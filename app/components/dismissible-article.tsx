"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TimelineArticle } from "@/app/lib/articles";
import { toggleDislike } from "@/app/lib/actions";
import { ArticleCard } from "./article-card";

// T10: タイムライン用の記事ラッパー。「興味なし」を押すとその場で細いスタブに畳む
// （楽観的・即フィードバック）。除外の確定は次回ロード時、Undo はこのスタブから可能。
export function DismissibleArticle({ article }: { article: TimelineArticle }) {
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  // next=畳む / false=戻す。toggleDislike は「現在の状態」を取るので !next を渡す。
  // 失敗したら表示を元に戻す（楽観的更新のロールバック）。
  function setDismiss(next: boolean) {
    setDismissed(next);
    startTransition(async () => {
      try {
        await toggleDislike(article.id, !next);
      } catch {
        setDismissed(!next);
      }
    });
  }

  if (dismissed) {
    return (
      <Card className="p-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>「興味なし」にしました</span>
        <Button variant="ghost" size="sm" onClick={() => setDismiss(false)}>
          取り消す
        </Button>
      </Card>
    );
  }

  return (
    <ArticleCard
      article={article}
      dislikeControl={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismiss(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="興味なし"
        >
          興味なし
        </Button>
      }
    />
  );
}
