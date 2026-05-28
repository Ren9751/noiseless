import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabase-server";
import { runInitialBatch } from "@/scripts/lib/initial-batch";

export const maxDuration = 60;

const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";
const ARTICLE_GUARD = 5;

export async function POST() {
  try {
    const { data: profile } = await supabaseServer
      .from("user_profile")
      .select("onboarded_at")
      .eq("user_id", FIXED_USER_ID)
      .single();
    if (!profile?.onboarded_at) {
      return NextResponse.json({ skipped: "not onboarded" });
    }

    const { count } = await supabaseServer
      .from("article_scores")
      .select("article_id", { count: "exact", head: true })
      .eq("user_id", FIXED_USER_ID);
    if ((count ?? 0) >= ARTICLE_GUARD) {
      return NextResponse.json({ skipped: "already has articles" });
    }

    const saved = await runInitialBatch({ userId: FIXED_USER_ID, limit: 10 });
    return NextResponse.json({ saved });
  } catch (e) {
    console.error("initial-batch route failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
