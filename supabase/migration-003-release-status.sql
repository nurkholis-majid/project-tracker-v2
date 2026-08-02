-- =====================================================================
-- Migrasi 003 — status deploy per release
-- Jalankan di Supabase > SQL Editor. Aman diulang.
-- =====================================================================

alter table releases
  add column if not exists status text not null default 'Planned'
  check (status in ('Planned', 'Deployed'));

-- Release yang tanggal deploy-nya sudah lewat dianggap sudah ter-deploy.
update releases
   set status = 'Deployed'
 where deploy_date is not null
   and deploy_date <= current_date
   and status = 'Planned';

-- Catatan: tabel release_documents tidak dipakai lagi (cukup 1 URL folder
-- di kolom releases.folder_url). Tabelnya sengaja tidak di-drop supaya
-- data lama tidak hilang.
