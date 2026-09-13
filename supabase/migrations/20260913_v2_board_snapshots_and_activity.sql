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

-- Permissive policies allowing read/write for collaboration & guest modes
create policy "Allow all read on board_projects" on public.board_projects for select using (true);
create policy "Allow all insert on board_projects" on public.board_projects for insert with check (true);
create policy "Allow all update on board_projects" on public.board_projects for update using (true);
create policy "Allow all delete on board_projects" on public.board_projects for delete using (true);

create policy "Allow all read on board_snapshots" on public.board_snapshots for select using (true);
create policy "Allow all insert on board_snapshots" on public.board_snapshots for insert with check (true);
create policy "Allow all delete on board_snapshots" on public.board_snapshots for delete using (true);

create policy "Allow all read on board_activity" on public.board_activity for select using (true);
create policy "Allow all insert on board_activity" on public.board_activity for insert with check (true);
