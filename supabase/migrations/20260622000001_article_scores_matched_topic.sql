-- T6: カテゴリ均等化のためのタグ。
-- 記事がユーザーの興味トピックのうち最もマッチするものを1つ保持する
-- （該当なしは NULL）。表示時にこの列をグループ単位へ畳んで均等に並べる。
alter table article_scores add column matched_topic text;
