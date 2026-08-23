-- Multi-user data model.
--
-- Run once in the Supabase SQL editor. Wrapped in a transaction, so a failure
-- anywhere leaves the database untouched.
--
-- Design note: companies and job_postings stay GLOBAL. A company's job board is
-- a fact about the world, not about a user, so the poller still polls each board
-- exactly once regardless of how many people track it. Only *interest* is
-- per-user, which is why these are join tables rather than user_id columns on
-- the existing tables.

begin;

-- Who uses the app.
--
-- Deliberately separate from Supabase's auth.users so a row can exist before
-- auth is wired up. auth_user_id stays null until then, and links the two
-- without needing another migration.
create table public.users (
  id            bigint generated always as identity primary key,
  email         text not null unique,
  auth_user_id  uuid unique,   -- -> auth.users(id), once Supabase Auth is on
  created_at    timestamptz not null default now()
);

-- Which companies a user wants tracked.
create table public.user_companies (
  user_id     bigint not null references public.users(id) on delete cascade,
  company_id  bigint not null references public.companies(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- Target roles. One row each rather than an array column, so a role can grow
-- its own settings later (enabled/disabled, per-role cadence, minimum score).
create table public.user_targets (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references public.users(id) on delete cascade,
  role        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

-- One row per (user, posting) already emailed.
--
-- This is what makes notifications correct rather than merely working. Without
-- it a re-poll or a redeploy re-sends the same postings. It also makes "new"
-- mean new *to this user*: adding a target role today should surface postings
-- that already exist and match it, not only ones that appear afterwards.
create table public.notifications_sent (
  user_id     bigint not null references public.users(id) on delete cascade,
  posting_id  bigint not null references public.job_postings(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  primary key (user_id, posting_id)
);

-- user_companies' primary key already covers (user_id, ...); this covers the
-- reverse lookup the poller needs: "who tracks this company?"
create index on public.user_companies (company_id);
create index on public.user_targets (user_id);

-- Backfill: one user, tracking everything already in the catalog.
-- Replace the address before running. Do not commit a real email here — this
-- repo is public.
insert into public.users (email) values ('you@example.com');

insert into public.user_companies (user_id, company_id)
select u.id, c.id
from public.users u
cross join public.companies c
where u.email = 'you@example.com';

commit;
