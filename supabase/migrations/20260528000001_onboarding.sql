-- user_profile にオンボーディング用の列を追加
alter table user_profile
  add column it_level smallint,
  add column onboarded_at timestamptz;
