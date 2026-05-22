# Tech Stack & Concepts — v1   (updated 2026-05-22)

> Sub-map of `PROJECT_MAP.md`. Lists the languages used in this codebase and
> the programming concepts behind them. Written as a learning reference —
> every concept points at a real file you can open.

## Changelog

| v | date       | change                                              |
|---|------------|-----------------------------------------------------|
| 1 | 2026-05-22 | initial — languages, JS concepts, architecture      |

---

## 1. Languages

| Language               | Where                                                        | What it does here                                              |
|------------------------|--------------------------------------------------------------|----------------------------------------------------------------|
| **JavaScript (Node.js)** | `bot.js`, `parser.js`, `db.js`, `matcher.js`, `dashboard.js`, all of `routes/` + `lib/` | The main language. Runs the bot + web server. ~95% of the code.|
| **SQL**                | `schema.sql`, every Supabase query                           | Talks to the database (Supabase = PostgreSQL underneath).      |
| **HTML**               | built as text inside `lib/views.js`, `routes/clusters.js`    | The structure of the web pages users see.                      |
| **CSS**                | same files, inside `<style>` strings                         | Page styling — colors, layout, spacing.                        |
| **Browser JavaScript** | `<script>` blocks built as Node string arrays               | Runs in the user's browser (card expand, toggles). Separate from Node.js JS. |
| **Bash / shell**       | deploy command, the hook in `.claude/settings.json`          | Glue commands — deploy, git, the PM2 restart.                  |
| **JSON**               | `package.json`, `.claude/settings.json`, API payloads        | Config + data format. Structured data, not really "code".      |
| **Cron syntax**        | `0 * * * *` in `ecosystem.config.js`                         | "Run every hour" — schedules the digest.                       |
| **Markdown**           | `CLAUDE.md`, `PROJECT_MAP.md`, `STATUS` files                | Docs. Plain text with light formatting.                        |
| **YAML**               | the `---` block atop `SKILL.md`                              | Config format — used for skill metadata.                       |

Bottom line: **one main language (JavaScript)**, plus SQL for the database and
HTML/CSS for the pages. Everything else is config or glue.

## 2. JavaScript concepts

Each points at a real file in this repo so you can see it live.

**Modules — splitting code into files.**
`require('./parser')` pulls in another file; `module.exports = {...}` declares
what a file shares out. → top of `bot.js`, bottom of `lib/data.js`. This is why
the project is many small files instead of one giant one.

**Destructuring — unpacking.**
`const { parseMessage } = require('./parser')` grabs one named thing out of a
bundle. → top of `bot.js`.

**async / await — waiting for slow things.**
Database queries and LLM calls take time. `await` means "pause here until this
finishes". A function using `await` must be marked `async`. → `async function
fetchOpenMatches` in `lib/data.js`.

**Callbacks — "run this when X happens".**
`app.use(function(req, res, next){ ... })` hands Express a function to run on
every request. → `dashboard.js`.

**Objects & arrays — data shapes.**
Object = labelled box `{ name: 'bot', port: 3004 }`. Array = ordered list
`[a, b, c]`. → the `apps: [ ... ]` array in `ecosystem.config.js`.

**Error handling.**
`if (result.error) throw new Error(...)` — stop and complain when something
breaks. → `lib/data.js`.

**Set — a no-duplicates list.**
`new Set()` holds unique values only. → `monitoredGroupIds` in `bot.js`.

**Environment variables.**
`process.env.DASHBOARD_PORT` reads secret/config values from outside the code
(the `.env` file). Keeps API keys out of the source. → `dashboard.js` line 73.

**Loops & conditionals.**
`for (...)`, `if / else` — repeat and branch. → `lib/data.js`.

## 3. Architecture concepts

Not language features — how the app is put together.

**Express** — the web framework. Handles incoming web requests, sends back
pages. Sub-concepts: **routes** (`/housing` → which code runs), **middleware**
(`auth.js` runs *before* the route, checks who you are), **req / res**
(request in, response out).

**Event-driven** — `bot.js` does not run top-to-bottom and stop. It *listens*:
"when a WhatsApp message arrives, do this". Express listens the same way for
web requests.

**Database CRUD** — Create, Read, Update, Delete. Every `db.js` function is one
of those four against Supabase.

**The pipeline** — message → parse (LLM) → store (DB) → match. Each stage is
one file. That chain is the whole app.

**External APIs** — `parser.js` sends text to an LLM over the internet and gets
JSON back. The bot uses the Baileys library to talk to WhatsApp.

**Process management** — PM2 keeps the programs running, restarts them on
crash, and runs the cron job.

## 4. The big-picture shape

Most web apps split into three: **logic** (JavaScript), **data** (SQL), and
**presentation** (HTML/CSS). This project follows that split. The
`parser → db → matcher` chain of small single-job files is also a classic
pattern — easier to read and fix than one large file.
