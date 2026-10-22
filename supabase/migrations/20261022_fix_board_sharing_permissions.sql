-- VisioSpace: close sharing permission holes.
-- A board shared as 'editor' let any signed-in user edit it, so they could also
-- rewrite its owner and sharing columns and manage its collaborators. Link
-- editors keep editing content; ownership and membership stay with members.

-- Creator, invited editor, or workspace owner. Excludes the public_access fallback.
create or replace function public.can_manage_board(target_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.boards b
    where b.id = target_board_id
      and (b.created_by = auth.uid()
        or public.is_board_editor(b.id)
        or public.is_workspace_owner(b.workspace_id))
  );
$$;

grant execute on function public.can_manage_board(uuid) to authenticated;

create or replace function public.guard_board_update()
returns trigger language plpgsql set search_path = public as $$
begin
  -- No JWT subject: SQL Editor or service role.
  if auth.uid() is null then
    return new;
  end if;
  if new.created_by is distinct from old.created_by
    or new.workspace_id is distinct from old.workspace_id then
    raise exception 'A board''s owner and workspace cannot be changed' using errcode = '42501';
  end if;
  if (new.public_access is distinct from old.public_access
    or new.share_token is distinct from old.share_token)
    and not public.can_manage_board(old.id) then
    raise exception 'Only board members can change sharing settings' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_board_update on public.boards;
create trigger guard_board_update
  before update on public.boards
  for each row execute function public.guard_board_update();

create or replace function public.invite_board_collaborator(
  target_board_id uuid,
  target_username text,
  target_role text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_uid uuid;
  clean_username text;
begin
  if not public.can_manage_board(target_board_id) then
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

create or replace function public.update_board_collaborator_role(
  target_board_id uuid,
  target_user_id uuid,
  new_role text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_board(target_board_id) then
    raise exception 'Unauthorized to update roles on this board';
  end if;

  update public.board_members
  set role = new_role::public.board_role
  where board_id = target_board_id and user_id = target_user_id;
end;
$$;

create or replace function public.remove_board_collaborator(
  target_board_id uuid,
  target_user_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_board(target_board_id) then
    raise exception 'Unauthorized to remove collaborators from this board';
  end if;

  delete from public.board_members
  where board_id = target_board_id and user_id = target_user_id;
end;
$$;

-- Activity follows board visibility, like snapshots, instead of requiring a
-- membership row that workspace members and link users do not have.
drop policy if exists "Board members can read activity" on public.board_activity;
create policy "Board members can read activity" on public.board_activity
  for select to authenticated using (exists (
    select 1 from public.boards b where b.id = board_activity.board_id
  ));
drop policy if exists "Board members can insert activity" on public.board_activity;
create policy "Board members can insert activity" on public.board_activity
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.boards b where b.id = board_activity.board_id
    )
  );

-- Without WITH CHECK, an author could move a comment onto a board they cannot read.
drop policy if exists "Author or board owner can update comments" on public.comments;
create policy "Author or board owner can update comments"
  on public.comments for update to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.boards b
      where b.id = comments.board_id and b.created_by = auth.uid()
    )
  )
  with check (
    (author_id = auth.uid()
      or exists (
        select 1 from public.boards b
        where b.id = comments.board_id and b.created_by = auth.uid()
      ))
    and exists (select 1 from public.boards b where b.id = comments.board_id)
  );

notify pgrst, 'reload schema';
