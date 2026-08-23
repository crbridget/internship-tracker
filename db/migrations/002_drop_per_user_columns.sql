-- Drop per-user columns from the global job_postings table.
--
-- IMPORTANT: deploy the code change that stops writing relevance_score BEFORE
-- running this. Old code + dropped column = every /targets request 500s. The
-- reverse order is safe: new code simply leaves the column null.
--
-- user_label      null on 10,777/10,777. A label belongs to a (user, posting)
--                 pair, not to the posting itself.
-- relevance_score one global value for a per-user, per-query score — two users
--                 searching different roles overwrite each other. Nothing reads
--                 it back; the frontend renders from the /targets response body.
--
-- If either is wanted later, it belongs in a join table:
--   user_postings (user_id, posting_id, label, score, ...)

begin;

alter table public.job_postings drop column if exists user_label;
alter table public.job_postings drop column if exists relevance_score;

commit;
