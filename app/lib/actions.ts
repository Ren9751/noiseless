"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase-server";

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
}
