"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleLike } from "@/app/lib/actions";

export function LikeButton({
  articleId,
  initiallyLiked,
}: {
  articleId: string;
  initiallyLiked: boolean;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !liked;
    setLiked(next);
    startTransition(async () => {
      try {
        await toggleLike(articleId, !next);
      } catch {
        setLiked(!next);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className={liked ? "text-red-500 hover:text-red-600" : ""}
      aria-pressed={liked}
      aria-label={liked ? "いいねを取り消す" : "いいね"}
    >
      {liked ? "♥" : "♡"}
    </Button>
  );
}
