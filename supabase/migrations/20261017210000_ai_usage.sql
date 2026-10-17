-- Step 11: AI assist usage log, used for the per-user daily limit.
-- Only the ai-assist Edge Function (service role) writes here; users can read their own rows.

create table public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete set null,
  section_id    text not null,
  action        text not null check (action in ('draft', 'critique', 'fill')),
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;

create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using (user_id = auth.uid());
-- No insert / update / delete policies: signed-in users cannot write usage rows.
