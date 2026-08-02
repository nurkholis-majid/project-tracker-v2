-- =====================================================================
-- Migrasi 002 — satu feature flag bisa terkait ke beberapa epic
-- Jalankan di Supabase > SQL Editor. Aman diulang.
-- =====================================================================

alter table feature_flags
  add column if not exists epic_ids uuid[] not null default '{}';

-- Pindahkan relasi lama (epic_id tunggal) ke array baru.
update feature_flags
   set epic_ids = array[epic_id]
 where epic_id is not null
   and epic_ids = '{}';

-- Kolom lama dibiarkan ada supaya data lama tidak hilang,
-- tapi aplikasi tidak menulis ke sana lagi.
create index if not exists feature_flags_epic_ids_idx on feature_flags using gin (epic_ids);
