"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const POLL_MS = 12000;
const MAX_POLLS = 15;

export function PreparingFeed() {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  const exhausted = polls >= MAX_POLLS;

  useEffect(() => {
    if (exhausted) return;
    const t = setTimeout(() => {
      router.refresh();
      setPolls((n) => n + 1);
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [polls, exhausted, router]);

  function retry() {
    fetch("/api/initial-batch", { method: "POST" }).catch(() => {});
    setPolls(0);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto p-8 text-center flex flex-col items-center gap-4">
      {!exhausted ? (
        <>
          <div className="h-6 w-6 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
          <p className="text-muted-foreground">初回の記事を集めています…</p>
          <p className="text-xs text-muted-foreground">
            少しお待ちください（用意できると自動で表示されます）
          </p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">まだ記事が集まっていません。</p>
          <Button onClick={retry}>再試行</Button>
        </>
      )}
    </div>
  );
}
