-- =============================================================================
-- @file 2026_10_24_enum_slug_column_defaults.sql
-- @path database/migrations/2026_10_24_enum_slug_column_defaults.sql
-- @project RPSW Web
-- @author RPSW
-- @created 2026-10-24
-- @description Open finding #52: the status / priority / state vocabularies of the web module are
--   English slugs (validated by the API, translated by the admin), but the column DEFAULTs of the
--   database (dump of 2026-08) still were the old Czech texts ('Nově zadané', 'Neutrální', 'Nové',
--   'Nový'). A record created without the value (e.g. a public job application, which never sends
--   `state`) got a value outside the vocabulary - the admin showed the raw Czech word and the
--   filters did not find it. This sets the slug defaults and converts rows still holding the old
--   default texts.
-- @note Idempotent (a second run changes nothing); MariaDB / MySQL. Back up the database first.
--   Only the former DEFAULT texts are converted - other legacy values were mapped by the earlier
--   slug migrations (005_enum_slugs_*). No START TRANSACTION: ALTER TABLE commits implicitly.
-- =============================================================================

-- Raw requests (web_raw_request_commissions) ------------------------------------------
ALTER TABLE `web_raw_request_commissions`
  ALTER COLUMN `status` SET DEFAULT 'new',
  ALTER COLUMN `priority` SET DEFAULT 'neutral';
UPDATE `web_raw_request_commissions` SET `status` = 'new' WHERE `status` = 'Nově zadané';
UPDATE `web_raw_request_commissions` SET `priority` = 'neutral' WHERE `priority` = 'Neutrální';

-- Sales leads (web_sales_leads) ------------------------------------------------------
ALTER TABLE `web_sales_leads`
  ALTER COLUMN `priority` SET DEFAULT 'neutral',
  ALTER COLUMN `status` SET DEFAULT 'new';
UPDATE `web_sales_leads` SET `priority` = 'neutral' WHERE `priority` = 'Neutrální';
UPDATE `web_sales_leads` SET `status` = 'new' WHERE `status` IN ('Nové', 'nové');

-- Job applications (web_job_applications) --------------------------------------------
ALTER TABLE `web_job_applications`
  ALTER COLUMN `state` SET DEFAULT 'new';
UPDATE `web_job_applications` SET `state` = 'new' WHERE `state` = 'Nový';
