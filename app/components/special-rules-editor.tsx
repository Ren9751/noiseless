"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSpecialRules } from "@/app/lib/actions";

export function SpecialRulesEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateSpecialRules(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="例: Claude Code に関する記事はスコア 9 以上にする"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
