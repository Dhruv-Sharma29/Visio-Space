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
