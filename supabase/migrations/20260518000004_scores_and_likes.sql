create table article_scores (
  article_id uuid not null references articles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  prompt_score int not null check (prompt_score between 0 and 10),
  similarity_score float not null default 0,
  final_score float not null,
  score_reason text,
  is_serendipity boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create index article_scores_user_final_idx on article_scores(user_id, final_score desc);

create table likes (
  user_id uuid not null references users(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index likes_user_created_idx on likes(user_id, created_at desc);
