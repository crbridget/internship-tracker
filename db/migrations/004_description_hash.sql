-- Store job descriptions, and a fingerprint of each so they're only rewritten
-- when they change.
--
-- job_postings.description already exists (unused until now). The poller fills
-- it from Greenhouse `content` / Lever descriptionPlain + lists, cleaned to
-- plain text by backend/text.py, and stores sha256(description) here. On each
-- poll it compares hashes and omits description from the upsert when they
-- match, instead of rewriting ~60MB of unchanged text every 30 minutes.
--
-- NULL for rows not yet seen by the new poller, and for postings with an empty
-- description. The first poll after this migration backfills every open row.

begin;

alter table public.job_postings
  add column if not exists description_hash character varying;

commit;
