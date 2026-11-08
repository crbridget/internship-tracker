-- Link users to Clerk accounts.
--
-- Run once in the Supabase SQL editor, BEFORE deploying the API that requires
-- sign-in. Old code ignores the new column, so this order is safe.
--
-- Clerk user ids are strings like "user_2abc...", not UUIDs, so the
-- auth_user_id uuid column from 001 (meant for Supabase Auth) doesn't fit.
-- auth_user_id stays, unused, rather than being repurposed under a misleading
-- type.
--
-- Existing rows start unlinked. The API links one the first time someone signs
-- in with a verified email matching users.email, so your current row (and its
-- applications) carries over without a manual step.

begin;

alter table public.users
  add column if not exists clerk_user_id text unique;

commit;
