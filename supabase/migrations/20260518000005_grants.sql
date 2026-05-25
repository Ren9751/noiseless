-- service_role に public スキーマの全テーブル・シーケンスへの権限を付与
-- 「Automatically expose new tables」を OFF にしているため、明示的な GRANT が必要
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 今後 public スキーマに作られる新しいテーブルにも自動で権限を付与
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
