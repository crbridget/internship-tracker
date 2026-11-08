-- Application tracking: what a user did about a posting.
--
-- Run once in the Supabase SQL editor, BEFORE deploying the API that serves
-- /applications. The reverse order only breaks the new routes (they 500 until
-- the table exists); every existing route is unaffected.
--
-- Per (user, posting), like the other per-user tables from 001: a posting is a
-- fact about the world, whether you applied to it is a fact about you. This is
-- the join table 002 anticipated for labels.
--
-- Rows outlive their posting closing (job_postings rows are marked closed, not
-- deleted), so "I applied, then it came down" stays on record.

begin;

create table public.applications (
  user_id     bigint not null references public.users(id) on delete cascade,
  posting_id  bigint not null references public.job_postings(id) on delete cascade,
  status      text not null
              check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
  notes       text,
  -- Set by the API the first time status leaves 'saved', unless the client
  -- supplies one (for back-filling something applied to last week).
  applied_at  date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, posting_id)
);

-- The primary key already serves "this user's applications"; this serves the
-- reverse, which the cascade from job_postings needs.
create index on public.applications (posting_id);

commit;
