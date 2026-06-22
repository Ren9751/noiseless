"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase-server";
import type { Interest } from "./profile";
import { validateOnboardingInput } from "./onboarding-validation";

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function toggleLike(articleId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabaseServer
      .from("likes")
      .delete()
      .eq("user_id", FIXED_USER_ID)
      .eq("article_id", articleId);
    if (error) throw error;
  } else {
    const { error } = await supabaseServer
      .from("likes")
      .insert({ user_id: FIXED_USER_ID, article_id: articleId });
    if (error && error.code !== "23505") throw error;
  }
  revalidatePath("/");
  revalidatePath("/likes");
}

export async function updateInterests(interests: Interest[]): Promise<void> {
  for (const i of interests) {
    if (typeof i.topic !== "string" || i.topic.trim() === "") {
      throw new Error("topic は空にできない");
    }
    if (!Number.isFinite(i.weight) || i.weight < 1 || i.weight > 10) {
      throw new Error("weight は 1〜10");
    }
  }
  const { error } = await supabaseServer
    .from("user_profile")
    .update({ interests, updated_at: new Date().toISOString() })
    .eq("user_id", FIXED_USER_ID);
  if (error) throw error;
  revalidatePath("/");
}

export async function updateSpecialRules(specialRules: string): Promise<void> {
  const { error } = await supabaseServer
    .from("user_profile")
    .update({ special_rules: specialRules, updated_at: new Date().toISOString() })
    .eq("user_id", FIXED_USER_ID);
  if (error) throw error;
  revalidatePath("/");
}

export async function completeOnboarding(
  interests: Interest[],
  itLevel: number,
): Promise<void> {
  validateOnboardingInput(interests, itLevel);
  const now = new Date().toISOString();
  const { error } = await supabaseServer
    .from("user_profile")
    .update({
      interests,
      it_level: itLevel,
      onboarded_at: now,
      updated_at: now,
    })
    .eq("user_id", FIXED_USER_ID);
  if (error) throw error;
  revalidatePath("/");
}
