-- =====================================================================
-- Migrasi 004 — dokumentasi sistem/website yang berhubungan dengan project
-- Jalankan di Supabase > SQL Editor. Aman diulang.
-- =====================================================================

create table if not exists systems (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text default '',
  url          text default '',
  environments text[] not null default '{}',   -- subset dari: dev, uat, prod
  epic_id      uuid references epics(id) on delete set null,  -- opsional, kaitkan ke epic
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists systems_touch on systems;
create trigger systems_touch before update on systems
  for each row execute function touch_updated_at();

alter table systems enable row level security;
drop policy if exists team_all on systems;
create policy team_all on systems for all to authenticated using (true) with check (true);
