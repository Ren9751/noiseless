"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/app/lib/actions";
import {
  INTEREST_CATEGORIES,
  LEVELS,
  DEFAULT_INTEREST_WEIGHT,
} from "@/app/lib/onboarding-data";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(topic: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  function finish() {
    if (level == null) return;
    setError(null);
    const chosenLevel = level;
    const interests = Array.from(selected).map((topic) => ({
      topic,
      weight: DEFAULT_INTEREST_WEIGHT,
    }));
    startTransition(async () => {
      try {
        await completeOnboarding(interests, chosenLevel);
        // 初回フィードを裏で取得開始（投げっぱなし。画面遷移しても keepalive で継続）
        fetch("/api/initial-batch", { method: "POST", keepalive: true }).catch(() => {});
        router.push("/");
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    });
  }

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">ステップ {step} / 2</div>

      {step === 1 && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold">興味のある分野を選んでください</h1>
            <p className="text-sm text-muted-foreground">
              選んだ分野に合わせて、最初のタイムラインを組み立てます（後から設定で変更できます）。
            </p>
          </div>
          {INTEREST_CATEGORIES.map((g) => (
            <div key={g.group} className="flex flex-col gap-2">
              <div className="text-xs font-medium text-muted-foreground">{g.group}</div>
              <div className="flex flex-wrap gap-2">
                {g.topics.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={selected.has(t) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleTopic(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setStep(2)} disabled={selected.size === 0}>
              次へ
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold">今の自分に近いレベルを選んでください</h1>
            <p className="text-sm text-muted-foreground">
              記事の本文を、選んだレベルの読みやすさで書きます。例文を見て選んでください。
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={cn(
                  "text-left rounded-lg border p-3 transition-colors",
                  level === l.value
                    ? "border-primary bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="font-medium">{l.label}</div>
                <div className="text-xs text-muted-foreground">{l.audience}</div>
                <p className="text-sm mt-2">{l.example}</p>
              </button>
            ))}
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
              戻る
            </Button>
            <Button onClick={finish} disabled={level == null || pending}>
              {pending ? "保存中…" : "はじめる"}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
