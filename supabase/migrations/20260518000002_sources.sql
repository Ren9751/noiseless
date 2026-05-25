create table sources (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('hatena', 'hackernews', 'reddit', 'rss', 'arxiv')),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index sources_user_id_enabled_idx on sources(user_id, enabled);
