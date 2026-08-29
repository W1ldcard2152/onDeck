# Praxis — Developer Guide

> [!CAUTION]
> ## Two checkouts, two databases — `C:\SophiaDB\` IS OFF LIMITS HERE
>
> Logos runs from **two separate checkouts against two separate databases**:
>
> | Checkout | Database | Contents |
> | --- | --- | --- |
> | **`dev_sophia`** (this repo) | `dev_sophia/sophiadb/` | Development copy — a *subset* of real data (e.g. a few inventory items, not the whole inventory) |
> | **live codebase** (elsewhere) | `C:\SophiaDB\` | The real, sensitive database |
>
> **All development happens here.** Changes are then pushed/pulled to the live
> codebase, which points at `C:\SophiaDB\` through its own `.env`.
>
> The two databases must never meet. Cross-contamination in either direction —
> dev code writing real data, or real records leaking into the dev copy — is the
> exact failure this split exists to prevent.
>
> **From this repo, never:**
>
> - read from or write to any path under `C:\SophiaDB\`
> - hardcode `C:\SophiaDB` anywhere, including as a fallback default
> - point `LOGOS_DB_PATH`, `PRIME_DB_PATH`, `LOGOS_FILE_STORE` or
>   `INVENTORY_IMAGE_DIR` at it, in `.env`, a shell command, or a one-off script
> - suggest a command that overrides one of those vars to a `C:\SophiaDB` path
>
> Always derive paths from `LOGOS_DB_PATH` / `PRIME_DB_PATH`. Those resolve to
> `dev_sophia/sophiadb/` here, and the in-repo defaults do too, so plain
> `npm run dev` and every script stay on the dev copy.
>
> `.env` is gitignored, so each checkout keeps its own paths and a push/pull will
> not overwrite them. `.env.example` **is** committed and travels between the two —
> keep it explicit about which checkout a value belongs to.
>
> If a task seems to require live data, **stop and ask** — do not reach for the
> live path yourself.


Praxis is the always-online, low-sensitivity node of Sophia: a Next.js PWA on
Supabase for day-to-day capture and execution from phone and laptop. See the
root `CLAUDE.md` for how it fits the three-tier system.

- **Next.js 14** (Pages-router shims under `src/pages` + App Router under
  `src/app`), **React 18**, **Supabase (PostgreSQL)**, **port 3000**.
- This is the **only** app that uses a `src/` directory.

```bash
npm run dev --prefix praxis     # http://localhost:3000
npm run build --prefix praxis   # verification — must exit 0 (no test suites)
```

## Layout

```
src/
├── app/          App Router pages (dashboard, tasks, notes, …) + api/
│   └── api/      Server-only routes: integrations/google/*, sync/*, quote-of-the-day
├── pages/        _app.tsx, _document.tsx (Pages-router plumbing only)
├── components/   Feature components + ui/ (shadcn), layouts/, settings/, sync/
├── contexts/     GoogleSyncContext, SearchContext
├── hooks/        useTasks, useHabits, useNotes, … (one per domain)
├── lib/          Data services, Supabase clients, integrations, utils
└── types/        database.types.ts (generated), checklist.types.ts
```

## Data Layer

There is **no general REST API** — most reads/writes go straight to Supabase from
the client:

- **Hooks** (`src/hooks/use*.ts`, all `'use client'`) own component state and
  call Supabase via `getSupabaseClient()` (`lib/supabase-client.ts`) or delegate
  to a service.
- **Services** (`lib/taskService.ts`, `lib/entryService.ts`) hold shared
  mutation logic and run on **both client and server** — keep them isomorphic.
- `lib/supabase.ts` is the SSR/server helper; `lib/supabase-client.ts` is the
  browser singleton.
- Auth is enforced in `middleware.ts` (redirects unauthenticated users to `/`).
  Most data carries a `user_id`.

> **Tasks are special — no `user_id` on the `tasks` table.** Match existing query
> patterns; do not add a `user_id` filter to task queries.

## Google Tasks Sync (Phase 4 — complete)

Two-way sync between the `tasks` table and Google Tasks. Architecture:

- **Server-only** modules (`'server-only'`): `googleTasksSync.ts`,
  `googleTasksClient.ts`, `googleAuth.ts`, `integrations.ts`. Never import these
  from client code — call the `/api/sync/*` routes instead.
- Routes: `api/sync/now`, `api/sync/push-task`, `api/sync/push-deletions`, and
  `api/integrations/google/{authorize,callback,status,disconnect}`.
- `taskService` mutations fire **fire-and-forget** background pushes
  (`pushTaskInBackground`, `pushPendingDeletionsInBackground`) via `fetch` to the
  sync routes — only in the browser (`typeof window !== 'undefined'`).
- **Do not refactor `googleTasksSync.ts` to use `taskService`.** It writes to
  `tasks`/`items` directly on purpose; routing pulls through `taskService` would
  re-trigger pushes and create an echo loop. (See the header comment in that file.)
- Sync status lives in `user_integrations.sync_status` (`ok` / `failed` /
  `auth_expired`); `last_synced_at` doubles as the pull watermark, so **only
  `pullTasks` advances it**. Every sync path must end by writing status.
- OAuth tokens are encrypted via `lib/encryption.ts`.

## PWA & Offline

- Installable PWA (`InstallPWA`, `PWAHead`, service worker in `public/`,
  `hooks/useServiceWorker.ts`, `usePWAInstall.ts`).
- Offline mutations queue in `lib/offlineSyncQueue.ts` and drain on reconnect
  (`hooks/useOfflineSync.ts`, `OfflineNotification`).

## Conventions

- **Route params are synchronous** (Next 14): `{ params: { id: string } }` — no
  `await`. (Logos/Prime on Next 16 differ.)
- **Dates** go through `lib/timezone.ts` — `nowISO()` to store UTC, `formatDate`
  / `toDate` to display. Never `new Date().toISOString().split('T')[0]` or raw
  `toLocaleDateString()`.
- `lib/types.ts` holds shared domain types; `src/types/database.types.ts` is the
  generated Supabase schema type — regenerate it after migrations.
- Supabase migrations / edge functions live under `supabase/`.
- shadcn/ui in `components/ui/` — don't modify. `TruncatedCell` handles table
  overflow. Orange accent (`bg-orange-300`), light theme.
