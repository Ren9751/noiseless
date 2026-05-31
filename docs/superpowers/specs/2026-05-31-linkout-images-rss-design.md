# noiseless 改修設計：リンクアウト化・画像・RSSソース拡張

- 作成日: 2026-05-31
- ステータス: 設計確定（実装計画づくりへ）
- 対象: 既存 Phase 1 MVP への 3 改修 ＋ 取得方針のリンクアウト化
- 関連: `2026-05-18-noiseless-design.md`（大本の設計書）

---

## 背景

Phase 1 MVP は稼働中。本改修は以下の 3 つの要望と、それに伴う取得方針の見直しをまとめたもの。

- #1 更新を朝 1 回だけにする
- #2 タイムラインに画像を表示する
- #3 RSS ソースを増やす（GIGAZINE ほか、おすすめ多数）

検討の過程で「本文をどう取得しているか／アプリ化（多人数提供）したときに法的にグレーではないか」という論点が出た。結論として、**全文スクレイプをやめ、フィードが配信した分だけ使う「リンクアウト型」に寄せる**方針を採用する。これは公開目標・コスト・法的安全性の 3 つと整合する。

---

## 取得方針：リンクアウト型へ

### 現状（2 層構造）

- **第 1 層（記事一覧）**: はてブ RSS / HN Algolia API / arXiv API。発行元が機械可読として公開しているもの＝正規。**変更しない**。
- **第 2 層（本文）**: `scripts/lib/readability.ts` が元記事ページを `fetch` し HTML 全体を取得 → Readability で本文抽出 → 最大 4000 字を `articles.body_excerpt` に保存 → Claude に渡して要約生成。

### 問題点（第 2 層）

- robots.txt / 各サイト ToS を確認せず取得している
- 本文 4000 字を自 DB に保存＝複製にあたり得る
- 派生要約を第三者に配信＝再配布の論点

個人利用なら低リスク（私的利用）。だが多人数提供では第 2 層がグレー〜黒寄りになる。

### 採用方針

**全文スクレイプを廃止し、フィード提供分だけを使う。**

- 線引き：「RSS の `<description>` / `<content>` は発行元が配信用に出した分＝使ってよい」「任意ページの全文スクレイプ＝行わない」。
- 表示は「タイトル ＋ AI 一言（X 風本文）＋ 元記事リンク」。トラフィックを発行元へ返すリンクアウト型（Google News / Techmeme / HN と同型）。
- 副次効果：本文 4000 字を LLM に送らなくなるため入力トークンが大幅減＝コスト減。

> 注記：これは実務上のリスク低減策であり、法的助言ではない。本格公開時は各サイトの規約確認を別途行う。

---

## 設計詳細

### #1 朝だけ更新

- `.github/workflows/batch.yml` の cron 2 本のうち、夜（`0 12 * * *` = 21:00 JST）を削除。
- 朝 6:00 JST（`0 21 * * *`）の 1 本だけ残す。`workflow_dispatch` は維持。
- ロジック変更なし。

### #2 画像（サムネ型レイアウト）

- **DB**: 新規マイグレーションで `articles.image_url text`（NULL 可）を追加。
- **取得**: フィードが自ら提供する画像のみ採用。
  - RSS: `enclosure` / `media:thumbnail` / `media:content` を見る。
  - はてブ RSS: 画像要素があれば拾う。
  - HN / arXiv: 画像なし → NULL。
  - **任意ページからの `og:image` 抜き取りは行わない**（リンクアウト方針）。
- **表示**: `app/components/article-card.tsx` を「左サムネ ＋ 右テキスト」のコンパクト行レイアウトに変更。`image_url` が NULL なら従来どおりテキストのみ。素の `<img loading="lazy">` を使用（Next/Image の remotePatterns 設定を避ける、KISS）。
- **データ経路**: `TimelineArticle` 型と `app/lib/articles.ts` のクエリに `image_url` を追加。

### #3 RSS ソース拡張

- **新規フェッチャー** `scripts/fetchers/rss.ts`
  - RSS 2.0（`<item>`: title / link / pubDate / description / content:encoded）と Atom（`<entry>`: title / link[href] / published / summary / content）の両対応。
  - フィード提供の本文を `body_hint` に格納。
  - 画像（enclosure / media:*）を抽出し `raw_metadata.image_url` に格納。
  - 1 フィードあたり最新 15 件まで（記事量と LLM コストの上振れ防止）。
  - パーサはピュア関数として切り出し、TDD でテスト先行（既存 fetcher の流儀に合わせる）。
- **batch.ts**: `case "rss"` を追加（`config.url` を渡す）。
- **seed.ts**: 検証済みフィードを `kind:'rss', config:{url, name}` で登録。
- **ラベル表示**: RSS は全部 `[RSS]` にならないよう、`sources.config.name` をタイムラインのクエリで引き、カードにフィード名を出す。

#### 採用ソース（フィード取得を実地確認済み）

| テーマ | 名称 | フィード URL |
|---|---|---|
| 名指し | GIGAZINE | `https://gigazine.net/news/rss_2.0/` |
| AI/LLM | Simon Willison's Weblog | `https://simonwillison.net/atom/everything/` |
| AI/LLM | Hugging Face Blog | `https://huggingface.co/blog/feed.xml` |
| AI/LLM | Import AI | `https://importai.substack.com/feed` |
| 政治×テック | The Markup | `https://themarkup.org/feeds/rss.xml` |
| 政治×テック | AI as Normal Technology | `https://www.normaltech.ai/feed` |
| 海外テック | MIT Technology Review | `https://www.technologyreview.com/feed/` |

WebFetch がボット保護で弾かれたが有名・安定のため**デフォルト採用**（初回バッチで実地検証）:

| テーマ | 名称 | フィード URL |
|---|---|---|
| 海外テック | Ars Technica | `https://feeds.arstechnica.com/arstechnica/index` |
| 海外テック | The Verge | `https://www.theverge.com/rss/index.xml` |

不採用（検証できず）: Tech Policy Press。

### 既存パイプラインの改修

- `scripts/lib/readability.ts` とスクレイプ経路を**削除**。
- `scripts/batch.ts` の `attachBody`：本文が無くても記事を捨てない作りに変更。
  - `body_excerpt = body_hint ?? ""`（フィード提供分。無ければ空）。
  - HN など本文ゼロのソースは「タイトル ＋ メタ情報」でスコアリングされる。
- `scripts/lib/scoring.ts`：本文が空でもタイトル＋メタで動くようプロンプトを調整。
- `@mozilla/readability` 依存は将来的に不要（`jsdom` は RSS/arXiv パーサで継続使用）。

---

## スコープ外（今回やらないこと）

- robots.txt 準拠の選択的スクレイプ（リンクアウト化で不要）
- 個人化スコア・埋め込み・セレンディピティ（大本設計の Phase 2 のまま）
- 認証・マルチユーザー（Phase 4 のまま）
- アーカイブ／過去フィード（不採用と確認済み）

---

## テスト方針

- `scripts/fetchers/rss.ts` のパーサに対し vitest で単体テスト（RSS 2.0 / Atom / 画像抽出 / 件数制限）。
- 既存テスト（dedup, hatena, hackernews, arxiv）は維持。
- バッチの本文取得まわりは I/O を伴うのでローカル手動実行で確認。
- 変更後に `npm test` を実行。

## 完了条件

1. `batch.yml` の cron が朝 1 本になっている。
2. RSS フェッチャーが追加され、seed のフィードから記事が取得・保存される。
3. `articles.image_url` が追加され、フィード提供画像がある記事で保存される。
4. タイムラインのカードがサムネ型になり、画像があれば表示・無ければテキストのみ。
5. RSS 記事のカードにフィード名が表示される。
6. 全文スクレイプ経路が削除され、本文はフィード提供分のみ使用。
7. `npm test` 全 pass。
