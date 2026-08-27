-- =====================================================================
-- migration-009-epic-category.sql  —  free-text category on epics
-- Non-breaking: existing epics get NULL (no category).
-- =====================================================================
alter table epics add column if not exists category text;
