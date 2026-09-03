begin;

alter table public.leads
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.leads enable row level security;

-- Remove permissive or obsolete policies, including the previous "Allow all" policy.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'leads'
  loop
    execute format('drop policy if exists %I on public.leads', policy_record.policyname);
  end loop;
end
$$;

-- Grants decide which operations reach RLS; policies below decide which rows.
revoke all on table public.leads from anon, authenticated;
grant select, insert, update, delete on table public.leads to authenticated;

-- Replace the global name uniqueness with per-owner uniqueness for safe upserts.
alter table public.leads drop constraint if exists leads_name_key;
create unique index if not exists leads_user_id_name_key
  on public.leads (user_id, name);
create index if not exists leads_user_id_idx on public.leads (user_id);

create policy "leads_select_own"
  on public.leads for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "leads_insert_own"
  on public.leads for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "leads_update_own"
  on public.leads for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "leads_delete_own"
  on public.leads for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on column public.leads.user_id is
  'Owner used by RLS. Legacy rows must be assigned before they become visible.';

commit;