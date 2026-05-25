-- 拡張機能の有効化
create extension if not exists "uuid-ossp";

-- users テーブル
create table users (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- user_profile テーブル
create table user_profile (
  user_id uuid primary key references users(id) on delete cascade,
  interests jsonb not null default '[]'::jsonb,
  special_rules text not null default '',
  updated_at timestamptz not null default now()
);
