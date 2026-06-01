import { redirect } from "next/navigation";
import { getProfile } from "@/app/lib/profile";
import { isOnboarded } from "@/app/lib/onboarding-gate";
import { OnboardingWizard } from "./onboarding-wizard";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

// オンボ済みかどうかの判定は最新のプロフィール次第なので、静的キャッシュさせず毎回判定する。
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await getProfile(FIXED_USER_ID);
  if (isOnboarded(profile.onboarded_at)) {
    redirect("/");
  }
  return <OnboardingWizard />;
}
