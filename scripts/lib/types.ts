export type SourceKind = "hatena" | "hackernews" | "reddit" | "rss" | "arxiv";

export interface SourceRow {
  id: string;
  user_id: string;
  kind: SourceKind;
  config: Record<string, unknown>;
  enabled: boolean;
}

// fetcher が返す生エントリ（DB保存前）
export interface RawEntry {
  source_id: string;
  url: string;
  title: string;
  raw_metadata: Record<string, unknown>;
  published_at: string | null;
  // 本文。RSS や arXiv は最初から content を持つことがある。
  body_hint?: string | null;
}

// 本文抽出後
export interface ArticleWithBody extends RawEntry {
  body_excerpt: string;
}

// スコアリング結果
export interface ScoringResult {
  prompt_score: number;
  summary: string;
  score_reason: string;
}

// DB 書き込み用にまとめた最終形
export interface ScoredArticle extends ArticleWithBody {
  scoring: ScoringResult;
}
