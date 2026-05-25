# noiseless

自分の関心に最適化されたタイムライン型 Web アプリ。「ノイズのない X」をコンセプトとした自分専用情報源。

## ステータス

Phase 1 (MVP) 実装中。

- ✅ Plan A: バックエンド基盤（バッチ処理 + DB）
- ⬜ Plan B: フロントエンド（タイムライン、いいね、設定 UI）

## アーキテクチャ

- **バッチ処理**: GitHub Actions で 1 日 2 回 (06:00 / 21:00 JST)、TypeScript (`tsx`) で実行
- **DB**: Supabase (PostgreSQL + pgvector)
- **LLM**: Claude Haiku (`claude-haiku-4-5-20251001`)
- **フロント**: Next.js 16 (App Router) on Vercel

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

`.env.example` を `.env.local` にコピーして値を埋める:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Supabase スキーマ適用

`supabase/migrations/` 内の SQL を、ファイル名の昇順で Supabase ダッシュボードの SQL Editor で実行する。

### 4. シードデータ投入

```bash
npm run seed
```

固定ユーザー、興味プロフィール、3 ソース (はてブ・HN・arXiv) が投入される。

### 5. バッチを手動実行

```bash
npm run batch
```

実際に外部 API を叩き、Claude Haiku で課金が発生する。1 回あたり $0.30〜0.50 程度。

## テスト

```bash
npm test
```

`scripts/lib/dedup.ts` と各 fetcher のパース部分にユニットテストがある。HTTP・LLM 呼び出しは対象外（バッチ実行で確認）。

## GitHub Actions

`.github/workflows/batch.yml` で 1 日 2 回 (06:00 / 21:00 JST) 自動実行される。

GitHub リポジトリの Settings → Secrets and variables → Actions に以下を設定する:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

## ディレクトリ構成

```
noiseless/
├── app/                   # Next.js App Router (Plan B で実装)
├── scripts/
│   ├── batch.ts           # バッチエントリポイント
│   ├── seed.ts            # 初期データ投入
│   ├── fetchers/          # ソース別 fetcher
│   └── lib/               # 共通ロジック (scoring, readability, etc.)
├── supabase/
│   └── migrations/        # スキーマ + GRANT
├── tests/                 # vitest テスト
└── .github/workflows/     # GitHub Actions
```

## 設計ドキュメント

- 設計書: `docs/superpowers/specs/2026-05-18-noiseless-design.md`
- Plan A (バックエンド): `docs/superpowers/plans/2026-05-18-plan-a-backend.md`
