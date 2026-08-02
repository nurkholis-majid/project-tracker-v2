-- =====================================================================
-- Migrasi 006 — Carding: breakdown project jadi story + estimasi sprint
-- Jalankan di Supabase > SQL Editor. Aman diulang.
-- =====================================================================

-- ------------------------------------------------ carding_projects
create table if not exists carding_projects (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text default '',
  velocity           integer not null default 20,   -- story point / sprint
  sprint_length_days integer not null default 14,    -- panjang 1 sprint
  start_date         date,                           -- untuk taksir tanggal selesai
  buffer_pct         integer not null default 15,    -- cadangan effort (%)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ------------------------------------------------- carding_stories
create table if not exists carding_stories (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references carding_projects(id) on delete cascade,
  epic_group  text default '',                       -- pengelompokan opsional
  title       text not null,
  points      numeric not null default 0,
  sort_order  integer not null default 0,            -- urutan → penempatan sprint
  created_at  timestamptz not null default now()
);

create index if not exists carding_stories_project_idx on carding_stories(project_id);

-- --------------------------------------------- updated_at trigger
-- (fungsi touch_updated_at() sudah dibuat di schema.sql)
drop trigger if exists carding_projects_touch on carding_projects;
create trigger carding_projects_touch before update on carding_projects
  for each row execute function touch_updated_at();

-- --------------------------------------------------------- RLS
alter table carding_projects enable row level security;
alter table carding_stories  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['carding_projects','carding_stories']
  loop
    execute format('drop policy if exists team_all on %I', t);
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
