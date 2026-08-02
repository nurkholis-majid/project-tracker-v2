-- =====================================================================
-- Migrasi 005 — kredensial pada tabel systems, hapus kaitan epic
-- Jalankan di Supabase > SQL Editor. Aman diulang.
-- =====================================================================

alter table systems add column if not exists username text default '';
alter table systems add column if not exists password text default '';
alter table systems drop column if exists epic_id;
