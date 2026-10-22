import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const migrations = new URL('../migrations/', import.meta.url);

async function database() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select current_user::text $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
  `);
  return db;
}

test('the standalone persistence update reproduces the missing-table failure', async () => {
  const db = await database();
  try {
    await assert.rejects(db.exec(await readFile(new URL('20261009_fix_board_persistence.sql', migrations), 'utf8')),
      error => error.code === '42P01' && error.message.includes('public.boards'));
  } finally { await db.close(); }
});

test('bootstrap supports authenticated board persistence, membership and notifications', async () => {
  const db = await database();
  try {
    const bootstrap = await readFile(new URL('../bootstrap.sql', import.meta.url), 'utf8');
    await db.exec(bootstrap);
    const owner = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'owner@example.invalid', '{"username":"owner","full_name":"Owner"}'),
      ($2, 'other@example.invalid', '{"username":"other","full_name":"Other"}')`, [owner, other]);
    const workspace = (await db.query('select id from public.workspaces where created_by = $1', [owner])).rows[0].id;
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    // RETURNING is authorized before the AFTER INSERT membership trigger runs.
    const createdWorkspace = (await db.query(`insert into public.workspaces (name, created_by)
      values ('Workspace creation verification', $1) returning id`, [owner])).rows[0].id;
    assert.equal((await db.query('select role from public.workspace_members where workspace_id = $1', [createdWorkspace])).rows[0].role, 'owner');
    const board = (await db.query(`insert into public.boards (workspace_id, title, created_by)
      values ($1, 'Persistence verification', $2) returning id`, [workspace, owner])).rows[0].id;
    assert.equal((await db.query('select role from public.board_members where board_id = $1', [board])).rows[0].role, 'editor');
    await db.query(`update public.boards set state = '{"cards":[{"id":"test-card"}]}' where id = $1`, [board]);
    assert.equal((await db.query('select state from public.boards where id = $1', [board])).rows[0].state.cards.length, 1);
    await db.query(`insert into public.comments (board_id, author_id, author_name, body, x, y)
      values ($1, $2, 'Owner', 'Verification comment', 10, 20)`, [board, owner]);
    await db.query(`insert into public.board_activity (board_id, user_id, user_name, action, description)
      values ($1, $2, 'Owner', 'board_created', 'Verification activity')`, [board, owner]);
    await db.query(`insert into public.board_snapshots (board_id, name, created_by) values ($1, 'Verification', $2)`, [board, owner]);
    await db.query(`insert into public.notifications (user_id, board_id, type, title, body)
      values ($1, $2, 'mention', 'Verification notification', 'A test notification')`, [other, board]);
    assert.equal((await db.query('select * from public.notifications')).rows.length, 0);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    assert.equal((await db.query('select * from public.boards where id = $1', [board])).rows.length, 0);
    assert.equal((await db.query('select * from public.board_snapshots')).rows.length, 0);
    assert.equal((await db.query('select * from public.board_activity')).rows.length, 0);
    await assert.rejects(db.query('select public.get_board_collaborators($1)', [board]), /Unauthorized/);
    assert.equal((await db.query('select * from public.notifications')).rows.length, 1);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    const invite = (await db.query(`select public.invite_board_collaborator($1, 'other', 'viewer') as result`, [board])).rows[0].result;
    assert.equal(invite.success, true);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    assert.equal((await db.query('select public.get_board_role($1) as role', [board])).rows[0].role, 'viewer');
    assert.equal((await db.query('select id from public.boards where id = $1', [board])).rows.length, 1);
    assert.equal((await db.query(`update public.boards set title = 'Unauthorized edit' where id = $1 returning id`, [board])).rows.length, 0);
    await assert.rejects(db.query(`select public.invite_board_collaborator($1, 'owner', 'editor')`, [board]), /Unauthorized/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await db.query(`select public.update_board_collaborator_role($1, $2, 'editor')`, [board, other]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    assert.equal((await db.query(`update public.boards set title = 'Collaborator edit' where id = $1 returning id`, [board])).rows.length, 1);
    await db.query('update public.notifications set read = true where user_id = $1', [other]);
    assert.equal((await db.query('select read from public.notifications')).rows[0].read, true);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await db.query('select public.remove_board_collaborator($1, $2)', [board, other]);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from public.board_snapshots')).rows.length, 0);
    assert.equal((await db.query('select * from public.board_activity')).rows.length, 0);
    await db.exec('reset role');
    // Creator access must survive missing membership, which is the original bug.
    await db.query('delete from public.board_members where board_id = $1', [board]);
    await db.query('delete from public.workspace_members where workspace_id = $1', [workspace]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    assert.equal((await db.query('select id from public.boards where id = $1', [board])).rows.length, 1);
    assert.equal((await db.query(`update public.boards set title = 'Creator access verified' where id = $1 returning id`, [board])).rows.length, 1);
    await db.query(`insert into public.board_members (board_id, user_id, role) values ($1, $2, 'editor')`, [board, owner]);
    await db.exec('reset role');
    await assert.rejects(db.exec(bootstrap), /empty public schema/);
    await db.exec('rollback');
    assert.equal((await db.query('select title from public.boards where id = $1', [board])).rows[0].title, 'Creator access verified');
  } finally { await db.close(); }
});

test('the incremental workspace repair fixes INSERT RETURNING without exposing other workspaces', async () => {
  const db = await database();
  try {
    await db.exec(await readFile(new URL('../bootstrap.sql', import.meta.url), 'utf8'));
    await db.exec(`drop policy "Members can read workspaces" on public.workspaces;
      create policy "Members can read workspaces" on public.workspaces
      for select to authenticated using (public.is_workspace_member(id));`);
    const owner = '33333333-3333-4333-8333-333333333333';
    await db.query(`insert into auth.users (id, email) values ($1, 'repair@example.invalid')`, [owner]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    await assert.rejects(db.query(`insert into public.workspaces (name, created_by)
      values ('Before repair', $1) returning id`, [owner]), error => error.code === '42501');
    await db.exec('reset role');
    await db.exec(await readFile(new URL('20261010_fix_workspace_creation_rls.sql', migrations), 'utf8'));
    await db.exec('set role authenticated');
    const workspace = (await db.query(`insert into public.workspaces (name, created_by)
      values ('After repair', $1) returning id`, [owner])).rows[0].id;
    assert.equal((await db.query('select role from public.workspace_members where workspace_id = $1', [workspace])).rows[0].role, 'owner');
    await db.query("select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false)");
    assert.equal((await db.query('select id from public.workspaces where id = $1', [workspace])).rows.length, 0);
  } finally { await db.close(); }
});

test('link editors edit content but cannot take over sharing, ownership or membership', async () => {
  const db = await database();
  try {
    await db.exec(await readFile(new URL('../bootstrap.sql', import.meta.url), 'utf8'));
    const [owner, member, linkUser, teammate] = ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666',
      '77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888'];
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'o@example.invalid', '{"username":"owner"}'), ($2, 'm@example.invalid', '{"username":"member"}'),
      ($3, 'l@example.invalid', '{"username":"linkuser"}'), ($4, 't@example.invalid', '{"username":"teammate"}')`,
      [owner, member, linkUser, teammate]);
    const workspace = (await db.query('select id from public.workspaces where created_by = $1', [owner])).rows[0].id;
    await db.query(`insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')`, [workspace, teammate]);
    const as = async user => {
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    };
    await as(owner);
    const board = (await db.query(`insert into public.boards (workspace_id, title, created_by)
      values ($1, 'Shared', $2) returning id`, [workspace, owner])).rows[0].id;
    await db.query(`select public.invite_board_collaborator($1, 'member', 'editor')`, [board]);
    await db.query(`update public.boards set public_access = 'editor' where id = $1`, [board]);
    // Senders insert without RETURNING because only the recipient can read the row.
    await db.query(`insert into public.notifications (id, user_id, board_id, type, title, body)
      values (gen_random_uuid(), $1, $2, 'mention', 'Mention', 'Body')`, [member, board]);

    await as(linkUser);
    assert.equal((await db.query(`update public.boards set title = 'Link edit' where id = $1 returning id`, [board])).rows.length, 1);
    await assert.rejects(db.query('update public.boards set created_by = $2 where id = $1', [board, linkUser]), error => error.code === '42501');
    await assert.rejects(db.query(`update public.boards set public_access = 'private' where id = $1`, [board]), error => error.code === '42501');
    await assert.rejects(db.query(`update public.boards set share_token = 'x' where id = $1`, [board]), error => error.code === '42501');
    await assert.rejects(db.query('select public.remove_board_collaborator($1, $2)', [board, member]), /Unauthorized/);
    await assert.rejects(db.query(`select public.update_board_collaborator_role($1, $2, 'viewer')`, [board, member]), /Unauthorized/);
    await assert.rejects(db.query(`select public.invite_board_collaborator($1, 'linkuser', 'editor')`, [board]), /Unauthorized/);

    await as(member);
    assert.equal((await db.query(`update public.boards set public_access = 'viewer' where id = $1 returning id`, [board])).rows.length, 1);
    await db.query(`insert into public.comments (board_id, author_id, author_name, body, x, y)
      values ($1, $2, 'Member', 'Comment', 0, 0)`, [board, member]);

    await as(owner);
    const privateBoard = (await db.query(`insert into public.boards (workspace_id, title, created_by)
      values ($1, 'Private', $2) returning id`, [workspace, owner])).rows[0].id;
    await as(member);
    await assert.rejects(db.query('update public.comments set board_id = $1 where author_id = $2', [privateBoard, member]),
      error => error.code === '42501');

    await as(teammate);
    await db.query(`insert into public.board_activity (board_id, user_id, user_name, action, description)
      values ($1, $2, 'Teammate', 'card_added', 'Workspace member activity')`, [board, teammate]);
    assert.equal((await db.query('select * from public.board_activity where board_id = $1', [board])).rows.length, 1);
  } finally { await db.close(); }
});
