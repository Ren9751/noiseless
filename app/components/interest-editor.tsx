"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { updateInterests } from "@/app/lib/actions";
import type { Interest } from "@/app/lib/profile";

export function InterestEditor({ initial }: { initial: Interest[] }) {
  const [items, setItems] = useState<Interest[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<Interest>) {
    setItems((cur) => cur.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function add() {
    setItems((cur) => [...cur, { topic: "", weight: 5 }]);
  }

  function remove(index: number) {
    setItems((cur) => cur.filter((_, i) => i !== index));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateInterests(items.filter((i) => i.topic.trim() !== ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={it.topic}
            onChange={(e) => update(i, { topic: e.target.value })}
            placeholder="興味分野"
            className="flex-1"
          />
          <div className="flex items-center gap-2 w-48">
            <Slider
              value={[it.weight]}
              onValueChange={(v) =>
                update(i, { weight: Array.isArray(v) ? v[0] : v })
              }
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-sm w-6 text-right">{it.weight}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => remove(i)}>
            ×
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={add}>
          + 追加
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存"}
        </Button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}
