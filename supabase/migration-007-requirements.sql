-- =====================================================================
-- Migrasi 007 — Requirements (Kanban board PRD/BRD)
-- Jalankan di Supabase > SQL Editor. Aman diulang.
-- =====================================================================

-- Nomor requirement berurutan: REQ-1001, REQ-1002, ...
create sequence if not exists req_code_seq start 1001;

-- ------------------------------------------------------- req_stages
-- Kolom kanban yang bisa dikustom (rename/warna/urutan/hapus/tambah).
create table if not exists req_stages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#98A2B3',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------- req_cards
create table if not exists req_cards (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique default ('REQ-' || nextval('req_code_seq')),
  stage_id    uuid references req_stages(id) on delete set null,
  category    text not null default 'PRD',          -- 'PRD' | 'BRD'
  priority    text not null default 'med',          -- 'hi' | 'med' | 'lo'
  title       text not null,
  requester   text default '',
  target_date date,
  description text default '',
  criteria    jsonb not null default '[]'::jsonb,    -- [{ text, done }]
  links       jsonb not null default '[]'::jsonb,    -- [{ label, url }]
  sort_order  bigint not null default 0,             -- urutan sekunder (prioritas menang duluan)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists req_cards_stage_idx on req_cards(stage_id);

-- Seed 8 stage default (hanya kalau tabel stage masih kosong).
insert into req_stages (name, color, sort_order)
select v.name, v.color, v.sort_order
from (values
  ('Intake',         '#98A2B3', 1),
  ('Discussion',     '#6172F3', 2),
  ('Design',         '#0E9384', 3),
  ('Sign-off',       '#F79009', 4),
  ('Grooming',       '#DC6803', 5),
  ('In Development', '#1A6AFF', 6),
  ('User Testing',   '#2FC0AF', 7),
  ('Delivered',      '#12B76A', 8)
) as v(name, color, sort_order)
where not exists (select 1 from req_stages);

-- updated_at trigger (fungsi touch_updated_at() sudah ada dari schema.sql)
drop trigger if exists req_stages_touch on req_stages;
create trigger req_stages_touch before update on req_stages
  for each row execute function touch_updated_at();
drop trigger if exists req_cards_touch on req_cards;
create trigger req_cards_touch before update on req_cards
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------ RLS
alter table req_stages enable row level security;
alter table req_cards  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['req_stages','req_cards']
  loop
    execute format('drop policy if exists team_all on %I', t);
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
