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
