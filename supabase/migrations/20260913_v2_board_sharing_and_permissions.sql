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
