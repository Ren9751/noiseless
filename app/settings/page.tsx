import { getProfile } from "@/app/lib/profile";
import { InterestEditor } from "@/app/components/interest-editor";
import { SpecialRulesEditor } from "@/app/components/special-rules-editor";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export default async function SettingsPage() {
  const profile = await getProfile(FIXED_USER_ID);

  return (
    <main className="max-w-3xl mx-auto p-4 flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">興味分野</h2>
        <p className="text-sm text-muted-foreground">
          重要度 (1〜10) でスコアの基礎が決まります。次回バッチから反映されます。
        </p>
        <InterestEditor initial={profile.interests} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">特別ルール</h2>
        <p className="text-sm text-muted-foreground">
          スコアリングプロンプトに直接挿入される文字列。例外的なスコア調整に。
        </p>
        <SpecialRulesEditor initial={profile.special_rules} />
      </section>
    </main>
  );
}
