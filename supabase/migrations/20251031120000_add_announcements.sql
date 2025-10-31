-- Announcements table for automatic release notes / warnings
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  body text not null,
  critical boolean not null default false,
  published boolean not null default true,
  company_id uuid null references public.companies(id) on delete set null
);

-- Enable RLS
alter table public.announcements enable row level security;

-- Allow read for authenticated users
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'announcements' and policyname = 'Authenticated can read announcements'
  ) then
    create policy "Authenticated can read announcements"
      on public.announcements for select
      to authenticated
      using (published = true);
  end if;
end $$;

-- Allow inserts only to service role (via edge function) - no direct client insert policy
-- (No insert policy for authenticated to avoid client-side writes)


