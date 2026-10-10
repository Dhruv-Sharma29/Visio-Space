-- VisioSpace: initialize an empty Supabase project for the current app.
-- Run this complete file once in the SQL Editor, using the postgres role.
-- Existing migrations are included in dependency order; do not also replay them.
-- The transaction rolls back all setup if any statement fails.
begin;
set local search_path = public, extensions;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') then
    raise exception 'This bootstrap requires an empty public schema. Use incremental migrations for an initialized project.';
  end if;
end $$;

-- Included source: supabase/migrations/20260913_v2_complete_foundation.sql
-- VisioSpace V2: Complete Foundation Migration
-- Identity, Workspaces, Boards Persistence, Collaboration Boundaries, and Communication.

create extension if not exists pgcrypto;

-- 1. Enums
do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.board_role as enum ('viewer', 'editor');
exception when duplicate_object then null;
end $$;

-- 2. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Workspaces Table
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Workspace Members Table
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- 5. Boards Table
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null default 'Untitled Board',
  state jsonb not null default '{"cards":[],"shapes":[],"connectors":[],"clusters":[],"textItems":[],"voteDots":[],"images":[]}'::jsonb,
  thumbnail_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Board Members Table
create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.board_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- 7. Board Versions Table
create table if not exists public.board_versions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text,
  state jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 8. Board Activity Table
create table if not exists public.board_activity (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 9. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id text,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. Comment Mentions Table
create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, mentioned_user_id)
);

-- 11. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indices
create index if not exists boards_workspace_id_idx on public.boards(workspace_id);
create index if not exists board_activity_board_created_idx on public.board_activity(board_id, created_at desc);
create index if not exists comments_board_created_idx on public.comments(board_id, created_at);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

-- ─── Security Definer Helper Functions ──────────────────────────────
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.is_board_member(target_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_members
    where board_id = target_board_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_board_editor(target_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.board_members
    where board_id = target_board_id and user_id = auth.uid() and role = 'editor'
  );
$$;

-- ─── Auto Triggers ──────────────────────────────────────────────────

-- Trigger: When a user is created, create profile and personal workspace
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_ws_id uuid;
  user_name text;
begin
  user_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));

  -- Create profile
  insert into public.profiles (id, display_name)
  values (new.id, user_name)
  on conflict (id) do nothing;

  -- Create default workspace
  insert into public.workspaces (name, created_by)
  values (user_name || '''s Workspace', new.id)
  returning id into new_ws_id;

  -- Add user as owner of default workspace
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: When a workspace is created, automatically add creator as owner
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute procedure public.handle_new_workspace();

-- Trigger: When a board is created, automatically add creator as editor
create or replace function public.handle_new_board()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.created_by, 'editor')
  on conflict (board_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_board_created on public.boards;
create trigger on_board_created
  after insert on public.boards
  for each row execute procedure public.handle_new_board();

-- ─── Row Level Security (RLS) Policies ──────────────────────────────
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_versions enable row level security;
alter table public.board_activity enable row level security;
alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.notifications enable row level security;

-- Profiles policies
drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles" on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces policies
drop policy if exists "Members can read workspaces" on public.workspaces;
create policy "Members can read workspaces" on public.workspaces for select to authenticated using (public.is_workspace_member(id));

drop policy if exists "Users can create workspaces" on public.workspaces;
create policy "Users can create workspaces" on public.workspaces for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "Owners can update workspaces" on public.workspaces;
create policy "Owners can update workspaces" on public.workspaces for update to authenticated using (public.is_workspace_owner(id)) with check (public.is_workspace_owner(id));

drop policy if exists "Owners can delete workspaces" on public.workspaces;
create policy "Owners can delete workspaces" on public.workspaces for delete to authenticated using (public.is_workspace_owner(id));

-- Workspace Members policies
drop policy if exists "Members can read workspace membership" on public.workspace_members;
create policy "Members can read workspace membership" on public.workspace_members for select to authenticated using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists "Owners can manage workspace members" on public.workspace_members;
create policy "Owners can manage workspace members" on public.workspace_members for all to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));

-- Boards policies
drop policy if exists "Members can read boards" on public.boards;
create policy "Members can read boards" on public.boards for select to authenticated using (public.is_workspace_member(workspace_id) or public.is_board_member(id));

drop policy if exists "Workspace members can create boards" on public.boards;
create policy "Workspace members can create boards" on public.boards for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "Editors can update boards" on public.boards;
create policy "Editors can update boards" on public.boards for update to authenticated using (public.is_board_editor(id) or public.is_workspace_owner(workspace_id)) with check (public.is_board_editor(id) or public.is_workspace_owner(workspace_id));

drop policy if exists "Creators and owners can delete boards" on public.boards;
create policy "Creators and owners can delete boards" on public.boards for delete to authenticated using (created_by = auth.uid() or public.is_workspace_owner(workspace_id));

-- Board Members policies
drop policy if exists "Board members can read board members" on public.board_members;
create policy "Board members can read board members" on public.board_members for select to authenticated using (user_id = auth.uid() or public.is_board_member(board_id));

drop policy if exists "Board editors can manage board members" on public.board_members;
create policy "Board editors can manage board members" on public.board_members for all to authenticated using (public.is_board_editor(board_id)) with check (public.is_board_editor(board_id));

-- Board Versions policies
drop policy if exists "Board members can read versions" on public.board_versions;
create policy "Board members can read versions" on public.board_versions for select to authenticated using (public.is_board_member(board_id));

drop policy if exists "Board editors can insert versions" on public.board_versions;
create policy "Board editors can insert versions" on public.board_versions for insert to authenticated with check (public.is_board_editor(board_id) and created_by = auth.uid());

-- Board Activity policies
drop policy if exists "Board members can read activity" on public.board_activity;
create policy "Board members can read activity" on public.board_activity for select to authenticated using (public.is_board_member(board_id));

drop policy if exists "Board members can insert activity" on public.board_activity;
create policy "Board members can insert activity" on public.board_activity for insert to authenticated with check (public.is_board_member(board_id) and actor_id = auth.uid());

-- Comments policies
drop policy if exists "Board members can read comments" on public.comments;
create policy "Board members can read comments" on public.comments for select to authenticated using (public.is_board_member(board_id));

drop policy if exists "Members can manage their comments" on public.comments;
create policy "Members can manage their comments" on public.comments for all to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Comment Mentions policies
drop policy if exists "Members can read mentions" on public.comment_mentions;
create policy "Members can read mentions" on public.comment_mentions for select to authenticated using (true);

-- Notifications policies
drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Compatibility between the original foundation and current feature tables.
-- CREATE TABLE IF NOT EXISTS in feature migrations does not add missing columns.
alter table public.comments
  add column x double precision not null default 0,
  add column y double precision not null default 0,
  add column author_name text not null default 'Collaborator',
  add column author_avatar text,
  add column parent_comment_id uuid references public.comments(id) on delete cascade,
  add column resolved boolean not null default false,
  add column resolved_by uuid references auth.users(id) on delete set null;
alter table public.comments alter column author_id drop not null;

alter table public.notifications
  add column title text not null default '',
  add column body text not null default '',
  add column comment_id uuid references public.comments(id) on delete cascade,
  add column card_id text,
  add column x double precision,
  add column y double precision,
  add column read boolean not null default false;

alter table public.board_activity
  add column user_id uuid references auth.users(id) on delete set null,
  add column user_name text not null default 'Collaborator',
  add column user_avatar text,
  add column description text not null default '';
alter table public.board_activity alter column actor_id drop not null;

-- Included source: supabase/migrations/20260913_v2_user_profiles_and_settings.sql
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

-- Included source: supabase/migrations/20260913_v2_board_sharing_and_permissions.sql
-- VisioSpace V2: Board Sharing, Permissions & Access Control Migration
-- Supports shareable links (public viewer/editor), collaborator invitations, and role management.

create extension if not exists pgcrypto;

-- 1. Extend boards table with share token and public access level
do $$ begin
  alter table public.boards add column if not exists share_token text unique default encode(gen_random_bytes(12), 'hex');
exception when others then null;
end $$;

do $$ begin
  alter table public.boards add column if not exists public_access text not null default 'private' check (public_access in ('private', 'viewer', 'editor'));
exception when others then null;
end $$;

-- Populate existing boards with share tokens if null
update public.boards set share_token = encode(gen_random_bytes(12), 'hex') where share_token is null;

-- Ensure index on share_token
create index if not exists boards_share_token_idx on public.boards(share_token);

-- 2. Security Definer Helper: Determine current user's effective board role
create or replace function public.get_board_role(target_board_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  b_owner uuid;
  b_public text;
  m_role text;
begin
  select created_by, public_access into b_owner, b_public
  from public.boards
  where id = target_board_id;

  if not found then
    return null;
  end if;

  -- Creator is always owner/editor
  if b_owner = auth.uid() then
    return 'owner';
  end if;

  -- Check explicit membership
  select role::text into m_role
  from public.board_members
  where board_id = target_board_id and user_id = auth.uid();

  if m_role is not null then
    return m_role;
  end if;

  -- Check workspace ownership
  if exists (
    select 1 from public.boards b
    join public.workspace_members wm on wm.workspace_id = b.workspace_id
    where b.id = target_board_id and wm.user_id = auth.uid() and wm.role = 'owner'
  ) then
    return 'editor';
  end if;

  -- Fallback to public access level
  if b_public is not null and b_public != 'private' then
    return b_public;
  end if;

  return null;
end;
$$;

grant execute on function public.get_board_role(uuid) to authenticated, anon;

-- 3. Update RLS policies on boards
drop policy if exists "Members can read boards" on public.boards;
create policy "Members can read boards" on public.boards
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or public.is_board_member(id)
    or public_access in ('viewer', 'editor')
  );

drop policy if exists "Anyone can read public boards" on public.boards;
create policy "Anyone can read public boards" on public.boards
  for select to anon
  using (public_access in ('viewer', 'editor'));

drop policy if exists "Editors can update boards" on public.boards;
create policy "Editors can update boards" on public.boards
  for update to authenticated
  using (
    public.is_board_editor(id)
    or public.is_workspace_owner(workspace_id)
    or created_by = auth.uid()
    or public_access = 'editor'
  )
  with check (
    public.is_board_editor(id)
    or public.is_workspace_owner(workspace_id)
    or created_by = auth.uid()
    or public_access = 'editor'
  );

-- 4. RPC: Get board by share token (anon and authenticated)
create or replace function public.get_board_by_share_token(token text)
returns table (
  id uuid,
  workspace_id uuid,
  title text,
  state jsonb,
  public_access text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
) language sql stable security definer set search_path = public as $$
  select b.id, b.workspace_id, b.title, b.state, b.public_access, b.created_by, b.created_at, b.updated_at
  from public.boards b
  where b.share_token = token and b.public_access != 'private';
$$;

grant execute on function public.get_board_by_share_token(text) to authenticated, anon;

-- 5. RPC: Get all collaborators for a board
create or replace function public.get_board_collaborators(target_board_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  b_owner uuid;
begin
  if not exists (
    select 1 from public.boards b where b.id = target_board_id
    and (public.get_board_role(b.id) is not null or public.is_workspace_member(b.workspace_id))
  ) then
    raise exception 'Unauthorized to view collaborators for this board';
  end if;

  select created_by into b_owner from public.boards where id = target_board_id;

  select jsonb_agg(item) into result from (
    -- Owner entry
    select
      p.id as user_id,
      p.username,
      coalesce(p.full_name, p.display_name, 'Owner') as full_name,
      p.avatar_url,
      'owner' as role,
      b.created_at as joined_at
    from public.boards b
    left join public.profiles p on p.id = b.created_by
    where b.id = target_board_id

    union all

    -- Member entries (excluding owner)
    select
      bm.user_id,
      p.username,
      coalesce(p.full_name, p.display_name, 'Collaborator') as full_name,
      p.avatar_url,
      bm.role::text as role,
      bm.created_at as joined_at
    from public.board_members bm
    left join public.profiles p on p.id = bm.user_id
    where bm.board_id = target_board_id and bm.user_id != b_owner
  ) item;

  return coalesce(result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_board_collaborators(uuid) to authenticated;

-- 6. RPC: Invite collaborator by username
create or replace function public.invite_board_collaborator(
  target_board_id uuid,
  target_username text,
  target_role text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_uid uuid;
  clean_username text;
  inviter_role text;
begin
  inviter_role := public.get_board_role(target_board_id);
  if inviter_role is null or (inviter_role != 'owner' and inviter_role != 'editor') then
    raise exception 'Unauthorized to invite collaborators to this board';
  end if;

  clean_username := lower(trim(replace(target_username, '@', '')));

  select id into target_uid
  from public.profiles
  where lower(username) = clean_username;

  if target_uid is null then
    return jsonb_build_object('success', false, 'error', 'User @' || clean_username || ' not found');
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (target_board_id, target_uid, target_role::public.board_role)
  on conflict (board_id, user_id) do update
    set role = excluded.role;

  return jsonb_build_object('success', true, 'userId', target_uid);
end;
$$;

grant execute on function public.invite_board_collaborator(uuid, text, text) to authenticated;

-- 7. RPC: Update collaborator role
create or replace function public.update_board_collaborator_role(
  target_board_id uuid,
  target_user_id uuid,
  new_role text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  inviter_role text;
begin
  inviter_role := public.get_board_role(target_board_id);
  if inviter_role is null or (inviter_role != 'owner' and inviter_role != 'editor') then
    raise exception 'Unauthorized to update roles on this board';
  end if;

  update public.board_members
  set role = new_role::public.board_role
  where board_id = target_board_id and user_id = target_user_id;
end;
$$;

grant execute on function public.update_board_collaborator_role(uuid, uuid, text) to authenticated;

-- 8. RPC: Remove collaborator
create or replace function public.remove_board_collaborator(
  target_board_id uuid,
  target_user_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
declare
  inviter_role text;
begin
  inviter_role := public.get_board_role(target_board_id);
  if inviter_role is null or (inviter_role != 'owner' and inviter_role != 'editor') then
    raise exception 'Unauthorized to remove collaborators from this board';
  end if;

  delete from public.board_members
  where board_id = target_board_id and user_id = target_user_id;
end;
$$;

grant execute on function public.remove_board_collaborator(uuid, uuid) to authenticated;

-- Included source: supabase/migrations/20260913_v2_comments_and_notifications.sql
-- ==============================================================================
-- Migration: 20260913_v2_comments_and_notifications.sql
-- Description: Communication layer for VisioSpace V2
--   - comments: canvas & card-level pins, threaded replies, and resolve status
--   - mentions: tracking user @mentions in comments
--   - notifications: in-app notification alerts for mentions, replies, and resolves
-- ==============================================================================

-- 1. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id text,
  x double precision not null default 0,
  y double precision not null default 0,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Collaborator',
  author_avatar text,
  body text not null,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  resolved boolean not null default false,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for comment lookups and threading
create index if not exists idx_comments_board_id on public.comments(board_id);
create index if not exists idx_comments_parent_id on public.comments(parent_comment_id);
create index if not exists idx_comments_card_id on public.comments(card_id);

-- 2. Mentions Table
create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_mentions_user_id on public.mentions(mentioned_user_id);
create index if not exists idx_mentions_comment_id on public.mentions(comment_id);

-- 3. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('mention', 'reply', 'comment_resolve')),
  title text not null,
  body text not null,
  board_id uuid not null references public.boards(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  card_id text,
  x double precision,
  y double precision,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- 4. Enable Row Level Security (RLS)
alter table public.comments enable row level security;
alter table public.mentions enable row level security;
alter table public.notifications enable row level security;

-- Comments Policies:
-- Allow viewing comments if user has access to the board
drop policy if exists "Users can view board comments" on public.comments;
create policy "Users can view board comments"
  on public.comments for select
  using (
    exists (
      select 1 from public.boards b
      where b.id = comments.board_id
        and (
          b.public_access in ('viewer', 'editor')
          or b.created_by = auth.uid()
          or exists (
            select 1 from public.board_members bm
            where bm.board_id = b.id and bm.user_id = auth.uid()
          )
        )
    )
  );

-- Allow creating comments on boards the user can view/edit
drop policy if exists "Users can create comments on accessible boards" on public.comments;
create policy "Users can create comments on accessible boards"
  on public.comments for insert
  with check (
    exists (
      select 1 from public.boards b
      where b.id = comments.board_id
        and (
          b.public_access in ('viewer', 'editor')
          or b.created_by = auth.uid()
          or exists (
            select 1 from public.board_members bm
            where bm.board_id = b.id and bm.user_id = auth.uid()
          )
        )
    )
  );

-- Allow updating comments (body or resolved status) by author or board owner
drop policy if exists "Author or board owner can update comments" on public.comments;
create policy "Author or board owner can update comments"
  on public.comments for update
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.boards b
      where b.id = comments.board_id and b.created_by = auth.uid()
    )
  );

-- Allow deleting comments by author or board owner
drop policy if exists "Author or board owner can delete comments" on public.comments;
create policy "Author or board owner can delete comments"
  on public.comments for delete
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.boards b
      where b.id = comments.board_id and b.created_by = auth.uid()
    )
  );

-- Notifications Policies:
-- Users can only view and manage their own notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (user_id = auth.uid());

drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- Included source: supabase/migrations/20260913_v2_board_snapshots_and_activity.sql
-- ══════════════════════════════════════════════════════════════════════
-- VisioSpace V2 Migration: Board Snapshots, Activity Log & Projects
-- Phase 5: Board Management & History
-- ══════════════════════════════════════════════════════════════════════

-- 1. Board Projects / Folders Table
create table if not exists public.board_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null,
  color text not null default '#d6a85f',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add project_id reference to boards table if it exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'boards') then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boards' and column_name = 'project_id') then
      alter table public.boards add column project_id text;
    end if;
  end if;
end $$;

-- 2. Board Snapshots / Versions Table
create table if not exists public.board_snapshots (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  name text not null,
  description text,
  state jsonb not null default '{}'::jsonb,
  created_by text,
  created_by_name text not null default 'Collaborator',
  item_count jsonb not null default '{"cards":0,"shapes":0,"clusters":0}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. Board Activity Log Table
create table if not exists public.board_activity (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  user_id text,
  user_name text not null default 'Collaborator',
  user_avatar text,
  action text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 4. Indexes for fast lookups & chronological timelines
create index if not exists idx_board_projects_workspace on public.board_projects(workspace_id, created_at desc);
create index if not exists idx_board_snapshots_board on public.board_snapshots(board_id, created_at desc);
create index if not exists idx_board_activity_board on public.board_activity(board_id, created_at desc);

-- 5. Enable Row Level Security (RLS)
alter table public.board_projects enable row level security;
alter table public.board_snapshots enable row level security;
alter table public.board_activity enable row level security;


-- Included source: supabase/migrations/20260923_fix_profile_upsert_rls.sql
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

-- Included source: supabase/migrations/20261009_fix_board_persistence.sql
-- VisioSpace: Fix board persistence bug
-- Boards created by a user must always be visible to that user even if
-- the on_board_created trigger (which inserts into board_members) has
-- not yet fired or fails due to a race condition. We add `created_by =
-- auth.uid()` as an additional OR clause on the SELECT policy.

-- Boards: ensure creator can always read their own boards
drop policy if exists "Members can read boards" on public.boards;
create policy "Members can read boards" on public.boards
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_workspace_member(workspace_id)
    or public.is_board_member(id)
    or public_access in ('viewer', 'editor')
  );

-- Boards: ensure creator can always update their own boards
drop policy if exists "Editors can update boards" on public.boards;
create policy "Editors can update boards" on public.boards
  for update to authenticated
  using (
    created_by = auth.uid()
    or public.is_board_editor(id)
    or public.is_workspace_owner(workspace_id)
    or public_access = 'editor'
  )
  with check (
    created_by = auth.uid()
    or public.is_board_editor(id)
    or public.is_workspace_owner(workspace_id)
    or public_access = 'editor'
  );

-- Board Members: the on_board_created trigger uses SECURITY DEFINER
-- so it bypasses RLS. However, to be safe we also ensure the creator
-- can manage their own board member entries.
drop policy if exists "Board editors can manage board members" on public.board_members;
create policy "Board editors can manage board members" on public.board_members
  for all to authenticated
  using (
    public.is_board_editor(board_id)
    or exists (
      select 1 from public.boards b
      where b.id = board_id and b.created_by = auth.uid()
    )
  )
  with check (
    public.is_board_editor(board_id)
    or exists (
      select 1 from public.boards b
      where b.id = board_id and b.created_by = auth.uid()
    )
  );

-- Notifications: add missing INSERT policy
drop policy if exists "Users can insert their own notifications" on public.notifications;
create policy "Users can insert their own notifications" on public.notifications
  for insert to authenticated
  with check (true);

-- Included source: supabase/migrations/20261010_fix_workspace_creation_rls.sql
-- RETURNING checks SELECT access before the AFTER INSERT ownership trigger.
drop policy if exists "Members can read workspaces" on public.workspaces;
create policy "Members can read workspaces" on public.workspaces
  for select to authenticated
  using (created_by = auth.uid() or public.is_workspace_member(id));

-- History and folders follow board/workspace access; private content is not public.
create policy "Workspace members can read projects" on public.board_projects
  for select to authenticated using (public.is_workspace_member(workspace_id::uuid));
create policy "Workspace members can manage projects" on public.board_projects
  for all to authenticated
  using (public.is_workspace_member(workspace_id::uuid))
  with check (public.is_workspace_member(workspace_id::uuid));

create policy "Board readers can read snapshots" on public.board_snapshots
  for select to authenticated using (exists (
    select 1 from public.boards b where b.id::text = board_id
  ));
create policy "Board editors can insert snapshots" on public.board_snapshots
  for insert to authenticated with check (
    created_by = auth.uid()::text and exists (
      select 1 from public.boards b where b.id::text = board_id
      and public.get_board_role(b.id) in ('owner', 'editor')
    )
  );
create policy "Board editors can delete snapshots" on public.board_snapshots
  for delete to authenticated using (exists (
    select 1 from public.boards b where b.id::text = board_id
    and public.get_board_role(b.id) in ('owner', 'editor')
  ));

drop policy "Board members can insert activity" on public.board_activity;
create policy "Board members can insert activity" on public.board_activity
  for insert to authenticated with check (
    public.is_board_member(board_id) and user_id = auth.uid()
  );

-- Avoid the older author-only ALL policy permitting inserts on unrelated boards.
drop policy "Members can manage their comments" on public.comments;
drop policy "Users can create comments on accessible boards" on public.comments;
create policy "Users can create comments on accessible boards" on public.comments
  for insert to authenticated with check (
    author_id = auth.uid() and exists (
      select 1 from public.boards b where b.id = comments.board_id
    )
  );

notify pgrst, 'reload schema';
commit;
