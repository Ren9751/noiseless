-- pgvector 拡張の有効化（Phase 2 で使用、Phase 1 では NULL のままにしておく）
create extension if not exists "vector";

create table articles (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid not null references sources(id) on delete cascade,
  url text not null unique,
  title text not null,
  title_ja text,
  body_excerpt text,
  summary text,
  raw_metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  embedding vector(1024)
);

create index articles_fetched_at_idx on articles(fetched_at desc);
create index articles_source_id_idx on articles(source_id);
