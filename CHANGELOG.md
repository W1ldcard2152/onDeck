# Changelog — Praxis

All notable changes to the Praxis app (cloud / Supabase tier).

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are `YYYY-MM-DD`. This project has no git history and no release tags, so
entries are grouped by date rather than version number.

## ⚠️ Downstream impact

Praxis is the **top** of the data flow (`Praxis → Logos → Prime`). Logos consumes
the Supabase schema directly through `logos/scripts/export-supabase-data.js` and
`logos/scripts/import-to-sqlite.js`, and neither app validates the other's schema
at build time.

**Any change to a Praxis table that Logos imports must be recorded here under a
`### Schema` heading with an explicit downstream note**, and mirrored in
`logos/CHANGELOG.md`. Tables Logos imports today:

`items` · `tasks` · `notes` · `habits` · `contexts` · `projects` · `project_steps` ·
`quotes` · `keystones` · `knowledge_bases` · `checklist_templates` ·
`checklist_items` · `checklist_contexts` · `checklist_completions` ·
`relationships` · `communications` · `catalog`

---

## [Unreleased]

Nothing yet.

---

## 2026-08-26

### Notes

No Praxis code changed today. This entry records the downstream consequence of
two earlier Praxis schema changes, discovered while debugging an empty Logos
dashboard — see `logos/CHANGELOG.md` for the fix.

The columns added by the Google Tasks sync and task-triage migrations, plus
`checklist_template_id`, had no counterpart in the Logos `tasks` and `habits`
tables. The Logos importer built its `INSERT` from the exported JSON's keys, so
`db.prepare()` threw on the unknown column and the importer's `catch` swallowed
it — **every task and habit silently failed to import** while the import
reported success.

The `contexts` migration below was also only half-consumed downstream: Logos
read `tasks.daily_context` but had no `contexts` table to resolve the UUIDs
against, so its context tabs matched almost nothing. Logos now imports
`contexts` and drives its dashboard from it — see `logos/CHANGELOG.md`.

`contexts` is therefore now part of the set of tables Logos imports, and is
listed above.

Logos now mirrors every column of every table it imports, so a Praxis column
added from here on will be *dropped and logged* rather than silently lost — but
it still needs adding on the Logos side. See the note at the top of this file.

---

## Baseline — schema history

Reconstructed from the migration files in `scripts/`, which are applied by hand
in the Supabase SQL editor. Ordering within a group is approximate; only
`add_sort_order_to_tasks.sql` carries an explicit date (2025-01-21).

### Schema — contexts become first-class (`contexts-migration.sql`)

**Breaking for downstream consumers.**

- Added the `contexts` table: user-scoped, user-defined daily contexts with
  `name`, `emoji`, `color`, `sort_order`, under RLS.
- Seeded the four previous hardcoded contexts (Morning, Work, Family, Evening)
  as rows for every existing user.
- **Migrated `tasks.daily_context` from a JSON array of literal names
  (`["morning"]`) to a JSON array of `contexts.id` UUIDs.**
- Unrecognised legacy string values were dropped by the migration.

> **Downstream:** any consumer that pattern-matches `daily_context` against the
> strings `morning` / `work` / `family` / `evening` is now wrong. Contexts are
> user-defined, so the four defaults are no longer an exhaustive set — this
> user's live contexts are Morning, Development, Phoenix Automotive, Family and
> Evening, with no "Work". Consumers must import `contexts` and resolve by ID.
>
> Handled in Logos on 2026-08-26. Prime inherits `contexts` through the LogosDB
> USB copy, but has no dashboard consuming it today.

### Schema — Google Tasks sync (`google-tasks-sync-migration.sql`, `user-integrations-migration.sql`)

- Added `tasks.google_task_id`, `tasks.google_etag`, `tasks.last_synced_at` to
  support two-way sync with Google Tasks (Phase 4).
- Added the `user_integrations` table for OAuth token storage.

> **Downstream:** three new `tasks` columns. Logos mirrors all three as of
> 2026-08-26, though it does not act on them — it never syncs to Google itself.

### Schema — task triage (`add-task-triaged-at-migration.sql`)

- Added `tasks.triaged_at`, marking when a Google-imported task has been triaged.

> **Downstream:** one new `tasks` column. Mirrored in Logos as of 2026-08-26.

### Schema — task ordering (`add_sort_order_to_tasks.sql`, 2025-01-21)

- Added `tasks.sort_order` for manual ordering independent of `assigned_date`.
- Follow-ups: `add_sort_order_simple.sql`, `check_and_add_sort_order.sql`,
  `fix_sort_order_values.sql` (backfilled sequential values).

### Schema — daily contexts, first pass (`daily-context-migration.sql`)

- Added `tasks.daily_context` as a JSON array of literal context names, replacing
  time-based organisation. Later superseded by `contexts-migration.sql` above.

### Schema — task times (`task-time-migration.sql`)

- Added `start_time`, `end_time`, `estimated_duration`, `reminder_time` to `tasks`.

### Features

- **Knowledge base** (`migration.sql`) — `keystones` and `knowledge_bases` tables.
- **Checklists** (`checklists-migration.sql`) — `checklist_templates`,
  `checklist_items`, `checklist_contexts`, `checklist_completions`. Also added
  `tasks.checklist_template_id` and `habits.checklist_template_id`.

  > **Downstream:** Logos dropped both until 2026-08-26 — 99 tasks were carrying
  > a template id that never survived the import. Mirrored now.
- **Quotes** (`quotes-migration.sql`) — `quotes` table; the `items.item_type`
  check constraint was widened to accept `quote`
  (`quotes-fix-constraint.sql`, `quotes-fix-constraint-safe.sql`).
- **Relationships** (`relationships-migration.sql`) — `relationships` and
  `communications` tables.
- **Catalog** (`catalog-migration.sql`) — `catalog` table for URL and resource
  capture.
- **Train of Thought** (`train-of-thought-migration.sql`) — added `notes.note_type`
  to separate formal notes from train-of-thought notes.
- **Feedback** (`feedback-migration.sql`) — `feedback` table. Read via API from
  both Praxis and Logos; deliberately **not** imported into SQLite.
- **Monthly habit regeneration** — Supabase edge function in
  `supabase/functions/monthly-habit-regeneration`.
