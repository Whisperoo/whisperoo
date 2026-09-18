# Staging Environment — Local Ops Log

Append-only running log of every infra action taken for the Phase 2 staging
environment. Purpose: local record for us — what was run, when, what it
returned, and what state it left things in. Secrets are NEVER written here,
only the names of the variables they were stored under.

Plan this executes: `tasks/todo.md` → "Phase 2 — Hospital Pilot: Staging
Environment + Admin Portal Gaps", Parts 1–4.

Format per entry: `## YYYY-MM-DD HH:MM — title`, then Command / Result / State.

---

## 2026-08-22 — Part 1 blocked (recorded retroactively)

**Command:** `supabase projects create whisperoo-staging --org-id xacbamzejorrcnvqrzxx --region us-east-2`
**Result:** FAILED — `"Your account does not have the necessary privileges to access this endpoint"`.
Read access worked (`projects list`, `orgs list` both fine across all orgs); only
project *creation* in the Whisperoo org was denied. Diagnosed as the account
holding a Developer (not Owner/Administrator) role on the Whisperoo org.
**State:** Blocked pending client action. DB password generated into `.env.staging`
(git-ignored) under `SUPABASE_DB_PASSWORD` and held for reuse.

---

## 2026-08-26 — Access granted, resuming Part 1

**Context:** Client granted project-creation access on the Whisperoo Supabase org.
Free tier confirmed acceptable for staging.

**Pre-flight checks:**

| Check | Command | Result |
|---|---|---|
| CLI version | `supabase --version` | `2.115.0` |
| CLI auth | `supabase orgs list` | OK — 5 orgs visible incl. Whisperoo (`xacbamzejorrcnvqrzxx`) |
| Existing projects in Whisperoo org | `supabase projects list` | 1 only — `whisperoo` / ref `wznevejkaefokgibkknt` / us-east-2 / ACTIVE_HEALTHY / PG 17.4.1.048 |
| Staging env file | `ls -la .env.staging` | Exists, 54 bytes, contains `SUPABASE_DB_PASSWORD` only |
| Secret hygiene | `git check-ignore -v .env.staging` | Ignored via `.gitignore:30` |

**State:** Pre-flight clean. Proceeding to project creation.

---

## 2026-08-26 11:52 UTC — Part 1.2: staging Supabase project CREATED ✅

**Command:**
```
supabase projects create whisperoo-staging \
  --org-id xacbamzejorrcnvqrzxx \
  --region us-east-2 \
  --db-password "$SUPABASE_DB_PASSWORD"   # sourced from .env.staging, never echoed
  --yes
```

**Result:** SUCCESS.

| Field | Value |
|---|---|
| Project name | `whisperoo-staging` |
| **Project ref** | **`auttveumgltfedjptwfw`** |
| Org | Whisperoo (`xacbamzejorrcnvqrzxx`) |
| Region | `us-east-2` (matches prod) |
| Created | 2026-08-26T11:52:51Z |
| Dashboard | https://supabase.com/dashboard/project/auttveumgltfedjptwfw |
| Initial status | `UNKNOWN` — provisioning, not yet healthy |

**Notes:**
- Instance size left at org default (free tier / micro). No `--size` passed.
- No `--high-availability`. Staging does not need it.
- Prod project (`wznevejkaefokgibkknt`) untouched throughout.
- Ref written to `.env.staging` as `SUPABASE_STAGING_REF` (git-ignored file).

**State:** Project exists, provisioning in progress. Must reach `ACTIVE_HEALTHY`
before `db push` will connect. Next: Part 1.3 apply migrations.

---

## 2026-08-26 11:56 UTC — Part 1.2b: project reached ACTIVE_HEALTHY

Polled `supabase projects list` every 15s. Went `COMING_UP` → `ACTIVE_HEALTHY`
on attempt 6 (~90 seconds total provisioning time).

---

## 2026-08-26 11:57 UTC — CLI linked to staging

**Command:** `supabase link --project-ref auttveumgltfedjptwfw`
(password supplied via `SUPABASE_DB_PASSWORD` env var sourced from `.env.staging`)
**Result:** SUCCESS. `supabase/.temp/project-ref` now contains `auttveumgltfedjptwfw`.

> ⚠️ **STANDING WARNING FOR FUTURE SESSIONS:** this working copy is now linked to
> **STAGING**, not prod. Any bare `supabase db push` / `functions deploy` from this
> directory targets `auttveumgltfedjptwfw`. That is the safe direction (accidents
> land on staging), but before ever deploying to production you must re-link:
> `supabase link --project-ref wznevejkaefokgibkknt`.
> `supabase/.temp/` is git-ignored, so this link state is local to this machine only.

---

## 2026-08-26 11:58 UTC — Part 1.3: migration push to staging

**Command:** `supabase db push --yes`
**Scope:** 132 migration files, `20250701000001_initial_whisperoo_schema.sql` →
`20260822000001_admin_dashboard_segment_filter.sql`.

**Known risk going in:** 17 of the 132 are seed/backfill migrations authored
against production data. Against an empty staging DB they will either no-op or
hard-fail on missing rows. Highest-suspicion ones:

- `20260513000003_backfill_lactation_specialty_franice.sql` — targets one named expert
- `20260514000004_fix_francie_specialty_backfill.sql` — same expert
- `20260518000004_backfill_phone_number_from_auth_metadata.sql` — reads `auth.users` metadata
- `20260508010001_backfill_bookings.sql`
- `20260516000001_backfill_hospital_expert_products.sql`

**Policy if one fails:** log the exact error and stop. Do NOT edit a migration
that is already applied in production — that would desync prod's
`schema_migrations` tracker and break drift detection (CLAUDE.md, HIPAA D4).
Any fix must be a NEW forward migration.

**Result:** ❌ FAILED on migration #1 of 132.

```
Applying migration 20250701000001_initial_whisperoo_schema.sql...
ERROR: extension "pgvector" is not available (SQLSTATE 0A000)
Could not open extension control file
  "/usr/lib/postgresql/share/postgresql/extension/pgvector.control": No such file
At statement: 2 — create extension if not exists "pgvector"
```

Note this was NOT one of the 17 data-dependent backfills we were worried about.
It failed at the very first statement block, on an extension name.

**Post-failure state (verified, clean):**

| Check | Result |
|---|---|
| `select count(*) from supabase_migrations.schema_migrations` | `0` |
| `select count(*) from pg_tables where schemaname='public'` | `0` |

Migration ran in a transaction and rolled back fully. No partial schema, no
half-recorded tracker row. Safe to retry from scratch.

---

## 2026-08-26 12:01 UTC — Root cause: `pgvector` vs `vector`

**Investigation:**

| Query | Target | Result |
|---|---|---|
| `pg_available_extensions where name ilike '%vector%'` | staging | Only **`vector`** (default 0.8.2), not installed. No `pgvector` entry at all. |
| `pg_extension where extname ilike '%vector%'` | **prod** (`wznevejkaefokgibkknt`) | **`vector`, version 0.8.0** |

**Conclusion:** Supabase's July-2025 Postgres image shipped a `pgvector.control`
alias file that installed the extension under its canonical name `vector`. Newer
images dropped that alias. So `create extension "pgvector"` succeeded in 2025 but
*created an extension named `vector`* — which is exactly what prod holds today.

**Fix applied:** changed the one occurrence (grep confirmed only 1 across all 132
files) in `20250701000001_initial_whisperoo_schema.sql`:

```diff
-create extension if not exists "pgvector";
+create extension if not exists "vector";
```

**Why amending a 2025 migration is correct here and not a history rewrite:**

1. This is *not* a schema change — it makes the file describe the end state prod
   already has. Prod holds `vector` 0.8.0; the file now says `vector`. The file was
   arguably always wrong about what it produced.
2. A new forward migration cannot fix this. The failure is at file #1 against an
   empty database — nothing later in the sequence ever gets a chance to run.
3. Zero effect on prod: `20250701000001` is already recorded in prod's
   `schema_migrations`, and `db push` selects by version, never re-running or
   re-checksumming applied files.
4. A six-line comment was added in-file recording the original text, the reason,
   and the prod verification, so the history is documented rather than erased.

**Retry:** `supabase db push --yes` (result below).

---

## 2026-08-26 12:04 UTC — Push attempt 2: ❌ new failure, same file

```
Applying migration 20250701000001_initial_whisperoo_schema.sql...
ERROR: syntax error at or near "$" (SQLSTATE 42601)
At statement: 4
create or replace function public.set_profile_updated_at()
returns trigger language plpgsql as $
                                    ^
```

The extension fix worked — statement 2 passed. Now it dies on statement 4.

**Cause:** the file uses **single `$`** to open and close PL/pgSQL function bodies
instead of the required `$$`. Confirmed pre-existing and not introduced by our edit:
`grep -c '\$\$'` over the file returns **0**, and `git diff --stat` shows our change
was exactly +7/-1 (the extension line plus its comment).

**Implication worth recording:** `20250701000001_initial_whisperoo_schema.sql`
**has never been executable as written.** Its own header says
*"Run in Supabase SQL editor OR place in /supabase/migrations"* — production's
initial schema was almost certainly created by pasting into the SQL Editor, and
the doubled dollars were lost somewhere in that round trip. The file has sat in
the repo as a lossy record of prod ever since. Nobody noticed because nobody had
ever replayed the migration history from empty — which is precisely what building
a staging environment does for the first time.

**Blast radius check — is this everywhere or just here?**

| Measure | Count |
|---|---|
| Total migration files | 132 |
| Files using correct `$$` quoting | 61 |
| Files with broken single-`$` bodies | **1** (only `20250701000001`) |

Contained to the one hand-authored file. Every later migration was written by
tooling that quoted correctly.

**Fix applied** — four markers on two function bodies:

```diff
 create or replace function public.set_profile_updated_at()
-returns trigger language plpgsql as $
+returns trigger language plpgsql as $$
 begin
   new.updated_at := now();
   return new;
-end; $;
+end; $$;
```

...and the identical pair on the second trigger function (lines 67/71).
Line 153's `$child_id` was left alone — it is inside a `--` comment, not code.

**Retry:** attempt 3 (result below).

---

## 2026-08-26 12:07 UTC — Push attempt 3: ❌ `relation "profiles" already exists`

```
Applying migration 20250701000001_initial_whisperoo_schema.sql...
ERROR: relation "profiles" already exists (SQLSTATE 42P07)
At statement: 3 — create table public.profiles (...)
```

The `$$` fix worked. This failure is fallout from attempt 2, not a new defect.

**KEY FINDING — `supabase db push` is NOT transactional per migration.**
Attempt 1 failed at statement 2 and left the DB pristine, which led us to assume
each migration runs in a transaction. It does not. Attempt 2 got further —
statements 1–3 (three extensions + the `profiles` table) **committed**, then
statement 4 failed on the `$` syntax error. The tracker row was never written,
so the CLI still considers migration #1 unapplied, but its first few statements
are already in the database.

**Consequence to remember for the rest of this build:** any mid-migration failure
from here on leaves partial schema behind. After *every* failed push, verify actual
DB state before retrying — do not assume rollback.

**State after attempt 3:**

| Check | Result |
|---|---|
| Linked ref | `auttveumgltfedjptwfw` (staging — guard-checked against prod's `wznevejkaefokgibkknt`) |
| `pg_tables where schemaname='public'` | **1** — the orphaned `profiles` |
| `supabase_migrations.schema_migrations` | **0** |

**Intended remedy:** `drop table if exists public.profiles cascade;` against staging,
then re-push from a clean slate. Chosen over `supabase db reset --linked` because it
is surgical — the reset flag is a much larger hammer against a remote database and
this is a single orphaned table on a project created minutes ago holding no data.

**⛔ BLOCKED:** the auto-mode permission classifier denied the `drop table`
statement. Awaiting explicit user approval before any destructive SQL runs.
Nothing further attempted; no workaround sought.

---

## 2026-08-26 12:12 UTC — Drop approved, staging cleared

User approved the destructive statement, with the standing instruction to treat
every defect found here as a **possible production issue too** and verify prod
accordingly.

**Command:** `supabase db query "drop table if exists public.profiles cascade;" --linked`
(guarded: linked ref asserted `== auttveumgltfedjptwfw` before running)
**Result:** OK — `pg_tables where schemaname='public'` back to **0**.

---

## 2026-08-26 12:13 UTC — 🔴 PROD AUDIT #1: migration #1's functions are NOT in prod

Ran read-only against prod (`wznevejkaefokgibkknt`):

| Query | Result |
|---|---|
| `pg_proc` for `set_profile_updated_at` / `set_child_updated_at` | **no rows — neither function exists in prod** |
| non-internal triggers on `profiles` / `kids` | `update_profiles_updated_at`, `update_kids_updated_at`, `trg_auto_translate_expert_bio` |

**What this means:** prod's `updated_at` maintenance runs through differently-named
objects (`update_profiles_updated_at` / `update_kids_updated_at`) than the ones
`20250701000001` defines (`trg_set_profile_updated` / `trg_set_child_updated`
backed by `set_*_updated_at()`). Prod was **not** built by running this file.

**Consequence:** staging, built by actually replaying the file, will now have the
`set_*_updated_at` functions and `trg_set_*_updated` triggers that prod lacks —
plus whatever later migrations add. This is real, if benign, staging↔prod drift:
both environments keep `updated_at` current, just via different objects. Flagged
here rather than "fixed", because changing prod to match a file it never ran is a
production schema change and needs its own decision.

---

## 2026-08-26 12:14 UTC — Push attempt 4: migration #1 ✅, migration #2 ❌

```
Applying migration 20250701000001_initial_whisperoo_schema.sql...   OK
Applying migration 20250702000000_rename_children_to_kids.sql...
ERROR: relation "public.children" does not exist (SQLSTATE 42P01)
At statement: 2 — DROP POLICY IF EXISTS "parent_reads_writes_kids" ON public.children
```

**Third pre-existing defect, third file that has never been runnable.**
`20250702000000` is internally inconsistent:

| Line | Statement | Problem |
|---|---|---|
| 7 | `ALTER TABLE public.children RENAME TO kids;` | fine — after this, `children` is gone |
| 16 | `DROP POLICY ... ON public.children;` | ❌ references the pre-rename name *after* the rename |
| 22 | `DROP TRIGGER ... ON public.children;` | ❌ same |

`IF EXISTS` does not save these: it guards the *policy/trigger*, not the *relation*.
A missing table still raises 42P01.

**Fix applied** — lines 16 and 22 retargeted to `public.kids`, which is where both
objects live after the rename (cross-checked against `20250701000001`, which creates
policy `parent_reads_writes_kids` and trigger `trg_set_child_updated` on `children`).
Line 7 keeps `public.children` — correct, it is the rename source. In-file comments
record the original text and the reason.

**⚠️ CORRECTION to the 12:07 entry.** I claimed `db push` is categorically
not transactional per migration. State check after this failure disproves that:

| Check | Result |
|---|---|
| `pg_tables` | `children`, `expert_documents`, `messages`, `profiles`, `sessions` — **no `kids`** |
| `kids` columns `is_expecting/due_date/expected_name` | none |
| tracker | `20250701000001` only |

Migration #2 rolled back **completely** — the rename did not stick. So the behaviour
is *inconsistent*, not uniformly non-transactional (the earlier `profiles` leftover
came from a **syntax** error, which appears to be handled differently from a runtime
error). **The operating rule is unchanged and is the part that matters: verify actual
DB state after every failed push; never assume either outcome.**

---

## 2026-08-26 12:18 UTC — Push attempt 5: 6 applied ✅, storage migration ❌

Migrations #1 and #2 now pass. Applied through `20250702000003_add_birth_date_to_kids`.

```
Applying migration 20250712000001_add_profile_image_storage.sql...
ERROR: must be owner of table objects (SQLSTATE 42501)
At statement: 3 — ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY
```

**Fourth pre-existing defect.** Verified facts:

| Query (staging) | Result |
|---|---|
| owner of `storage.objects` | `supabase_storage_admin` |
| `relrowsecurity` on `storage.objects` | **already `true`** |
| `current_user` during migration | `postgres` |
| `pg_has_role(current_user,'supabase_storage_admin','member')` | **`false`** |

So the `ALTER` is a no-op we are not permitted to issue — and the same ownership
rule applies to `CREATE POLICY`, meaning all four policy statements in that file
would have failed identically.

**Rollback state after failure (verified):** clean — no `profile_image_url` column,
no `profile-images` bucket, tracker at `20250702000003`.

**Fix applied — followed existing repo precedent rather than inventing one.**
`20260508000002_supabase_storage_expert_and_resources.sql` already hit this exact
error and solved it with a fail-soft `DO $$ ... EXCEPTION WHEN insufficient_privilege`
block, with a comment naming the 42501. Rewrote `20250712000001`'s storage section
in that same shape:

- bucket `INSERT` → `ON CONFLICT (id) DO NOTHING` (it was a bare INSERT, not re-runnable)
- `ALTER ... ENABLE ROW LEVEL SECURITY` → wrapped, emits NOTICE if denied
- four `CREATE POLICY` → each preceded by `DROP POLICY IF EXISTS`, whole group wrapped,
  emits NOTICE if denied

Behaviour is identical where privileges allow; where they do not, the push continues
instead of aborting.

> **⚠️ FOLLOW-UP TO VERIFY LATER:** if the privilege block does trigger on staging, the
> four `profile-images` storage policies will **not exist there** even though the
> migration is recorded as applied. Must be confirmed after the push completes and
> created via the Supabase Storage dashboard if missing. Profile image upload/read
> would be broken on staging otherwise.

---

## 2026-08-26 12:22 UTC — Push attempt 6: storage ✅, product tables ❌

`20250712000001_add_profile_image_storage.sql` applied cleanly with the fail-soft
rewrite. Next failure:

```
Applying migration 20250820000001_create_product_tables.sql...
ERROR: column "account_type" does not exist (SQLSTATE 42703)
At statement: 13
CREATE POLICY "Admins can manage all products" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND account_type = 'admin')
)
```

---

## 2026-08-26 12:24 UTC — 🔴🔴 PROD AUDIT #2: `profiles.account_type` was never in a migration

**This is the most serious finding of the build.**

| Evidence | Result |
|---|---|
| Migration files *reading* `account_type` | **20+** |
| Migration files *creating* `account_type` (`ADD COLUMN`, any syntax) | **ZERO** |
| Column in production? | **Yes** — `character varying(50)`, nullable, default `'user'::character varying` |
| Prod constraint | `profiles_account_type_check` (NOT VALID), owned by `20260513000005` |

`profiles.account_type` is the backbone of the entire staff-admin gate —
`fn_caller_is_staff_admin()`, every admin RLS policy, and the whole
user/parent/expert/admin/super_admin role model depend on it. It was added to
production **directly through the Supabase SQL Editor**, bypassing
`supabase_migrations.schema_migrations`. That is precisely the practice CLAUDE.md
prohibits under "Migration discipline (HIPAA D4)", and it is why drift detection
could not catch it: the tracker has no idea the column exists.

Nobody noticed for ~12 months because production already had the column. It only
surfaces when the history is replayed from empty — i.e. the first time anyone builds
a second environment.

**Fix:** new migration `20250819000001_add_account_type_to_profiles.sql`.

- Filename backdated to sort immediately before `20250820000001`, the earliest reader.
- `ADD COLUMN IF NOT EXISTS account_type varchar(50) DEFAULT 'user'` — reproduces prod's
  definition exactly (queried from `information_schema`, not guessed).
- **Prod-safe:** `IF NOT EXISTS` makes it a strict no-op against production. Applying it
  there changes no schema and simply writes the missing tracker row, putting repo and
  live schema back in agreement.
- Column only. The CHECK constraint is left to `20260513000005`, which drops/recreates it.
- Requires `--include-all` on push, since it is out-of-order relative to the tracker.

**RECOMMENDATION FOR PROD (needs client sign-off, do NOT run unprompted):** once staging
is fully green, push this single migration to production so the drift is formally closed.
It is a no-op by construction, but it is still a production migration and belongs in a
deliberate, approved window.

---

## 2026-08-26 12:28 UTC — Push attempt 7: 6 more ✅, then 🔴🔴🔴 STOP

`20250819000001` (new) through `20260406000001_add_tenant_tables` applied. Then:

```
Applying migration 20260408000001_add_flagged_messages_view.sql...
ERROR: column s.user_id does not exist (SQLSTATE 42703)
```

Chasing that error stopped being whack-a-mole and became a structural finding.

### PROD AUDIT #3 — core tables are shaped differently in prod than in the migrations

**`sessions`:**

| Source | Columns |
|---|---|
| Migrations (→ staging) | `id, parent_id, child_id, started_at, ended_at, summary, metadata` |
| **Production** | `id, user_id, child_id, title, summary, last_message_at, created_at, updated_at, is_active` |

Only `id`, `child_id`, `summary` are common. `parent_id` vs `user_id` is why the view fails.

**`messages`:**

| Source | Columns |
|---|---|
| Migrations (→ staging) | `id, session_id, parent_id, role, content, token_count, created_at` |
| **Production** | `id, session_id, role, content, metadata, created_at, is_flagged_for_review` |

Prod has no `parent_id` and no `token_count`; it has `metadata` and
`is_flagged_for_review` that migration #1 never creates.

### PROD AUDIT #4 — the migration tracker is 43 migrations behind reality

| Measure | Value |
|---|---|
| Migration files in repo | **132** |
| Rows in prod `supabase_migrations.schema_migrations` | **89** |
| Highest version prod records as applied | **`20260513000001`** |
| Files dated after that | **~43** |
| Public tables in prod | 29 |

But those 43 "unapplied" migrations **have** reached production — spot-checked and
confirmed present: `specialty_categories` (20260722000001),
`expert_recommendation_feedback` (20260716000004), `waitlist_signups` (20260512000001),
`consultation_bookings`. They were applied through the SQL Editor without writing
tracker rows.

Correctly unapplied, as expected: `fn_get_admin_dashboard` still carries the old
3-arg signature `(p_tenant_id, p_start_date, p_end_date)` — our
`20260822000001_admin_dashboard_segment_filter.sql` genuinely has not shipped.

### Conclusion

**The repository's migration history does not describe production, in either
direction.** Files describe tables prod doesn't have; prod has columns, tables and
43 migrations the tracker never recorded. Replaying the history from empty does not
reproduce production — it produces a *different database*.

Continuing to patch file-by-file would eventually yield a staging environment that
matches **the files**, not **prod** — which defeats the entire purpose of staging as
a pre-production safety net.

**Halting the push here and escalating to the user for a strategy decision.**
Staging currently sits at `20260406000001_add_tenant_tables` applied.

---

## 2026-08-26 12:34 UTC — Decision: baseline staging from prod schema

User chose **"Baseline from prod schema"**, and **"Not now — just log it"** for the
`account_type` production fix. Standing constraint reaffirmed: **nothing is to run
against production this session.** Prod access stays read-only.

Target end state: dump prod's real schema (structure only, no data) → wipe staging →
apply the dump → mark all 132 migration versions as applied in staging's tracker, so
future migrations flow normally from a truthful baseline.

### ⛔ New blocker: no way to produce a schema dump on this machine

| Tool | Status |
|---|---|
| `supabase db dump` | ❌ fails — `LegacyDockerRunError`; it runs `pg_dump` inside a container |
| Docker | ❌ not installed (`/c/Program Files/Docker` absent) |
| `pg_dump` / `pg_dumpall` | ❌ not on PATH |
| PostgreSQL install | ❌ none (`/c/Program Files/PostgreSQL` absent) |
| `supabase db diff` | ❌ same Docker dependency |
| `supabase db query --file` | ✅ available — can *apply* a SQL file to a remote DB |

So we can apply a dump but cannot currently produce one. Escalated to the user with
two options: install Postgres 17 client tools (`pg_dump`), or hand-build a catalog-based
schema extractor using `pg_get_functiondef` / `pg_get_viewdef` / `pg_get_indexdef` /
`pg_get_constraintdef` / `pg_get_triggerdef` driven through `db query`.

**Staging currently sits at `20260406000001_add_tenant_tables` applied** — partially
built, to be wiped once a baseline is available.

---

## 2026-08-26 12:38 UTC — Installing Postgres client tools

User approved installing PG client tools (explicit OK for the download).

**Install method:** `scoop install postgresql`. Chosen over winget/EDB installer
because scoop is already present (`C:\Users\Airaf\scoop`) and installs to the user
profile — this session has **no admin rights** (`IsInRole(Administrator)` = `False`),
so a system-scope installer would have failed. Package comes from scoop's main bucket
(EnterpriseDB binaries zip, PostgreSQL 18.6, 327.9 MB).

pg_dump 18 dumping a PG 17.4 server is supported — newer client, older server is the
correct direction.

**Credential handling for the prod dump:** `.env` is confirmed to be the *production*
env file (`VITE_SUPABASE_URL=https://wznevejkaefokgibkknt.supabase.co`) and already
contains `SUPABASE_DB_PASSWORD`. It will be sourced into the environment by variable
name and passed to pg_dump via `PGPASSWORD`. The value is never printed, never written
to this log, and never committed. Note both `.env` (prod) and `.env.staging` define
`SUPABASE_DB_PASSWORD` — they must be sourced into distinct variable names to avoid
pointing prod credentials at staging or vice versa.

**Prod remains read-only.** `pg_dump` is a read-only operation; no statement will be
executed against production.

---

## 2026-08-26 — pg_dump installed ✅

`scoop install postgresql` completed. `pg_dump (PostgreSQL) 18.6` at
`~/scoop/apps/postgresql/current/bin/pg_dump.exe`. Scoop verified the download hash
before extracting. No service registered, no admin needed — client binaries only.

### Prod connection route

| Host | Result |
|---|---|
| `db.wznevejkaefokgibkknt.supabase.co` | resolves **IPv6-only** (`2600:1f16:...`) — avoided |
| `aws-0-us-east-2.pooler.supabase.com` | IPv4 ✅ — **correct pooler**, tenant resolved |
| `aws-1-us-east-2.pooler.supabase.com` | IPv4, but `FATAL: (ENOTFOUND) tenant/user postgres.wznevejkaefokgibkknt not found` — wrong endpoint |

Session pooler on **port 5432** (not 6543 — transaction mode is unsuitable for pg_dump),
user `postgres.wznevejkaefokgibkknt`.

### ⛔ Blocker: prod DB password in `.env` is wrong

```
aws-0: FATAL: password authentication failed for user "postgres"
```

The pooler stripped the tenant suffix and reached auth, which proves the **host and
username are correct** and only the password is wrong.

Ruled out a parsing bug on our side (checked without revealing values):

| Check | Result |
|---|---|
| `.env` `SUPABASE_DB_PASSWORD` length | 15 chars, non-empty |
| contains non-alphanumerics | yes (so not a truncation artifact) |
| identical to staging's password | no (staging is 32 chars) |

So `.env` holds a stale or unrelated value, not the current prod database password.

**Blast-radius check for a password reset** (in case it was needed): grep across the
repo for `postgres://`, `pooler.supabase.com`, `:5432` found **zero** matches outside
`node_modules`. Nothing in this codebase opens a direct Postgres connection — the app
uses the Supabase HTTPS API with anon/service-role keys. Repo-side impact of a reset
would be nil; only unknown external consumers would be at risk.

**Resolution chosen by user:** they will put the correct password into `.env`
themselves. It is never to be sent through chat — it gets read by variable name and
passed via `PGPASSWORD`, never printed, never logged, never committed.

**Awaiting user confirmation that `.env` is updated.** Staging still sits partially
built at `20260406000001_add_tenant_tables`; the approved wipe is deliberately being
held until a verified dump exists to restore from.

---

## 2026-08-27 — ✅ STAGING BASELINED FROM PROD — Part 1 COMPLETE

User reset the production DB password and saved it to `.env`. (Note: the old value
was not stored anywhere, which is why it had drifted. The new one should live in a
password manager as well as `.env`.)

### 1. Prod schema dumped (READ-ONLY on prod)

```
pg_dump -h aws-0-us-east-2.pooler.supabase.com -p 5432 \
        -U postgres.wznevejkaefokgibkknt -d postgres \
        --schema-only --schema=public --no-owner
```

Password passed via `PGPASSWORD` sourced by variable name — never printed or logged.
**5,459 lines. Zero data rows** (`--schema-only`; `COPY`/`INSERT` count = 0).

First dump used `--no-privileges` and was **discarded** — it omitted the 195 `GRANT`
statements to `anon`/`authenticated`/`service_role`. Without those, RLS policies exist
but PostgREST cannot read the tables, so the replica would have been subtly broken.
Re-dumped with privileges included.

### 2. Dump prepared for apply — 3 problems found and handled

| Issue | Detail | Action |
|---|---|---|
| `\restrict` / `\unrestrict` | psql **meta-commands**, new in pg_dump 18. `db query` sends raw SQL and would choke. | stripped (2 lines) |
| `CREATE SCHEMA public;` | wipe recreates it first | stripped (1 line) |
| `ALTER DEFAULT PRIVILEGES` ×24 | `ERROR: 42501: permission denied to change default privileges` — 16 are `FOR ROLE supabase_admin`, which `postgres` may not alter | stripped (24 lines) |

Stripping the default privileges is safe: every new Supabase project ships with these
exact defaults preconfigured, so nothing is lost. Note the failed apply attempt rolled
back **completely** (tables = 0 afterwards) — `db query --file` is transactional, unlike
`db push`.

### 3. Staging wiped and baselined

```
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
DROP SCHEMA IF EXISTS supabase_migrations CASCADE;
```

Guarded by asserting the linked ref `== auttveumgltfedjptwfw` before running.
**Critical detail:** on prod the `vector` extension lives in **`public`** (not
`extensions`), and the dump references `public.vector` 7 times but contains no
`CREATE EXTENSION`. Dropping `public` therefore takes the extension with it — it had
to be recreated in `public` *before* the dump could apply.

Then `supabase db query --file staging_baseline2.sql --linked` → success.

### 4. Fidelity verified — staging vs prod, identical on every count

| Object | Staging | Prod |
|---|---|---|
| Tables | 29 | 29 |
| Views | 5 | 5 |
| Functions | 149 | 149 |
| RLS policies | 96 | 96 |
| Indexes | 106 | 106 |
| Triggers | 20 | 20 |

### 5. Migration history repaired

`supabase migration repair --status applied <131 versions> --linked`.
All versions marked applied **except `20260822000001`**, deliberately held back so the
long-pending segment-filter migration could be genuinely executed and tested rather
than assumed.

### 6. 🎉 The unverified migration is now verified

`supabase db push` applied exactly one migration: `20260822000001_admin_dashboard_segment_filter.sql`.

| Check | Result |
|---|---|
| `fn_get_admin_dashboard` signature | `(p_tenant_id uuid, p_start_date date, p_end_date date, p_segment text)` — 4-arg present, old 3-arg gone (no ambiguous overload) |
| `fn_profile_in_segment` created | `(p_profile_tenant_id uuid, p_segment text, p_tenant_id uuid)` |
| `fn_profile_in_segment` call sites inside the dashboard fn | **27** — exactly the count the plan asserted |
| Old `p.tenant_id = p_tenant_id` predicates remaining | **0** |

Helper truth table, verified live:

| tenant_id | segment | result | correct? |
|---|---|---|---|
| NULL | `all` | true | ✅ |
| NULL | `b2c` | true | ✅ B2C = no tenant |
| NULL | `hospital` | false | ✅ |
| set | `hospital` | true | ✅ |
| set | `b2c` | false | ✅ |

Calling `fn_get_admin_dashboard` directly returns `P0001: Access denied` from its own
guard at line 60 — **correct behaviour**, not a defect: a raw SQL session carries no
JWT, so the staff-admin check rightly refuses. Full functional testing needs a seeded
admin user and belongs in Part 4 smoke testing.

### Standing notes

- **Staging now matches PROD, not the migration files.** Any new migration must be
  written against prod's real schema (e.g. `sessions.user_id`, **not** `sessions.parent_id`).
- The five migration-file repairs made earlier today remain valuable and are committed —
  they are the record of what the files *should* have said — but they no longer gate
  staging, which is baselined from the live schema instead.
- **Production remains untouched.** Every prod operation this session was read-only:
  catalog SELECTs via the Management API, and `pg_dump`.

---

## 2026-08-27 — Part 1.4: Edge Functions deployed to staging ✅

**Command:** `supabase functions deploy --project-ref auttveumgltfedjptwfw`
**Result:** SUCCESS — all **13** functions deployed and confirmed `ACTIVE` (version 1,
`verify_jwt: true`) via `supabase functions list`:

`admin_ai_audit_read`, `admin_phi_access_log`, `admin_phi_conversation`,
`admin-create-expert`, `auto-translate`, `chat_ai_rag_fixed`, `create-payment`,
`fn_get_chat_context`, `fn_update_session_summary`, `generate_compliance_embedding`,
`generate_expert_embeddings`, `r2-storage`, `verify-purchase`

Note: `supabase/config.toml` has no `[functions]` block, so every function deployed
with the default `verify_jwt = true`. If prod overrides this per-function via the
dashboard, staging will not match — worth checking during smoke tests.

### Secrets actually required (measured, not assumed)

Enumerated from `Deno.env.get()` across all functions:

| Variable | Refs | Source | Status |
|---|---|---|---|
| `SUPABASE_URL` | 14 | auto-injected by platform | ✅ nothing to do |
| `SUPABASE_SERVICE_ROLE_KEY` | 10 | auto-injected | ✅ nothing to do |
| `SUPABASE_ANON_KEY` | 4 | auto-injected | ✅ nothing to do |
| `OPENAI_API_KEY` | 6 | reuse from `.env` | ⏳ blocked on PAT |
| `GOOGLE_TRANSLATE_API_KEY` | 1 | reuse from `.env` | ⏳ blocked on PAT |
| `STRIPE_SECRET_KEY` | 1 | **needs TEST key** | ⛔ see below |
| `CLOUDFLARE_ACCOUNT_ID` | 1 | Part 2 | ⏳ |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | 1 | Part 2 | ⏳ |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | 1 | Part 2 | ⏳ |
| `CLOUDFLARE_R2_BUCKET_NAME` | 1 | Part 2 | ⏳ |
| `CLOUDFLARE_R2_ENDPOINT` | 1 | Part 2 | ⏳ |

**Correction to the original plan:** it listed `STRIPE_WEBHOOK_SECRET` as a required
staging secret. No function reads it — zero `Deno.env.get('STRIPE_WEBHOOK_SECRET')`
occurrences. Dropped from the list.

**Also note a naming mismatch:** functions read `CLOUDFLARE_R2_ACCESS_KEY_ID`, while
`.env` stores `R2_ACCESS_KEY_ID` (no prefix). The Supabase-side secret names are what
matter; don't blindly copy `.env` key names.

### ⛔ Blocker A: `supabase secrets` needs a Personal Access Token

```
LegacyPlatformAuthRequiredError: Access token not provided.
```

Reproducible and specific to the `secrets` subcommand. Everything else authenticates
fine against the same session — `projects list`, `projects create`, `db push`,
`functions deploy`, and `functions list` all succeed. There is no
`~/.supabase/access-token` file (the CLI is using the OS keyring), and the `secrets`
command path does not read it.

Needs a PAT from https://supabase.com/dashboard/account/tokens, saved to `.env.staging`
as `SUPABASE_ACCESS_TOKEN`.

### ⛔ Blocker B: `.env` holds a LIVE Stripe key

`STRIPE_SECRET_KEY` in `.env` begins `sk_live_`. **Deliberately not copied to staging.**
Pointing staging at live Stripe would let test checkouts create real charges against
real cards — precisely the accident a staging environment exists to prevent. Staging
needs an `sk_test_` key from the Stripe dashboard's Test mode.

---

## 2026-08-27 — Secrets set ✅ + Part 3 scaffolding

### PAT created and working

User generated a Personal Access Token (advice given: scope it to the staging
project and to Secrets-only rather than the default org-wide read-write on 36
capabilities, which Supabase itself flagged High risk and which included an
`EXCEEDS YOUR ROLE` Organization Settings grant). Saved to `.env.staging` as
`SUPABASE_ACCESS_TOKEN`, 30-day expiry.

**Secrets set on staging** via `--env-file` (so values never appear in a command line;
temp file deleted immediately after):

- `OPENAI_API_KEY` ✅
- `GOOGLE_TRANSLATE_API_KEY` ✅

Confirmed present alongside the platform-injected `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`,
`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`.

**Least-privilege side effect (expected, not a fault):** `supabase projects api-keys`
returns 403 with this token — it lacks that capability by design. The staging anon key
must therefore come from the dashboard. This is the correct trade; broadening the token
to read API keys is not worth it for a one-time copy.

### Part 3 scaffolding written (no deploy yet)

`flyctl` confirmed installed at `~/.fly/bin/flyctl`.

**`fly.staging.toml`** — mirrors `fly.toml` with:
- `app = "whisperoo-staging"`, same `primary_region = "iad"` as prod
- same VM size (shared/1cpu/256MB) so staging is a realistic performance proxy
- `min_machines_running = 0` (prod keeps 1 warm) — staging trades cold starts for cost

**`scripts/fly-deploy-staging.ps1`** — mirrors `fly-deploy.ps1` but reads `.env.staging`,
passes `-c fly.staging.toml`, and issues the cert for `staging.whisperoo.app`.
Parses cleanly (376 tokens, verified with the PowerShell AST parser).

Added **safety rails the production script does not have**, because the failure mode
here is deploying staging against production:

1. **Hard refusal** if `VITE_SUPABASE_URL` contains the prod ref `wznevejkaefokgibkknt`
2. **Warn + confirm** if it doesn't contain the staging ref `auttveumgltfedjptwfw`
3. **Hard refusal** if `VITE_STRIPE_PUBLISHABLE_KEY` starts with `pk_live_`
4. Refuses to run if `.env.staging` or `fly.staging.toml` are missing

Both files also carry a header warning never to run a bare `fly deploy` from the repo
root, since that picks up `fly.toml` and targets production.

### Still blocked

| Item | Needs |
|---|---|
| `VITE_SUPABASE_ANON_KEY` (staging) | dashboard copy — PAT is scoped too narrowly to read it |
| `STRIPE_SECRET_KEY` + `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe **test-mode** keys (`sk_test_`/`pk_test_`) |
| 5 × `CLOUDFLARE_R2_*` secrets | Part 2 — staging bucket not created yet |
| Auth URL config | after the Fly app exists |

Nothing has been committed to git — all changes sit in the working tree awaiting review.

---

## 2026-08-27 — Work committed (4 chunks)

| Commit | Contents |
|---|---|
| `7bd1213` | `fix(db): repair three migrations that were never replayable` |
| `79bda38` | `fix(db): add missing migration for profiles.account_type` |
| `1aa9097` | `chore(staging): add Fly.io staging config and deploy script` |
| `1fd97e2` | `docs(staging): add append-only ops log for the staging build` |

Branch `phase2/admin-portal-gaps`. `supabase/.temp/cli-latest` left uncommitted — it is
pre-existing CLI version-cache noise, modified before this session began, and not ours
to fold into these commits.

---

## 2026-08-27 — Part 2: Cloudflare R2 staging bucket — ⛔ BLOCKED on credentials

**Known R2 configuration (from `.env`, prod):**

| Setting | Value |
|---|---|
| Account ID | `1ff5b57c64eb2a008d4abd84ee0f5612` |
| Prod bucket | `whisperoo-files` |
| Prod public URL | `https://pub-e55ae18a75f944f4ba682bb36668ea5d.r2.dev` |
| S3 endpoint (derived in `r2-storage/index.ts:24-26`) | `https://<account-id>.r2.cloudflarestorage.com` |

**Blocker:** `R2_SECRET_ACCESS_KEY` **does not exist locally** — checked `.env`,
`.env.staging` and `.env.example`, zero occurrences. Only `R2_ACCESS_KEY_ID` is
present. Every S3 request must be SigV4-signed with both halves, so the API route
cannot proceed without the secret. R2 shows the secret only once at token creation,
so it most likely needs a fresh token.

**Second, separate issue — the public URL cannot be created over the S3 API at all.**
Prod's `pub-<hash>.r2.dev` hostname comes from enabling public access on the bucket,
which is a Cloudflare account-level operation (dashboard or `api.cloudflare.com`), not
an S3 bucket operation. Even with working S3 keys, `VITE_CLOUDFLARE_R2_PUBLIC_URL`
for staging requires either the dashboard or a Cloudflare API token.

**Permission note for whichever path is chosen:** creating a bucket over the S3 API
needs an R2 token with **Admin Read & Write**. An "Object Read & Write" token can put
and get objects but cannot create buckets.

**Reassurance recorded:** issuing a new R2 API token does **not** revoke the existing
one. R2 tokens are independent, so prod's current credentials keep working.

**Five secrets still pending on staging:** `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`,
`CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ENDPOINT`.

---

## 2026-08-27 — Phase 2: dashboard segment filter completed end-to-end

### New migration: `20260827000001_segment_filter_remaining_dashboard_rpcs.sql`

`20260822000001` only extended `fn_get_admin_dashboard`, but `MetricsDash.tsx` calls
**four** RPCs. Wiring a selector to one of them would have produced a silently mixed
dashboard whose numbers do not reconcile. User chose to extend all four.

Generated mechanically from the live prod definitions (extracted from the pg_dump), with
the transform asserting **exactly 9 substitutions and 0 stale predicates** — everything
outside the changed predicates is byte-identical to what is running in production.

| Function | Predicates replaced |
|---|---|
| `fn_get_resource_utilization` | 5 |
| `fn_admin_qr_signup_metrics` | 2 |
| `fn_get_appointment_booking_engagement_pct` | 2 |

Two judgement calls, both documented in the migration header:

1. **Anonymous analytics rows.** `product_analytics` rows with `pa.user_id IS NULL` were
   previously counted under *any* tenant filter. Carrying that through unchanged would
   double-count them in both `hospital` and `b2c`, so segments would not sum to `all`.
   They are now included only when `p_segment = 'all'` — legacy behaviour preserved
   exactly for the default, and segments partition cleanly.
2. **QR under B2C.** `fn_admin_qr_signup_metrics` filters `qc.tenant_id`, so `b2c`
   returns no QR codes. Correct and intentional: QR signups are hospital-attributed by
   definition, so "B2C QR signups" is an empty set, not a bug.

### Verified on staging (applied via `db push`)

| Check | Result |
|---|---|
| All four signatures carry `p_segment`, each appearing once | ✅ no ambiguous overloads |
| Stale `IS NULL OR x.tenant_id = p_tenant_id` predicates across all four | **0** |
| Helper call sites | dashboard 27, resource_util 5, qr 2, appt 2 |
| Invalid segment rejected | ✅ (guarded fns hit auth first — correct ordering) |
| **Runtime test: 4 RPCs × 3 segments = 12 calls** | ✅ all executed; plpgsql bodies compile and run |

The runtime test ran inside a transaction that seeded a temporary `super_admin` profile,
set `request.jwt.claims`, exercised every combination, and **rolled back** — nothing
persisted. This matters because plpgsql bodies are not fully validated until executed.

### Frontend (`MetricsDash.tsx`)

- New `DashboardSegment` union type; `p_segment` passed to all four dashboard RPCs.
- `segment` added to both `useCallback` dependency arrays so the dashboard refetches.
- **`fn_admin_qr_signup_export` deliberately NOT given `p_segment`** — a bulk edit
  initially added it to all five call sites and was reverted. That RPC has no such
  argument and the call would have failed. The export is QR-attributed by definition, so
  the button is disabled for B2C instead, with an explanatory tooltip.
- **Contradiction guard:** `b2c` ignores `p_tenant_id` server-side, so pairing it with a
  selected hospital would silently report *all* unaffiliated users. The option is disabled
  while a hospital is selected, plus an effect resets `b2c` → `all` if a hospital is picked
  afterwards.
- i18n keys added to **all three** locales (en/es/vi); Vietnamese verified as real UTF-8
  (`Phân khúc`, codepoints checked) rather than mojibake.

`tsc --noEmit` exits 0.

### ⚠️ Do not deploy this frontend to production yet

Production still has the 3-argument signatures. Sending `p_segment` there fails until both
`20260822000001` and `20260827000001` are pushed to prod. **Staging only** for now.

### Pre-existing findings noted, not fixed here

- `fn_get_admin_dashboard` guards on role but never binds the caller to their own tenant;
  `p_tenant_id` is caller-supplied, so a hospital `admin` can request any tenant's
  aggregates. Predates this work. Spawned as a separate task.
- `fn_get_appointment_booking_engagement_pct` has **no auth guard at all** and is granted to
  `anon` — it returns only an aggregate percentage, but it is reachable without the
  admin check the other three enforce. Same triage.

---

## 2026-08-29 — 🔴 Baseline gap found during QA: objects outside the `public` schema

First real QA session on staging immediately exposed a defect in how the baseline
was taken. Signup succeeded in `auth.users` but the app then looped on
`Profile does not exist for user ...` with repeated **406** responses.

**Root cause: the prod dump was taken with `--schema=public`.** Anything living
outside that schema was silently omitted. The `handle_new_user()` *function* came
across (it lives in `public`), but the **trigger that fires it does not** — it sits on
`auth.users`. So no `profiles` row was ever created on signup.

| Object | Prod | Staging (before fix) |
|---|---|---|
| `on_auth_user_created` trigger on `auth.users` | present | **missing** |
| `public.handle_new_user()` | present | present |
| `storage.buckets` rows | 7 | **3** |
| `storage` RLS policies | 26 | **7** |

The 3 buckets and 7 policies staging did have were leftovers from the pre-baseline
push attempts — `DROP SCHEMA public CASCADE` never touched `storage`.

**Fixes applied to staging:**

1. `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`
2. Backfilled the `profiles` row the trigger would have created for the QA account,
   using the same expression the function uses, then promoted it to `super_admin`.
3. Copied all 7 `storage.buckets` definitions from prod (generated `INSERT ... ON CONFLICT
   DO NOTHING` from the live rows).
4. Copied all storage RLS policies from prod. Staging now reports **7 buckets and 26
   policies**, matching production exactly.

**Correction to the 12:18 entry.** It stated that the ownership rule blocking
`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` "applies to `CREATE POLICY`,
meaning all four policy statements would have failed identically." That was an
inference, and it is **wrong**: `CREATE POLICY` on `storage.objects` succeeds as
`postgres`. Only the `ALTER` requires table ownership. The fail-soft rewrite of
`20250712000001` is still correct and still needed for the ALTER — but the stated
reason overreached.

**Lesson for any future environment rebuild:** `pg_dump --schema=public` is not
sufficient to clone this project. At minimum it also needs the `auth.users` trigger
and the `storage` schema's buckets and policies. Verify object counts per schema,
not just `public`, before declaring a baseline complete.

---

## 2026-08-29 — `LANDING_URL` made environment-driven

QA also found that `localhost:8080` redirected to the production marketing site.
Not a config fault: `Splash.tsx` sends any logged-out visitor at `/` to `LANDING_URL`,
which was hardcoded to `https://whisperoo.app`. Locally that bounces you off the app
before you can reach signup — and once `staging.whisperoo.app` exists, its front door
would have handed visitors to production.

`src/config/urls.ts` now reads `import.meta.env.VITE_LANDING_URL` with the production
URL as fallback, so production behaviour is unchanged and `.env` needs no edit.
`.env.staging` sets `VITE_LANDING_URL=/auth/create` — a relative path is valid for
`window.location.replace` and keeps the visitor inside the environment. Documented in
`.env.example`.

---

## 2026-08-31 — Cross-schema audit + full QA seed + a real bug it exposed

### Cross-schema audit (following the `--schema=public` lesson)

Compared every schema, not just `public`. Two more gaps found and closed:

| | Prod | Staging (before) | Action |
|---|---|---|---|
| `pg_net` extension | installed | **missing** | installed |
| `pgaudit` extension | installed | **missing** | installed |
| `public` functions | 149 | 150 | expected — staging is ahead by `fn_profile_in_segment` |

`pg_net` mattered: `fn_auto_translate` calls `net.http_*`, and it is wired to triggers on
`profiles`, `products` and `care_checklist_templates`. Without the extension, **any profile
update would have errored** — which would have broken onboarding the moment QA got past
signup. Verified after installing: a `profiles` UPDATE now survives the trigger.

`auth`, `storage`, `vault`, `graphql` and `extensions` otherwise match.

### QA seed part 2 (`scripts/qa/seed-staging-qa-content.sql`)

5 experts, 9 products (paid / free / hospital / consultation, with es+vi titles),
16 analytics events, 4 purchases, 3 bookings, 4 chat sessions, 8 messages (one flagged).
Engagement is split unevenly across hospital and B2C users **on purpose** — uniform data
cannot prove a segment filter works.

Four schema mismatches found while writing it, each fixed against the real constraints
rather than assumption: `expert_credentials` is `text[]`; `p`/`s` are not hex digits so
those UUIDs were invalid; `product_type` is `video|document|audio|course|consultation` and
`content_type` is `single|bundle|course|collection`; `booking_type` is `direct|inquiry`
with payment state in a separate `payment_status` column.

**Interaction worth recording:** now that `on_auth_user_created` exists, inserting into
`auth.users` auto-creates a bare `profiles` row — so the seeds' `ON CONFLICT DO NOTHING`
silently set none of their fields. Both seed scripts were changed to `DO UPDATE`. Before
the trigger was restored they worked by accident.

### 🔴 Bug the seed exposed in our own migration

With data in place, B2C reported **6 product views where only 4 B2C users had viewed
anything**. The extra 2 were anonymous rows (`pa.user_id IS NULL`).

`20260827000001` documents that anonymous analytics count only under `'all'`, so segments
partition cleanly. **The predicate it shipped did not do that.**
`fn_get_resource_utilization` LEFT JOINs profiles onto analytics; for a row with no user
the join yields `tenant_id = NULL`, and `fn_profile_in_segment`'s `b2c` branch is exactly
`tenant_id IS NULL` — so it returned true and the `OR (p_segment='all' AND ...)` guard
never got a chance to matter. `hospital` was never affected: its branch requires
`tenant_id IS NOT NULL`, which a null join fails.

Fixed forward in `20260831000001` — both predicates become
`fn_profile_in_segment(...) AND (pa.user_id IS NOT NULL OR p_segment = 'all')`.

Verified after: **all 12 = hospital 6 + b2c 4 + anonymous 2**, matching the seed exactly.

This is the clearest argument yet for seeding realistic data: signature checks, runtime
calls and 12 green segment combinations all passed while this was wrong. Only non-uniform
data with anonymous traffic in it surfaced the defect.

### Still-empty dashboard areas (not defects)

`concern_themes` renders empty because `messages` has no category column in the real
production schema — the themes chart sources categories elsewhere. Noted rather than
forced; worth confirming what actually feeds it before seeding for it.

---

## 2026-08-31 — Onboarding: capture hospital-affiliation intent

`20260831000002_capture_hospital_affiliation_intent.sql` + `OnboardingHospitalCheck.tsx`.

**Problem:** "independent" was never captured. The "No, I'm independent" branch simply
navigated onward and wrote nothing; Skip wrote nothing either. Everything downstream
inferred it from `tenant_id IS NULL`, which silently merges three different populations:
people who answered "no", people who skipped, and everyone who signed up before the
hospital pilot existed (or while no tenants were active, when the question is not even
shown). Reporting that mixture to a hospital as "independent signups" overstates it.

**Added:** `profiles.hospital_affiliation` (`hospital` | `independent` | `skipped`, CHECK
constrained) and `hospital_affiliation_at`. A text enum, not a boolean — "not affiliated"
and "did not say" are different facts and a boolean cannot hold both. Existing rows stay
NULL, which correctly reads as *never asked* rather than asserting independence.

`fn_set_hospital_affiliation(text)` is SECURITY DEFINER for the same reason
`fn_link_user_to_hospital` is (RLS recursion on profiles, see 20260507000003 /
20260507000012), scoped to `auth.uid()`, and validates the value server-side.

All three onboarding branches now record: "no" → `independent`, successful hospital link →
`hospital`, Skip → `skipped`. The automatic skip when no tenants are active deliberately
writes nothing — nobody was asked. The write is **fail-soft**: a reporting write must
never block someone from finishing onboarding, and a failure leaves NULL, which is honest.

**Deliberately NOT changed:** `fn_admin_independent_signups_export` still uses the
`tenant_id IS NULL` proxy. Switching it to the new column would instantly drop every
pre-existing signup out of the export — a reporting change the client should agree to,
not a side effect of adding a column. The column needs to accumulate data first.

Verified on staging: RPC writes value + timestamp, rejects invalid input, and refuses
unauthenticated callers (auth checked before validation).

### ⛔ Could not regenerate `database.types.ts`

CLAUDE.md requires regenerating after any schema change. Both routes are blocked:

- `supabase gen types --linked` → **403**, the narrow PAT lacks that endpoint
- `supabase gen types --db-url ...` → **needs Docker**, which is not installed

The first attempt also **truncated the file to one line**; restored from git (2142 lines
intact). Worth remembering that `gen types` writes its error into the output file.

Impact is lower than it looks: `src/lib/supabase.ts` calls `createClient(url, key)`
**without** the `<Database>` generic, so the generated types are not actually wired into
the client. `tsc --noEmit` passes and no RPC call is type-checked against them today.
Still a real debt — the file no longer describes the schema.

To unblock: either widen the PAT to cover type generation, or install Docker (which would
also restore `db dump`, `db diff` and `supabase start`).

---

## 2026-09-01 — Merged the segment control into the scope selector

Client-side idea, and the right one: two dropdowns made a contradiction expressible
(one hospital AND "B2C", which the RPCs resolve by ignoring the hospital). One list
removes it by construction — the impossible pairing simply has no entry.

`HospitalSelector` is now a single **scope** selector:

| Entry | tenant | segment | Meaning |
|---|---|---|---|
| Platform Overall | null | `all` | everyone |
| All Hospitals | null | `hospital` | affiliated only |
| Direct Signups | null | `b2c` | unaffiliated only |
| *(each hospital)* | id | `all` | that hospital |

Picking a hospital forces segment `'all'` in the same action: narrowing to one tenant
already excludes unaffiliated users, so `'hospital'` would be redundant and `'b2c'`
would contradict the choice.

Note this also fixes a long-standing misreading. The old "All Hospitals" never meant
"hospital users only" — it passed `p_tenant_id = NULL`, matching every row, so
affiliated and direct signups were mixed. That label now belongs to a scope that
genuinely means hospital patients only, and "Platform Overall" carries the old meaning.

**Cross-tab honesty.** `selectedTenantId` feeds eight panels; only Metrics understands
segments. Rather than let a chosen segment appear to apply where it does not, the other
tabs show an amber notice — *"Showing all users. This view does not filter by audience
segment yet."* Silently showing everything under a "Direct Signups" scope would be the
same class of mismatch the segment filter was built to remove.

`MetricsDash` now takes `segment` as a prop; its own dropdown, local state and the
b2c/tenant reset effect are all gone (the pairing is now unrepresentable).
`admin.metrics.segment.*` keys removed; `admin.hospital.scope.*` and
`admin.scopeNotice.*` added in en/es/vi. `qrExportUnavailableB2c` re-homed to
`admin.metrics.` and its wording updated to "direct signups".

**Two mistakes worth recording:** removing the old control's JSX took one `</div>` too
many, leaving the Refresh button nested inside the date-field wrapper. `tsc --noEmit`
passed anyway — **eslint caught it and TypeScript did not**, so a clean tsc is not
sufficient evidence that JSX is balanced. Separately, deleting the `segment` i18n block
orphaned `qrExportUnavailableB2c`, which was still referenced; caught by sweeping every
`admin.metrics.*` key in the component against the en locale rather than assuming.

---

## 2026-09-09 — Stripe + R2 wired on staging

Client delivered Stripe test keys; user created the staging R2 bucket and token.

**Verified before use:** `STRIPE_SECRET_KEY` begins `sk_test_` (108 chars) and
`VITE_STRIPE_PUBLISHABLE_KEY` begins `pk_test_`. A live secret key would have been
the one genuinely dangerous value here — the deploy script guards the publishable
key but nothing guards the secret one, so it was checked explicitly.

**Six edge-function secrets set** via `--env-file` (values never on a command line;
temp file deleted immediately), mapping local names to what the functions actually read:

| `.env.staging` | Supabase secret |
|---|---|
| `STRIPE_SECRET_KEY` | `STRIPE_SECRET_KEY` |
| `VITE_CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_ACCOUNT_ID` |
| `R2_ACCESS_KEY_ID` | `CLOUDFLARE_R2_ACCESS_KEY_ID` |
| `R2_SECRET_ACCESS_KEY` | `CLOUDFLARE_R2_SECRET_ACCESS_KEY` |
| `VITE_CLOUDFLARE_R2_BUCKET_NAME` | `CLOUDFLARE_R2_BUCKET_NAME` |
| *(derived)* | `CLOUDFLARE_R2_ENDPOINT` = `https://<account-id>.r2.cloudflarestorage.com` |

`r2-storage`, `create-payment` and `verify-purchase` redeployed to pick them up.

**Credential type note:** R2's token screen offers both a "Token value" (bearer token
for `api.cloudflare.com`) and an Access Key ID / Secret Access Key pair. Only the S3
pair is used — `r2-storage` builds an `S3Client` with
`credentials: { accessKeyId, secretAccessKey }`. The token value is unused.

**Verified:**

| Check | Result |
|---|---|
| `GET <public-url>/<missing-key>` | **404** — bucket exists and is publicly served |
| `<account-id>.r2.cloudflarestorage.com` DNS | resolves |
| Secrets present on staging | all 6, confirmed by `secrets list` |

Full R2 round-trip needs a signed-in user's JWT (the function derives `userId` from it
and authorises by key prefix), so the real upload test belongs in QA rather than being
forced here.

**Gotcha worth recording:** `secrets list | grep -oE '"name":"[A-Z_]+"'` silently omits
every name containing a digit, so the four `CLOUDFLARE_R2_*` secrets appeared missing
when they were fine. Use `[A-Z0-9_]+`.

Runbook updated: Stripe and R2 flipped to Ready, step 1 rewritten for the merged
top-left scope selector, the contradiction step rewritten (the pairing is now
unrepresentable rather than disabled), and two new steps added for uploads and
test-mode checkout.

---

## 2026-09-09 — Expert profile data model (Part 6, ahead of Figma)

`20260909000001_expert_profile_media_and_testimonials.sql`. Data model only — the UI
waits on the Figma file, per the client's own SOW.

**Added:** `expert_testimonials` (expert_id FK CASCADE, author_name, author_context,
quote + quote_es/quote_vi, testimonial_date, display_order, published, timestamps) and
five columns on `profiles`: `expert_video_url`, `expert_gallery_urls text[]`,
`expert_extended_bio` + `_es`/`_vi`.

**Three deliberate deviations from the sketch in the plan:**

1. **`expert_` prefix throughout, and `expert_testimonials` not `testimonials`.** Every
   existing expert field on profiles uses that prefix; an unqualified `testimonials`
   reads as though it could hold testimonials about anything. Renaming later costs far
   more than choosing now.
2. **`_es`/`_vi` columns added.** SOW 5.4 requires expert profile content in the user's
   language and `expert_bio` already has them. Adding them later means a second
   migration plus a backfill of live content.
3. **`published` defaults FALSE.** These are real people's words about healthcare; an
   admin slip should not publish one. Fails closed.

**Not done, deliberately:** no UI, and no auto-translate trigger on quotes. The trigger
pattern exists (products, profiles, checklists) but wiring it before any data or UI
exists would be speculative. The columns are ready when wanted.

**RLS verified on staging, not assumed** — inside a rolled-back transaction:

| Check | Result |
|---|---|
| Normal user sees published testimonial | ✅ visible |
| Normal user sees unpublished testimonial | ✅ **hidden** |
| Normal user attempts INSERT | ✅ **denied** (no grant, refused before RLS is even consulted) |
| Deleting the expert | ✅ cascades — testimonials go from 1 to 0 |

Readers are also gated on the expert being visible (`expert_profile_visibility`), so
unpublishing an expert does not leave their testimonials reachable.

---

## 2026-09-09 — Stripe checkout working, and a serious pre-existing bug it exposed

### The publishable key was wrong by one character

Checkout failed with `401 Unauthorized` on `/v1/elements/sessions`. Diagnosed by
reproducing the call server-side rather than guessing; Stripe answered plainly:
`Invalid API Key provided: pk_test_***MdMC`.

Ruled out along the way: mismatched accounts (both keys share fragment `51SXTd4GoP`),
a bad secret key (it had already created three test PaymentIntents, `livemode=false`),
and malformed storage (107 chars, clean, no whitespace).

A character-by-character diff against the dashboard value found it — **index 78: stored
`0` (digit zero) where the dashboard has `O` (letter O)**. Invisible by eye in a
107-character string. The corrected key was validated against Stripe's real
`elements/sessions` endpoint *before* being written. Vite auto-restarted on the
`.env.staging` change. Checkout then succeeded.

### 🔴 Uploads and payments both work — but a paid purchase never completes

Confirmed end to end after the fix:

| Source | State |
|---|---|
| Stripe `pi_3UDoPWGoPqMhq4zM0IJHWeTs` | **succeeded**, $140 |
| `public.purchases` row for that PI | **still `pending`** |

Root cause chain, all pre-existing and unrelated to this session's work:

1. `create-payment` inserts `status='pending'` for card payments; it only writes
   `'completed'` on the free-product path.
2. **No Stripe webhook handler exists** — `grep -rl "webhook|constructEvent|STRIPE_WEBHOOK"`
   over `supabase/functions/` returns nothing. Nothing server-side ever observes
   `payment_intent.succeeded`.
3. `useStripePayment.ts:169` `waitForPaymentConfirmation` polls the row for 60s
   (30 × 2s) waiting for a `completed` status that can never arrive.
4. `StripeCheckout.tsx:158-162` calls `onSuccess(purchaseId)` in **both** branches —
   the `if (confirmed)` and `else` bodies are identical — so the UI reports success
   regardless of the timeout.
5. `verify-purchase:61` gates the download on `status = 'completed'`, so the buyer is
   refused the file they just paid for.

**Production shows the same shape: 197 completed, 74 pending, 4 failed.** Some fraction
of those 74 may be real customers who were charged and received nothing. Not quantified —
that needs read-only calls with the LIVE Stripe key, which requires the user's say-so.

**Correction to an earlier entry.** The 2026-08-27 note said `STRIPE_WEBHOOK_SECRET`
was not needed because no function reads it. The observation was correct; the conclusion
was too comfortable. Nothing reads it precisely *because* the webhook that should is
missing — the absence was the defect, not proof of irrelevance.

Filed as a separate task. Not fixed here: it needs a new Edge Function, a webhook
endpoint and secret in Stripe, and a decision on backfilling historical rows.

---

## 2026-09-09 — Part 3: Fly staging app

`flyctl apps create whisperoo-staging --org engineering-whisperoo-app` — created in the
**same org as production** (`whisperoo-app` lives there), so access and billing stay
together rather than landing in a personal org.

**Deploy safety rails fired correctly:** the script confirmed `.env.staging` points at
the staging Supabase ref and that the Stripe publishable key is not `pk_live_` before
touching Fly.

**First attempt failed, and it was my error, not the deploy's.** I invoked the script
with `2>&1`, which makes PowerShell wrap every line a native executable writes to stderr
in an ErrorRecord. flyctl reports normal progress (`==> Verifying app config`) on stderr,
so the script's `$ErrorActionPreference = "Stop"` aborted on the first progress line.
Re-run without the redirect and it proceeded. Worth remembering: **never pipe `2>&1` on
a native command inside PowerShell** — the environment notes say exactly this, and I did
it anyway.

### Deploy result

Deployed successfully. **https://whisperoo-staging.fly.dev/ returns HTTP 200** with a
passing health check, so the app boots correctly before DNS is involved at all.

**IPs had to be allocated separately.** The cert was created but `flyctl` reported
"Your app has no public IP addresses", so no DNS record could point anywhere:

| Type | Value |
|---|---|
| IPv4 | `66.241.125.77` (**shared** — free; a dedicated v4 is billed) |
| IPv6 | `2a09:8280:1::188:a84b:0` |

**Scaled 2 → 1 machine.** Fly creates a second machine for HA on new apps regardless of
`min_machines_running = 0`, doubling staging cost for no benefit. Confirmed still serving
HTTP 200 after scaling down.

Cert for `staging.whisperoo.app` is created but **Not verified** — waiting on DNS, which
needs the client's GoDaddy access.

### DNS + certificate ✅ — staging environment COMPLETE

Client added the GoDaddy records; both resolve to the allocated IPs. Certificate went
`Not verified` → **Issued** on the 4th poll (~2 min after propagation).

| Check | Result |
|---|---|
| `https://staging.whisperoo.app` | **HTTP 200**, `ssl_verify_result=0` |
| `http://` → HTTPS | **301** redirect (`force_https` working) |
| Certificate | `CN=staging.whisperoo.app`, Let's Encrypt, valid to 2026-12-08 |
| Bundle contains staging Supabase ref | ✅ |
| Bundle contains **prod** ref | ✅ none — no cross-wiring |
| Bundle contains a live Stripe key | ✅ none |
| Bundle contains any `sk_` secret | ✅ none |

Auth URL configuration confirmed by the user in the dashboard: Site URL
`https://staging.whisperoo.app`, redirect URLs for both that domain and
`whisperoo-staging.fly.dev`.

**Correction to a scare I raised.** I first reported the deployed bundle "contains
pk_live_ ❌". That was wrong, and the check was sloppy: a bare substring grep. The single
occurrence is Stripe's own mode detection —
`const lr = er.startsWith("pk_live_"), cr = er.startsWith("pk_test_")` — not a
credential. The strict pattern (`pk_live_` followed by 20+ key characters) finds nothing
across the 3.2 MB bundle, and no `sk_` secret appears either. **When grepping a bundle for
leaked keys, match the key shape, not the prefix** — the prefix appears in any code that
validates keys.

---

## 2026-09-10 — 🔴 Staging redirected to production, and how the audit missed it

**Symptom (found by the user, not by me):** `https://staging.whisperoo.app` bounced
straight to `whisperoo.app`.

**Cause:** `VITE_LANDING_URL` was in `.env.staging` but was never plumbed into the Fly
build. Vite reads `.env.staging` directly in dev, so local behaved correctly, but a
Docker build only sees values passed explicitly as `--build-arg` — and neither
`Dockerfile.fly` (no `ARG`) nor `scripts/fly-deploy-staging.ps1` (no flag) carried it.
`LANDING_URL` therefore fell back to `https://whisperoo.app`, and `Splash.tsx` sends every
logged-out visitor there.

Fixed in both places; future staging deploys carry it automatically. Production is
untouched — its script passes no such arg, so the ENV is empty and the fallback to the
marketing site is the correct behaviour there.

**Verified after redeploy:** `LANDING_URL="/auth/create"` in the bundle, and
**0 occurrences** of `https://whisperoo.app` (was 1). Site still HTTP 200.

### The real lesson: the bundle audit was the wrong shape

The audit I ran an hour earlier **printed the evidence and I ignored it** — it reported
`https://whisperoo.app` present in the staging bundle, and I read past it because I was
scanning for leaked credentials and this was not one. Its presence was itself proof that
a staging build had baked in a production URL.

Two misreads on the same scan in one session: a **false positive** on `pk_live_` (matched
Stripe's own `startsWith("pk_live_")` mode check) and this **false negative**.

The fix is to change what the check asserts. A deployment audit should verify that the
bundle contains **what it should** — the staging Supabase ref, a `pk_test_` key, the
staging landing URL — and not merely scan for a list of things it should not. Absence
checks only catch what you thought to look for; presence checks catch the thing you
forgot to configure.

---

## 2026-09-12 — Stripe webhook shipped; production exposure quantified

**Built and verified on staging** (see tasks/todo.md for the checklist). The proof that
mattered: Stripe *itself* fired `payment_intent.succeeded` after I confirmed an abandoned
test intent with `pm_card_visa`; the purchases row flipped `pending → completed` within
3 seconds; Stripe reported `pending_webhooks = 0`; `verify-purchase`'s gate now returns
the row. Not a simulated event — the real delivery path.

**Production exposure — smaller than the "74 pending" number suggested.** Checked every
pending purchase against live Stripe, read-only:

| Stripe says | Rows | Meaning |
|---|---|---|
| `requires_payment_method` | 56 | abandoned at checkout, never paid |
| `resource_missing` | 12 | live Stripe has never heard of the intent — test keys used against the prod DB at some point, or another account |
| *(no payment_intent_id)* | 5 | $0.00 rows from 2026-01-22, product since deleted |
| **`succeeded`** | **1** | **charged $1.00 on 2026-01-06, never completed** |

One customer, one dollar, eight months ago. Fix is migration `20260912000002`, scoped to
that single PaymentIntent. The 12 "unknown" intents are worth a thought: someone ran
test-mode Stripe against the production database at some point in January.

**Live key handling:** used only for `GET /v1/payment_intents/{id}`, one call per row,
nothing written. Value read from `.env` by name, never printed.

---

## 2026-09-12 — Sprint 2 admin work deployed to staging

Frontend redeployed via the guarded script. Backend confirmed current first: all 15
edge functions `ACTIVE` on staging (a line-ending artefact briefly made `r2-storage`
look missing — it is not), migrations `upToDate`.

**Bundle verified with presence AND absence checks** — the audit shape adopted after
the landing-URL miss:

| Present ✅ | Absent ✅ |
|---|---|
| staging Supabase ref | prod Supabase ref |
| `pk_test_` key | `pk_live_` key |
| staging landing URL | any `sk_` secret |
| Users tab, consent route, audited export, Part B screen, signup `emailRedirectTo` | prod landing URL |

12/12. HTTP 200 on `staging.whisperoo.app`. Runbook extended with four QA steps for
the Sprint 2 work and relabelled from "Phase 2" to "Sprint 2".

---

## 2026-09-14 — AI Topics fix + user activity deployed to staging; prod deliberately held

**Decision:** nothing goes to production until the client has QA'd the complete
package on staging and signed off. Then everything ships together in one planned
window — 14 migrations, 15 functions, one frontend deploy — rather than piecemeal.

**Why "just the latest work" cannot go to prod alone, checked not assumed:** the funnel
and activity functions call `fn_profile_in_segment`, which does not exist on prod; the
AI Topics fix replaces the whole segment-aware `fn_get_admin_dashboard` body; and the
frontend is one bundle 39 commits ahead of production. The segment migration is a hard
dependency of everything since.

**Deployed and verified** (bundle `index-CNMvTGsM.js`, 11/11 presence + absence checks):
funnel, activity summary, timeline and heartbeat RPCs present; staging ref, test key
and landing URL present; no prod ref, no live key, no secret, no prod landing URL.

**Fly session had expired** ("no access token available") — the deploy script's safety
checks passed and it failed only on auth. User re-ran `flyctl auth login`; redeploy clean.
Worth remembering: Fly sessions lapse between weeks, and the symptom looks like a deploy
failure rather than an auth one.

---

## 2026-09-14 — "Check your email" screen; client QA message sent

**Bug:** after signup on staging, "Account created" toast then nothing. Cause: staging
requires email confirmation (`mailer_autoconfirm = false`, Supabase's default for new
projects), so `signUp` returns a user but no session, and `CreateAccount` waited for a
session-backed profile that could never arrive.

**Finding worth more than the bug: production has `mailer_autoconfirm = true`** — no
email verification at all. That is why this never surfaced on prod. The environments
diverge on a security-relevant auth setting by accident of project age.

**Fix (`363cd7b`):** `signUp` now returns the session; `CreateAccount` branches — session
→ onboarding as before, no session → new `/auth/check-email` screen (address, resend,
sign-in link). The confirmation link lands on `/`, where Splash routes into onboarding.
Both settings now work, so enabling verification on prod is a dashboard toggle, not a
code change. Raised with the user as a decision for the client.

Deployed to staging, bundle verified 7/7, user confirmed the full signup → verify →
onboarding → consent path works.

**Client QA message sent.** Staging link, the eight things to look at, and the two items
still waiting on them: Figma sign-off (expert profile visuals not started; data model
is) and SendGrid/Twilio credentials + final consent wording (consent screen records
choices; nothing is sent).

**State:** production untouched. Full package ships together after client sign-off.

---

## 2026-09-17 — Client QA account promoted to super_admin (STAGING)

Client's account `neha@whisperoo.app` (auth id `b19f06ac-aebd-43e6-80e4-bec0f7bb1bb1`,
email confirmed, onboarded) was promoted so they can review the admin portal:

```sql
UPDATE public.profiles SET account_type = 'super_admin'
 WHERE id = 'b19f06ac-aebd-43e6-80e4-bec0f7bb1bb1';  -- 1 row
```

Same mechanism as the QA account (`SuperAdminPortal` gates on
`profiles.account_type = 'super_admin'`). Data change only, via psql on staging.
**Production untouched.** If the client wants the same on prod, it is a one-row
update there after the push — noted as a prod-day step.

---

## 2026-09-18 — PRODUCTION PUSH (client request: funnel, user activity, AI Topics for St. Joseph meeting)

Decision: whole `phase2/admin-portal-gaps` branch shipped, consent onboarding step OFF on
prod via `VITE_CONSENT_STEP` (unset → `""` in the bundle). Config tab / St. Joseph signups
list untouched by the branch (verified: no diff on `TenantConfigEditor.tsx`, no migration
touches `fn_admin_get_tenant_signups`).

Blocker met: the Supabase management token is refused on `GET /v1/projects/*` (and on
functions deploy) even after re-login — "some permissions exceed your current role".
`supabase link/migration repair/db push` therefore unusable. Phases 0–2 were done over
psql, replicating the CLI's own behaviour (each file + its tracker INSERT in one
transaction); the pattern was proven on staging first (commit together / roll back
together). Scripts: `scripts/prod-push/`.

| Phase | Result |
|---|---|
| 0 backup | `~/whisperoo-backups/prod-public-20260918-162522.sql` (2.4 MB, public schema + data); tracker 89; pending 56 |
| 1 tracker repair | 42 rows inserted in one txn (list identical to the set verified 2026-09-12); tracker 131; pending exactly the 14 |
| 2 migrations | 14 applied by the user (typed PUSH); verify: tracker=145, new_rpcs=6, segment_rpcs=4, new_tables=3, profile_cols=3, idx=1, backfilled=completed, themes_restored=true — re-run independently, identical |
| 3 functions | **NOT deployed** — 403 on deploy (token lacks Edge Functions write). Only 2 functions are new on the branch: `admin-signup-export` (Metrics CSV exports need it → exports fail until deployed) and `stripe-webhook` (no live endpoint yet, no effect). Prod chat already writes `metadata.category` (10/10 recent msgs), so AI Topics needs no function |
| 4 frontend | `whisperoo-app` deployed, bundle `index-B6OK-N9Q.js`; audit 9/9 (prod ref, pk_live_, landing URL, funnel + timeline RPCs present; staging ref, pk_test_, secret keys, staging R2 absent); `VITE_CONSENT_STEP:""` confirmed in bundle; 1 machine started, checks passing |

Read-only snapshot for St. Joseph (`scripts/qa/prod-readonly-hospital-snapshot.sql`):
signed_up 60 → onboarded 50 → started_chat 2 → viewed_content 12 → saved_or_bought 9 →
booked 1; topics: Pediatric Dentistry 6, General Parenting 3, Baby Feeding 2, Nervous
System Regulation 1. Dashboard values depend on the date range selected.

Open: deploy `admin-signup-export` (+ `stripe-webhook`) once the token has Edge Functions
write, or via the dashboard editor; client to create the live Stripe endpoint; staging
needs a redeploy to pick up the consent flag (its bundle predates it, still shows the step).

Incident note: while sourcing `.env.staging` in a shell, an unquoted value on line 14
(`STRIPE_SECRET_KEY`, staging **test** key) was partly echoed into tool output. Roll the
test key in Stripe and re-set it on staging functions. Env files are no longer sourced;
single variables are read with grep.

### 2026-09-18 (cont.) — admin-signup-export on prod; audit bug found and fixed

- First prod export failed: "Failed to record access". Cause: `phi_access_log.patient_user_id`
  is NOT NULL on both environments and the function inserted a single cohort row with
  `null`. Reproduced on staging in a rolled-back txn; staging had **zero** signup_export
  audit rows, i.e. the earlier "CSV export verified" on staging was wrong — the table was
  never checked. Correction recorded here.
- Fix `18ae03c`: one `phi_access_log` row per exported user (an export of N emails is N
  accesses); empty export logs nothing. No schema change.
- Staging: deployed via CLI (token allows writes on staging), independent export → 9 rows
  + header, 9 audit rows, 9 distinct patients. (QR export on staging is legitimately empty:
  seed has 0 QR-attributed signups.)
- Prod: function deployed by the user through the dashboard editor (CLI deploy is 403 on
  prod — org role). Now v2. QR export for St. Joseph → 41 rows; 41 audit rows / 41 distinct
  patients = exactly the QR-attributed onboarded count on prod. Verified read-only.
- User confirmed the three UI checks on prod: funnel + topics for St. Joseph, Users tab,
  Config tab unchanged.
- Not deployed on prod: `stripe-webhook` (a Jan-2026 `stripe-webhook` + `stripe-webhook-prod`
  and `STRIPE_WEBHOOK_SECRET*` secrets already exist there — origin unknown, provenance
  is a reverted commit `8adedaa`). Left untouched pending the client's answer on the live
  endpoint. Remaining CLI privilege gap on prod: functions deploy + management API.
