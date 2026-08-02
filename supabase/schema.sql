-- =====================================================================
-- LSS Delivery Tracker — schema
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- epics
create table if not exists epics (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  jira_key     text unique,                     -- DLB-13753
  status       text not null default 'Requirement'
               check (status in ('Requirement','Development','User Testing','Deploy','Hold')),
  start_date   date,
  end_date     date,
  est_deploy   date,
  notes        text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------------- releases
create table if not exists releases (
  id           uuid primary key default gen_random_uuid(),
  fix_version  text not null unique,            -- 1.13.0
  deploy_date  date,
  folder_url   text default '',                 -- 1 fix version = 1 folder SharePoint
  notes        text default '',
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------- release_documents
create table if not exists release_documents (
  id           uuid primary key default gen_random_uuid(),
  release_id   uuid not null references releases(id) on delete cascade,
  doc_type     text not null
               check (doc_type in ('TAT','QCR','DR','Testing Result','UAT Sign Off','Lainnya')),
  url          text not null default '',
  unique (release_id, doc_type)
);

-- -------------------------------------------------------------- stories
create table if not exists stories (
  id             uuid primary key default gen_random_uuid(),
  epic_id        uuid references epics(id) on delete set null,
  task_group     text default '',               -- "Appraisal Portal Phase 0: Base Feature"
  title          text not null,
  jira_key       text unique,
  story_points   numeric default 0,
  sprint         integer,
  start_date     date,
  end_date       date,
  progress       text not null default 'Todo'
                 check (progress in ('Todo','In Dev','Done')),
  release_id     uuid references releases(id) on delete set null,
  release_status text not null default '-'
                 check (release_status in ('-','Merging to UAT','Deployed')),
  jira_status    text default '',               -- status mentah dari Jira (read-only)
  synced_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists stories_epic_idx    on stories(epic_id);
create index if not exists stories_release_idx on stories(release_id);
create index if not exists stories_end_idx     on stories(end_date);

-- -------------------------------------------------------- feature_flags
create table if not exists feature_flags (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                   -- FF_BE_V1_transferHybridMode
  epic_id      uuid references epics(id) on delete set null,
  description  text default '',
  dev          boolean,                         -- null = belum dikonfigurasi ("-")
  uat          boolean,
  prod         boolean,
  jira_key     text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------ sync_runs
create table if not exists sync_runs (
  id            uuid primary key default gen_random_uuid(),
  ran_at        timestamptz not null default now(),
  jql           text,
  epics_upsert  integer default 0,
  stories_upsert integer default 0,
  status        text default 'ok',
  message       text default ''
);

-- --------------------------------------------------- updated_at trigger
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists epics_touch on epics;
create trigger epics_touch before update on epics
  for each row execute function touch_updated_at();

drop trigger if exists stories_touch on stories;
create trigger stories_touch before update on stories
  for each row execute function touch_updated_at();

-- ------------------------------------- view: statistik agregat per epic
create or replace view epic_stats as
select
  e.id                                                          as epic_id,
  count(s.id)                                                   as total_stories,
  coalesce(sum(s.story_points), 0)                              as total_points,
  count(s.id) filter (where s.progress = 'Done')                as done_stories,
  coalesce(sum(s.story_points) filter (where s.progress = 'Done'), 0) as done_points
from epics e
left join stories s on s.epic_id = e.id
group by e.id;

-- =====================================================================
-- Row Level Security
-- Hanya user yang sudah login (tim lu) yang bisa baca & tulis.
-- Tambah user lewat Dashboard > Authentication > Users > Add user.
-- =====================================================================
alter table epics             enable row level security;
alter table stories           enable row level security;
alter table releases          enable row level security;
alter table release_documents enable row level security;
alter table feature_flags     enable row level security;
alter table sync_runs         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['epics','stories','releases','release_documents','feature_flags','sync_runs']
  loop
    execute format('drop policy if exists team_all on %I', t);
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
