-- Run this ONCE in Supabase: Dashboard > SQL Editor > New query > paste > Run.
create table if not exists public.kv (
  key     text primary key,
  value   jsonb not null,
  version integer not null default 1
);

-- Lock the table: nobody can read or write it from a browser.
-- Only the server (which uses the secret service key) can.
alter table public.kv enable row level security;
revoke all on public.kv from anon, authenticated;
