import { difficultyInstruction } from "./difficulty";

export interface ScoringProfile {
  interests: Array<{ topic: string; weight: number }>;
  special_rules: string;
  it_level: number | null;
  // P6①: いいね学習。ユーザーが実際にいいねした記事タイトル（新しい順）。
  // 宣言した興味分野（interests）に加え、行動として現れた好みを採点に反映する。
  liked_titles?: string[];
  // T10: 「興味なし」にした記事タイトル（新しい順）。避けるべき傾向のネガティブシグナル。
  disliked_titles?: string[];
}

export function buildPrompt(profile: ScoringProfile): string {
  const interestsList = profile.interests
    .map((i) => `- ${i.topic} (重要度 ${i.weight}/10)`)
    .join("\n");

  // タイトルが溜まっている時だけ、見出し＋箇条書き＋採点指示のセクションを差し込む。
  // 改行の作法を1か所にまとめ、好み（いいね）と回避（興味なし）の両方で使い回す。
  const titleSection = (titles: string[] | undefined, heading: string, guidance: string) =>
    titles && titles.length > 0
      ? `
## ${heading}
${titles.map((t) => `- ${t}`).join("\n")}
${guidance}
`
      : "";

  // いいね＝好んだ例（A方式＝タイトル直接列挙）、「興味なし」＝避けた例（ネガティブシグナル）。
  const likedSection = titleSection(
    profile.liked_titles,
    "最近いいねした記事（ユーザーが実際に好んだ例）",
    "↑ これらと傾向（テーマ・切り口・粒度）が近い記事は、興味分野の重要度に加えて +1〜2 する。",
  );
  const dislikedSection = titleSection(
    profile.disliked_titles,
    "最近「興味なし」にした記事（ユーザーが避けた例）",
    "↑ これらと傾向が近い記事は -1〜2 する。ただし興味分野の重要度が高いものまで巻き込まないこと。",
  );

  return `あなたは「自分専用ニュースタイムライン」のキュレーターです。
記事を以下のユーザープロフィールに照らしてスコアリングし、日本語タイトルと X (旧Twitter) の投稿1個分の本文を生成してください。

## ユーザーの興味分野
${interestsList}

## 特別ルール
${profile.special_rules || "（なし）"}
${likedSection}${dislikedSection}
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
