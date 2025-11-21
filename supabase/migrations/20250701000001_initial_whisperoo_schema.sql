/* ██████████████████████████████████████████████████████████
   WHISPÉROO  –  INITIAL SUPABASE SCHEMA  (parent + kids chat)
   Author:  Cloud Code prompt – 2025-07-01
   ░░ Run in Supabase SQL editor OR place in /supabase/migrations
   ░░ All tables use UUID PKs; RLS is enforced from day-1.
   ██████████████████████████████████████████████████████████ */

-- ─────────────────────────────
-- 0. EXTENSIONS
-- ─────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pgvector";     -- 1536-dim OpenAI/Claude

-- ─────────────────────────────
-- 1. PROFILES  (parent / primary user)
-- ─────────────────────────────
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  first_name       text,
  email            text,
  phone            text,
  onboarded        boolean     default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- auto-update timestamp
create or replace function public.set_profile_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at := now();
  return new;
end; $;

create trigger trg_set_profile_updated
before update on public.profiles
for each row execute procedure public.set_profile_updated_at();

-- RLS: each user touches only their row
alter table public.profiles enable row level security;
create policy "self_profile" on public.profiles
  using  ( id = auth.uid() )
  with check ( id = auth.uid() );

-- ─────────────────────────────
-- 2. CHILDREN  (one-to-many under profile)
-- ─────────────────────────────
create table public.children (
  id           uuid primary key default uuid_generate_v4(),
  parent_id    uuid not null references public.profiles(id) on delete cascade,
  first_name   text not null,
  birth_date   date,           -- for age-based advice
  gender       text,           -- optional
  notes        text,           -- allergies, special conditions, etc.
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create or replace function public.set_child_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at := now();
  return new;
end; $;

create trigger trg_set_child_updated
 before update on public.children
 for each row execute procedure public.set_child_updated_at();

alter table public.children enable row level security;
create policy "parent_reads_writes_kids" on public.children
  using  ( parent_id = auth.uid() )
  with check ( parent_id = auth.uid() );

create index on public.children (parent_id);

-- ─────────────────────────────
-- 3. CHAT  –  sessions & messages
-- ─────────────────────────────
create table public.sessions (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid not null references public.profiles(id) on delete cascade,
  child_id    uuid references public.children(id) on delete cascade,
  started_at  timestamptz default now(),
  ended_at    timestamptz,
  summary     text,            -- running short memo for context
  metadata    jsonb default '{}'::jsonb
);
create index on public.sessions (parent_id, started_at desc);

alter table public.sessions enable row level security;
create policy "parent_sessions" on public.sessions
  using  ( parent_id = auth.uid() )
  with check ( parent_id = auth.uid() );

create table public.messages (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  parent_id   uuid not null references public.profiles(id) on delete cascade,
  role        text    check (role in ('user','assistant','system')),
  content     text not null,
  token_count int,
  created_at  timestamptz default now()
);
create index on public.messages (session_id, created_at);

alter table public.messages enable row level security;
create policy "parent_messages" on public.messages
  using  ( parent_id = auth.uid() )
  with check ( parent_id = auth.uid() );

-- ─────────────────────────────
-- 4. EXPERT KNOWLEDGE  –  vector-ready
-- ─────────────────────────────
create table public.expert_documents (
  id         uuid primary key default uuid_generate_v4(),
  title      text,
  content    text,
  embedding  vector(1536),
  created_at timestamptz default now()
);
create index on public.expert_documents using ivfflat (embedding vector_cosine_ops);

-- RLS open read-only for now; tighten when paywalling
alter table public.expert_documents enable row level security;
create policy "read_all" on public.expert_documents
  for select using ( true );

-- ─────────────────────────────
-- 5. EDGE-FUNCTION STUBS  (to be filled in TypeScript)
-- ─────────────────────────────
/*
supabase functions new fn_update_session_summary
supabase functions new fn_get_chat_context
*/

/* fn_update_session_summary
   ▸ INPUT : { session_id }
   ▸ ACTION:  gather last ~10 messages + existing summary
              -> call OpenAI/Claude to condense -> update sessions.summary
*/

/* fn_get_chat_context
   ▸ INPUT : { parent_id, child_id }
   ▸ ACTION:  return {
                 child_profile,            -- SELECT * FROM children WHERE id = $child_id
                 session_summary,          -- sessions.summary (or '')
                 recent_messages[]         -- last N pairs
              }
   ▸ Called from your chat frontend to build the LLM prompt
*/

-- ─────────────────────────────
-- DONE: scalable day-1 schema with kids + memory
-- Extend later with:
--   • appointments      (parent_id, expert_id, ...)
--   • subscription / billing tables
--   • org-multi-tenant  (org_id on profiles & kids + RLS)
--   • storage buckets   for file uploads / images / voice notes
-- ─────────────────────────────