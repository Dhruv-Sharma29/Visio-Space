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
