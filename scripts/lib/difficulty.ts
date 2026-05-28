export const DEFAULT_LEVEL = 3;

// レベル(1-5) → X風本文の難易度指示。scoring プロンプトに差し込む。
export const DIFFICULTY_BY_LEVEL: Record<number, string> = {
  1: "想定読者は「ITをほぼ知らない人」。専門用語・カタカナ語は避け、使うなら必ず一言で補足する。日常の例えを使い、中学生でも分かる平易さにする",
  2: "想定読者は「アプリ・サーバー・データ程度の基本語が分かる人」。基本語は前提にし、少し難しい用語だけ短く補足する。高校生〜文系大学生に伝わる平易さにする",
  3: "想定読者は「普段からIT記事を読む人」。API・データベース・Git など一般的なIT用語は説明なしで使い、専門的な用語だけ軽く補足する",
  4: "想定読者は「現役エンジニア」。技術用語はそのまま使い、仕組みや背景に踏み込んだ表現も使ってよい",
  5: "想定読者は「研究者・上級エンジニア」。最新の専門用語や概念もそのまま使い、冗長な説明は省いて要点と含意を濃く短くまとめる",
};

export function resolveLevel(level: number | null | undefined): number {
  if (level == null || level < 1 || level > 5) return DEFAULT_LEVEL;
  return level;
}

export function difficultyInstruction(level: number | null | undefined): string {
  return DIFFICULTY_BY_LEVEL[resolveLevel(level)];
}
