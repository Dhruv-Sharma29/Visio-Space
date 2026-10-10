# Supabase setup

The app's Supabase URL must match the project selected in the dashboard.

## Empty project

Run the complete `supabase/bootstrap.sql` in Supabase SQL Editor as `postgres`.
It initializes the tables, helper functions, ownership triggers, and RLS policies
needed by the current app, including the October board-persistence fix.
It runs in a transaction and refuses to run against a public schema that already
contains tables. It does not delete existing auth users.

The historical migration files are not a working fresh-install sequence:
several share the same date, the complete foundation repeats the original
foundation, and later `CREATE TABLE IF NOT EXISTS` statements do not add columns
to tables created by the foundation. The bootstrap includes those migrations in
dependency order with the missing comment, notification, and activity columns.
Folder and history policies are limited to workspace or board access, and the
collaborator RPC checks board access. The original notification insertion policy
allows any authenticated user to insert a notification; reads remain limited to
the recipient.

Do not replay the historical migrations after bootstrapping. For an existing
installation, use only new incremental migrations after inspecting its schema.

Projects initialized before the workspace-creation fix should run
`supabase/migrations/20261010_fix_workspace_creation_rls.sql`. This lets a creator
read a newly inserted workspace before its membership trigger executes, so
`INSERT ... RETURNING` succeeds instead of falling back to `local-default-ws`.

## Verification

Confirm SQL Editor reports success. In the signed-in app, create a board, add a
card, refresh, and confirm the board and card remain. Check that its creator has
editor membership, and check the notification panel.

The integration test uses an isolated PostgreSQL database provided by PGlite.
It recreates Supabase's auth roles and helpers, reproduces the original missing
table error, and verifies persistence, RLS isolation, creator access without
membership, workspace creation, viewer/editor collaboration permissions, current
comment/activity fields, notifications, and safe refusal to
bootstrap an initialized database. It never connects to a remote database.

PGlite is a development dependency; these tests run with `npm test` and
`npm run release:check`. To run only the database tests:

```sh
node --test supabase/tests/bootstrap.test.mjs
```
