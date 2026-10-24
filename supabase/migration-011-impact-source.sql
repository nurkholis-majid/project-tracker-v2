-- =====================================================================
-- migration-011-impact-source.sql  —  manual vs Jira-synced impact rows
--
-- Lets Jira sync populate Technical Impact without clobbering rows the
-- user added by hand. Sync only refreshes source = 'jira' rows; manual
-- rows (the default) are never touched. Run AFTER migration-010.
-- Non-breaking: existing rows default to 'manual'.
-- =====================================================================

alter table epic_services add column if not exists source text not null default 'manual';
alter table epic_vault    add column if not exists source text not null default 'manual';
