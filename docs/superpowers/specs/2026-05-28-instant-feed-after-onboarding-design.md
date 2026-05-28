# オンボ直後の高速フィード（Instant Feed）設計書

- 作成日: 2026-05-28
- ステータス: 設計レビュー中
- 関連: 2026-05-28-onboarding-level-design.md / 2026-05-18-noiseless-design.md

## 1. 目的
オンボーディング完了直後に数十秒で初回フィードを受け取れるようにする。「集めています…」→自動でフィードに切替。

## 2. 決定事項
- 初回取得は Vercel の Route Handler（maxDuration=60）。GitHub Actions/PATは使わない
- 本文取得スキップ（採点テキスト= body_hint ?? title）
- 採点は既存 scoreArticle を並列（同時実行上限8）、閾値超え上位10件のみ保存
- トリガー: オンボ完了後 fetch(..., {keepalive:true}) 投げっぱなし
- 待機画面: / で PreparingFeed がポーリング、記事が入れば切替、長引けば再試行
- 初回記事の差し替えなし（エイジアウト）。定時バッチは変更なし・マイグレーション不要

## 3. 構成
runInitialBatch({userId,limit}) を scripts/lib/initial-batch.ts に実装し、app/api/initial-batch/route.ts(maxDuration=60) から呼ぶ。純粋ヘルパー(buildScoringText/capByScore/mapWithConcurrency)は scripts/lib/initial-batch-utils.ts に分離してテスト。app/page.tsx はオンボ済み&&0件で PreparingFeed を表示。onboarding-wizard は完了後 keepalive で起動。

## 4. エラー/セキュリティ
Routeはtry/catchでログのみ（投げっぱなし）。採点個別失敗はスキップ。同時実行上限8。ガード=オンボ済み&&記事少のときだけ実行（乱用抑制、本格保護はAuth導入時）。タイムアウト時は部分/未保存→ポーリング+定時バッチが安全網。

## 5. テスト
純粋ヘルパーをvitest。runInitialBatch/Routeは手動E2E（オンボ→集めています→数十秒でフィード）。

## 6. 影響ファイル
追加: scripts/lib/initial-batch.ts, scripts/lib/initial-batch-utils.ts, app/api/initial-batch/route.ts, app/components/preparing-feed.tsx, tests/initial-batch-utils.test.ts
変更: app/page.tsx, app/onboarding/onboarding-wizard.tsx
