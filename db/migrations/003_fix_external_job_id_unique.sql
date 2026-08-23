-- Drop the global unique on external_job_id.
--
-- Greenhouse and Lever assign job ids per board, so two different companies can
-- legitimately share one. A global unique forbids that: the first collision
-- makes the whole poll for that company fail. 0 collisions across ~10.8k
-- postings so far, but adding more boards makes it likelier.
--
-- Safe to drop because job_postings_company_external_unique already enforces
-- the invariant that actually matters — and it's the one upsert_job_postings()
-- targets via on_conflict='company_id,external_job_id'.
--
-- CONFIRM FIRST. This should list external_job_id alone:
--
--   select indexdef from pg_indexes
--   where indexname = 'job_posting_external_job_id_key';
--
-- and this should list company_id, external_job_id:
--
--   select indexdef from pg_indexes
--   where indexname = 'job_postings_company_external_unique';

begin;

-- Declared inline in CREATE TABLE, so it's a constraint rather than a bare
-- index; dropping the constraint removes the backing index too.
alter table public.job_postings
  drop constraint if exists job_posting_external_job_id_key;

commit;
