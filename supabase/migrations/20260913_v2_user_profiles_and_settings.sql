-- VisioSpace V2: User Profiles, Username Uniqueness & Settings Migration
-- Enforces globally unique case-insensitive usernames and user profiles.

create extension if not exists pgcrypto;

-- 1. Ensure profiles table structure with username and full_name
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  full_name text not null default '',
  avatar_url text,
  preferences jsonb not null default '{"theme":"dark-paper","sound":true,"snapToGrid":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format_check check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

-- If profiles already existed from earlier migrations without username or full_name, add columns safely:
do $$ begin
  alter table public.profiles add column if not exists username text;
exception when others then null;
end $$;

do $$ begin
  alter table public.profiles add column if not exists full_name text not null default '';
exception when others then null;
end $$;

do $$ begin
  alter table public.profiles add column if not exists preferences jsonb not null default '{"theme":"dark-paper","sound":true,"snapToGrid":false}'::jsonb;
exception when others then null;
end $$;

-- Enforce format check constraint if not present
do $$ begin
  alter table public.profiles drop constraint if exists username_format_check;
  alter table public.profiles add constraint username_format_check check (username ~ '^[a-zA-Z0-9_]{3,20}$');
exception when others then null;
end $$;

-- 2. Case-insensitive unique index on username
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- 3. Row Level Security on profiles
alter table public.profiles enable row level security;

drop policy if exists "Anyone authenticated can view profiles" on public.profiles;
create policy "Anyone authenticated can view profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 4. Secure RPC function to check username availability
-- Allows checking availability during registration or profile editing without exposing private user data
create or replace function public.is_username_available(check_username text, current_user_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cleaned text;
  taken boolean;
begin
  cleaned := lower(trim(check_username));
  
  -- Basic format validation
  if cleaned !~ '^[a-z0-9_]{3,20}$' then
    return false;
  end if;

  select exists(
    select 1 from public.profiles
    where lower(username) = cleaned
      and (current_user_id is null or id != current_user_id)
  ) into taken;

  return not taken;
end;
$$;

-- Grant execute to anon and authenticated for live registration checks
grant execute on function public.is_username_available(text, uuid) to anon, authenticated;

-- 5. Trigger: Handle new user profile on auth signup when metadata includes username & full_name
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_username text;
  new_full_name text;
  new_ws_id uuid;
begin
  new_username := new.raw_user_meta_data->>'username';
  new_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  -- If username provided in signup metadata, create profile immediately
  if new_username is not null and new_username ~ '^[a-zA-Z0-9_]{3,20}$' then
    insert into public.profiles (id, username, full_name, avatar_url)
    values (new.id, new_username, new_full_name, new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do update
      set username = excluded.username,
          full_name = excluded.full_name,
          updated_at = now();
  end if;

  -- Create default workspace
  insert into public.workspaces (name, created_by)
  values (new_full_name || '''s Workspace', new.id)
  returning id into new_ws_id;

  -- Add user as owner of default workspace
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, new.id, 'owner')
  on conflict do nothing;

  return new;
exception when others then
  -- Fail-safe: don't block auth user creation if workspace or profile conflicts
  return new;
end;
$$;
