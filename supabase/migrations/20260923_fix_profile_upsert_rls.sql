-- VisioSpace: Fix profile upsert RLS
-- Ensure authenticated users can INSERT their own profile row.
-- This is required for the upsert in profileService.createProfile to succeed.
-- The upsert (INSERT ... ON CONFLICT DO UPDATE) requires both INSERT and UPDATE policies.

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- Ensure the UPDATE policy also exists (recreate to normalize policy name)
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Drop the old-named UPDATE policy from the first migration if it still exists
drop policy if exists "Users can update their profile" on public.profiles;
