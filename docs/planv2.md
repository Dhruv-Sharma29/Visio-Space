# Visio-Space V2 Implementation Plan — Collaborative Sensemaking

**Scope:** Turn Visio-Space (currently a frontend-only, local-state canvas app — React 19 + Vite, TypeScript, React-Konva, Zustand) into a multi-user collaborative workspace with accounts, real-time editing, comments, permissions, and board/version management.

This is the biggest architectural jump in the product's life so far: **V1 has no backend at all.** Everything below assumes you're introducing one for the first time, so Phase 0 (foundation) is not optional — it's the prerequisite for every other V2 feature.

---

## 0. Current-State Gap Analysis

| V2 requirement | Needs a backend? | Why |
|---|---|---|
| User login / accounts | Yes | Auth, sessions, user records |
| Real-time multiplayer editing | Yes | Shared state sync engine |
| Live cursors / presence | Yes | Ephemeral pub-sub channel |
| Comments, @mentions, notifications | Yes | Persistent relational data |
| Version history / restore | Yes | Append-only snapshot storage |
| Shareable boards, permissions | Yes | Auth + ACL layer |
| Teams / workspaces | Yes | Multi-tenant data model |

Every V2 feature depends on having a backend. So the real first milestone is: **stand up auth + a database + a real-time layer**, then build features on top.

---

## 1. Recommended Stack

For a project at this stage (student-built, needs to move fast, currently zero backend), avoid hand-rolling auth and a WebSocket server from scratch. Two viable paths:

### Option A — Supabase (recommended to start)
- **Auth**: Supabase Auth (email/password, magic link, Google/GitHub OAuth) — drop-in, handles password reset, email verification, JWT issuance.
- **Database**: Postgres (managed), with Row Level Security (RLS) for permissions — this maps naturally to "viewer/editor" access control.
- **Realtime**: Supabase Realtime (Postgres logical replication → WebSocket) for presence, cursors, and board change broadcast.
- **Storage**: Supabase Storage for avatars/exports.
- **Why it fits you**: one provider, generous free tier, official JS client, and RLS gives you permissions almost for free instead of writing custom middleware.

### Option B — Custom Node/Express + Socket.io + Postgres + Auth.js (NextAuth)
- More control, more work. Better if you outgrow Supabase's realtime model (e.g., need custom CRDT conflict resolution) or want the backend as its own portfolio piece.
- Use this if you want to demonstrate backend engineering skill explicitly (relevant to your DS/AI-ML positioning less so, but shows full-stack range).

**Recommendation:** Start with **Option A (Supabase)** to ship V2 features fast, and keep Option B in mind for V3 if you need custom real-time CRDT logic for AI-assisted board reorganization (concurrent AI writes + human edits will need careful conflict handling).

For collaborative canvas sync specifically, layer in **Yjs** (CRDT library) regardless of backend choice — it's the standard for real-time canvas/whiteboard sync (used by tldraw, Excalidraw) and handles conflict-free merging of concurrent card/shape edits far better than naive "last write wins."

- `yjs` + `y-websocket` (or `y-supabase` community provider) for document sync
- Bind Yjs shared types to your existing Zustand store via a sync middleware layer, rather than ripping out Zustand

---

## 2. Data Model (core tables)

```
users            id, email, display_name, avatar_url, created_at
workspaces       id, name, owner_id, created_at
workspace_members  workspace_id, user_id, role (owner/admin/member)
boards           id, workspace_id, title, created_by, created_at, updated_at
board_members    board_id, user_id, role (viewer/editor)
board_snapshots  id, board_id, snapshot_data (jsonb), created_by, created_at   -- version history
cards            id, board_id, type, position, data (jsonb), created_by, updated_at
comments         id, card_id, board_id, author_id, body, parent_comment_id, created_at
mentions         comment_id, mentioned_user_id
notifications    id, user_id, type, payload (jsonb), read_at, created_at
activity_log     id, board_id, user_id, action, metadata (jsonb), created_at
```

Notes:
- `cards.data` as `jsonb` keeps you flexible for the varied card/shape/connector schema you already have in Konva — don't force a rigid relational schema onto canvas objects.
- `board_snapshots` gives you version history cheaply: snapshot on every N edits or every few minutes, plus on-demand "save version."
- RLS policies on `boards`/`cards` check `board_members` for read/write — this is your permission system.

---

## 3. Phased Build Order

### Phase 0 — Foundation (auth + backend skeleton)
1. Provision Supabase project; define schema above via migrations.
2. Add `@supabase/supabase-js` client to the frontend.
3. Build auth UI: sign up, log in, log out, password reset, OAuth (Google) button.
4. Add an auth context/provider wrapping the app; gate routes (redirect to `/login` if no session).
5. Add a `users` row auto-created on sign-up (Supabase trigger or edge function).
6. **Milestone check:** a user can register, log in, and see an empty "My Boards" screen tied to their account.

### Phase 1 — Boards & Workspaces (persistence layer)
1. Replace local-only Zustand persistence with Supabase-backed boards: create/list/open/delete boards.
2. Add workspaces: create a workspace, invite members by email, assign roles.
3. Migrate existing local board JSON export/import format to also serialize to `cards`/`board_snapshots` rows.
4. **Milestone check:** boards persist server-side and are scoped to a workspace; opening the app shows your real boards, not local-storage state.

### Phase 2 — Real-Time Multiplayer
1. Integrate Yjs document per board; wire Konva card/shape mutations through Yjs shared maps instead of directly into Zustand.
2. Connect Yjs provider over Supabase Realtime (or a small dedicated `y-websocket` server if you go that route).
3. Presence: broadcast cursor position + user color/avatar on a Realtime presence channel; render remote cursors as an overlay layer in Konva.
4. Follow/Spotlight mode: one user's viewport (pan/zoom) broadcast to others; a "follow" toggle subscribes a client to that user's viewport updates.
5. **Milestone check:** two browser tabs (or two people) editing the same board see each other's changes and cursors live.

### Phase 3 — Permissions & Sharing
1. Shareable board links: generate a token/slug; "anyone with the link" viewer access vs. explicit invite for editors.
2. Viewer/editor enforcement both in UI (disable edit tools for viewers) and in RLS (defense in depth — never trust the client alone).
3. **Milestone check:** a viewer-role user can open a board and see live updates but cannot move/create/delete cards.

### Phase 4 — Communication Layer
1. Comments: attach to a card, threaded replies (`parent_comment_id`), realtime subscription so new comments appear live.
2. @mentions: parse `@username` in comment body, resolve to user IDs, insert into `mentions`, trigger a notification.
3. Notifications: in-app notification bell backed by the `notifications` table + Realtime subscription; mark-as-read.
4. User profiles/avatars: profile edit screen, avatar upload to Supabase Storage.
5. **Milestone check:** commenting and mentioning teammates produces a live notification for them.

### Phase 5 — Board Management
1. Version history: list snapshots per board with timestamp + author; "restore" reverts `cards` to a snapshot's state (write a new snapshot first, so restore is itself undoable).
2. Activity log: render a feed from `activity_log` (who did what, when) per board.
3. Search within a board: client-side filter over card `data` text fields to start; move to Postgres full-text search (`tsvector`) if boards get large.
4. Organize boards into projects/workspaces: add a `projects` grouping layer inside a workspace if you want folder-style organization beyond flat workspace → boards.
5. **Milestone check:** a user can see board history, restore an old version, and search cards by text.

---

## 4. Cross-Cutting Concerns

- **Conflict resolution:** Yjs handles concurrent edits at the data-structure level; you still need app-level rules for things like "two people delete the same card simultaneously" (Yjs will converge safely, but the UI should not error).
- **Offline/latency handling:** Yjs supports offline edits merging back in — worth testing since board sessions may have flaky connections.
- **Security:** never enforce permissions only in the frontend; RLS (or equivalent backend checks) is the real boundary. Treat client-side viewer/editor UI restrictions as UX sugar only.
- **Cost/scale:** Supabase free tier is fine through development and a small user base; watch Realtime connection limits if this becomes a public-facing project.
- **Testing multiplayer:** use two browser profiles (or an incognito window) locally to validate presence/live-cursor/comment flows before considering a feature done.

---

## 5. Suggested Milestone Order (summary)

1. Auth + empty dashboard
2. Persisted boards + workspaces
3. Real-time multiplayer editing + cursors
4. Follow/spotlight mode
5. Sharing + viewer/editor permissions
6. Comments + mentions + notifications
7. Version history + activity log + search
8. Projects/workspace organization polish

This order front-loads the highest-risk, most foundational work (auth, persistence, real-time sync) and defers polish (search, project folders) to the end, so you always have a working, demoable app at each step — useful for both your portfolio narrative and avoiding a big-bang integration at the end.
