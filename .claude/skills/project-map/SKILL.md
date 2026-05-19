---
name: project-map
description: >-
  Maintains PROJECT_MAP.md — a versioned, visual (ASCII) map of how the Aggie
  Connect v3 codebase fits together: data flow, files, tables, processes. Use
  this skill whenever the user asks how the project works, how a message flows
  through the system, where a file fits, what calls what, or asks to "show the
  architecture", "explain the structure", "update the map", or "regenerate the
  project map". Also use it right after a deploy or any change that adds,
  removes, or renames a source file / route / lib module / Supabase table /
  PM2 process — the map must be refreshed so it never goes stale. When the user
  asks what changed in the structure and when, read this skill to know where
  the changelog lives. Also use it when the user wants a deeper, detailed map
  of one part of the system (the parser, a route, the matcher) — those granular
  sub-maps live under maps/ and this skill defines how to build them.
---

# Project Map

Keeps a single living document, `PROJECT_MAP.md` (project root), that shows how
the Aggie Connect v3 codebase fits together as text/ASCII diagrams.

## Why this exists

The project has several docs already and each owns a different question:

| Doc                | Answers                                  |
|--------------------|------------------------------------------|
| `CLAUDE.md`        | What are the rules / conventions         |
| `STATUS_v3.*.md`   | What happened — sprint history           |
| `MEMORY.md`        | Session memory index                     |
| **`PROJECT_MAP.md`** | **What the structure IS — visual, current** |

`PROJECT_MAP.md` is the *structural* view. Do not duplicate sprint history or
rules into it — link or leave those to their own docs. If the map starts
restating sprint logs, trim it back to structure.

## The two jobs

### Job 1 — Answer "how does it work" / "show the architecture"

Read `PROJECT_MAP.md` and answer from it. The top of the file is always the
current state — that is the source of truth. Only dig into history (the
changelog table or `git log`) when the user explicitly asks what changed or
when.

If `PROJECT_MAP.md` does not exist yet, generate it (see Job 2, generation).

### Job 2 — Keep the map current

Update `PROJECT_MAP.md` when a **structural change** lands. Structural means the
shape of the system moved, not just its behavior:

**Bump the map for:**
- a source file added, removed, or renamed
- a new `routes/` file or route group
- a new `lib/` or `middleware/` module
- a new Supabase table
- a new PM2 process
- a changed data-flow path between components (e.g. a new queue, a new hop)
- a new external integration (new API, new service)

**Do NOT bump the map for:**
- bug fixes, copy edits, UI tweaks, styling
- new columns on an existing table
- routine sprint work that leaves the structure unchanged

This keeps the changelog short and meaningful — exactly so that "only when
required" can someone find out what changed.

## File format

`PROJECT_MAP.md` always has this shape, in this order:

```
# Project Map — v<N>   (updated <YYYY-MM-DD>)

> One-line description of the project.

## Changelog
| v | date       | change                                    |
|---|------------|-------------------------------------------|
| <N> | <date>   | <newest change — what structural thing moved> |
| ... older rows below, newest first ...               |

## <diagram + structure sections — current state only>
```

- **Newest changelog row on top.** Reader scans down for older.
- **Body = current state only.** Never keep "old version" diagrams in the body;
  git holds full history of the file.
- Version `<N>` is a plain incrementing integer. Bump by 1 per structural
  update. Header version and the top changelog row must always match.

## Updating procedure

1. Read the current `PROJECT_MAP.md`.
2. Identify what structural thing changed (see Job 2 list).
3. Edit the relevant diagram / section to reflect the new structure.
4. Bump the version integer in the `# Project Map — v<N>` header and the
   `(updated <date>)` to today (Central US date).
5. Add ONE new changelog row at the top of the table — terse, names the file /
   table / process that moved. Example: `added routes/digest.js — hourly digest`.
6. Commit `PROJECT_MAP.md` with the related change. The git history of this one
   file is the deep "what changed when" record; the changelog table is the
   quick human-readable summary.

## Diagram style

Plain ASCII — boxes and arrows, no Mermaid. It must render in a terminal and in
any editor with zero tooling. Keep it **high-level**: show data flow between
components and list the parts; do not drill into individual functions or
per-table columns. High-level means the map stays stable and the changelog
stays short.

Use box-drawing characters (`│ ─ └ ┌ ► ◄`) for the main flow diagram. Group the
rest as plain labelled lists (route files, tables, PM2 processes).

## Generating the map from scratch

If `PROJECT_MAP.md` is missing, build it by inspecting the repo, not by
guessing:

- `ls *.js routes/ lib/ middleware/` for the file inventory
- `CLAUDE.md` for the architecture summary, tables, PM2 processes, deploy flow
- skim `dashboard.js` to confirm what `routes/` and `middleware/` are mounted
- skim `bot.js` top only (do NOT modify it) to confirm the message-in path

Then write the file in the format above, starting at `v1` with a single
changelog row: `v1 | <date> | initial map`.

## Sections the map should contain

1. **Flow diagram** — WhatsApp message in → parse → store → match; and the web
   serving path. ASCII boxes.
2. **Core files** — one line each: `bot.js`, `parser.js`, `db.js`, `matcher.js`,
   `normalize.js`, `dashboard.js`, `monitor.js`.
3. **Web layer** — `routes/` files and what each serves; `lib/` modules;
   `middleware/`.
4. **Data** — Supabase `v3_*` tables and other tables, grouped by purpose.
5. **Processes** — PM2 processes, ports, deploy path.
6. **Utility scripts** — one-off / backfill scripts, clearly marked as not part
   of the running system.

Keep the whole file readable in one screen-scroll where possible.

## Sub-maps — detailed area maps

`PROJECT_MAP.md` is deliberately high-level so it stays stable. When someone
needs granular detail on one area — the parser's branching, a route's request
flow, the matcher's scoring — that detail belongs in a **sub-map**, not in
`PROJECT_MAP.md`. This is progressive disclosure: load the big picture by
default, open a sub-map only when that depth is actually needed.

**Where:** a `maps/` directory at the project root. One file per area, named
for the area: `maps/parser.md`, `maps/clusters-route.md`, `maps/matcher.md`.

**Format:** identical to `PROJECT_MAP.md` — version header, changelog table,
then the body. The body goes deep: key functions, branching logic, data shapes,
edge cases. Each sub-map versions independently of `PROJECT_MAP.md` and of
other sub-maps, because different areas change at different rates.

**Linking:** when a sub-map exists, add a pointer to it from `PROJECT_MAP.md`
next to that area — e.g. the `parser.js` row in the core-files table gets a
`→ maps/parser.md` note. The reader sees the high-level entry and knows where
to go for depth.

**When to create one:** only when the user asks for a detailed / granular map
of a specific part. Do not create sub-maps automatically — most areas never
need one, and an unused sub-map is just another doc that drifts.

**When to update one:** if an area has a sub-map and that area changes, update
the sub-map (bump its version, add its changelog row) the same way as the main
map. A structural change can touch both: the one-line entry in `PROJECT_MAP.md`
and the detail in the sub-map.
