import "server-only";
import { supabaseServer } from "./supabase-server";

export interface Interest {
  topic: string;
  weight: number;
}

export interface UserProfile {
  user_id: string;
  interests: Interest[];
  special_rules: string;
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabaseServer
    .from("user_profile")
    .select("user_id, interests, special_rules")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  if (!Array.isArray(data.interests)) {
    throw new Error("user_profile.interests must be an array");
  }
  return data as UserProfile;
}
