-- Step 8: let an already-registered user accept invites sent to their email.
-- (New users get pending invites on sign-up via handle_new_user.)
-- Run once in the SQL editor after the initial schema.

create or replace function public.accept_pending_invites()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n  integer := 0;
  em text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null or em is null or em = '' then
    return 0;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
    select i.workspace_id, auth.uid(), i.role
    from public.workspace_invites i
    where i.email = em and i.accepted_at is null
    on conflict do nothing;
  get diagnostics n = row_count;

  update public.workspace_invites set accepted_at = now()
    where email = em and accepted_at is null;

  return n;
end $$;

revoke all on function public.accept_pending_invites() from public;
revoke all on function public.accept_pending_invites() from anon;
grant execute on function public.accept_pending_invites() to authenticated;
