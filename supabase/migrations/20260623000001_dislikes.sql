-- T10: 「興味なし」ネガティブシグナル。likes と対称なテーブル。
-- ポジ（いいね＝ブックマーク・掃除で残す）とは別物で、こちらは
-- タイムラインから隠す＋採点プロンプトに「避ける例」として注入するためのもの。
create table dislikes (
  user_id uuid not null references users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index dislikes_user_created_idx on dislikes(user_id, created_at desc);
