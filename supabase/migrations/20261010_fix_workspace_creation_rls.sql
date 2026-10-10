-- Workspace creation uses INSERT ... RETURNING in workspaceService.
-- RETURNING checks SELECT access before the AFTER INSERT ownership trigger.
-- The creator must be able to read the row immediately, just as for boards.
begin;

drop policy if exists "Members can read workspaces" on public.workspaces;
create policy "Members can read workspaces" on public.workspaces
  for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_workspace_member(id)
  );

commit;
