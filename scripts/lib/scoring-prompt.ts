import { difficultyInstruction } from "./difficulty";

export interface ScoringProfile {
  interests: Array<{ topic: string; weight: number }>;
  special_rules: string;
  it_level: number | null;
}

export function buildPrompt(profile: ScoringProfile): string {
  const interestsList = profile.interests
    .map((i) => `- ${i.topic} (重要度 ${i.weight}/10)`)
    .join("\n");

  return `あなたは「自分専用ニュースタイムライン」のキュレーターです。
記事を以下のユーザープロフィールに照らしてスコアリングし、日本語タイトルと X (旧Twitter) の投稿1個分の本文を生成してください。

## ユーザーの興味分野
${interestsList}

## 特別ルール
${profile.special_rules || "（なし）"}

## スコアリング基準
- 興味分野の重要度を基礎スコアとする (1-10)
- 内容が薄い速報は -1
- 複数の興味分野にまたがる記事は +1
- 全く関係ない内容は 1-3

## title_ja の要件
- 25〜60字程度の自然な日本語タイトル
- 原文タイトルが既に日本語ならそのまま使う
- 原文が英語等なら、内容に即した日本語タイトルに意訳する（直訳ではなく自然な日本語）
- 終止符不要、煽り・絵文字禁止

## X風本文 (summary) の要件
- 140〜280字
- ${difficultyInstruction(profile.it_level)}
- タイトルの言い換えではなく、本文の中身を踏まえる
- 「結論」「面白いポイント」「読む価値」のいずれかが伝わる
- 学術論文調（「〜の認識論」「〜性」「〜における〇〇」など抽象表現の連発）は禁止
- 抽象的な言い回しではなく、具体例や数字で書く
- 体言止め・断定はOK、絵文字・誇張・煽りは禁止

## score_reason の要件
- なぜそのスコアか、20〜40字で簡潔に

## matched_topic の要件
- 上の「ユーザーの興味分野」に挙げたトピック名の中から、この記事が最もよく当てはまるものを **1つだけ**、表記をそのまま選ぶ
- 複数に当てはまる場合は最も中心的な1つに絞る
- どれにも当てはまらない場合のみ "なし"

## 出力形式（JSON）
{
  "prompt_score": 数値,
  "title_ja": "日本語タイトル",
  "summary": "X風本文",
  "score_reason": "短い理由",
  "matched_topic": "興味分野のトピック名 または なし"
}`;
}
