-- =============================================================================
-- @file 2026_10_26_scrub_logged_passwords.sql
-- @path database/migrations/2026_10_26_scrub_logged_passwords.sql
-- @project RPSW Web
-- @author RPSW
-- @created 2026-10-26
-- @description SECURITY clean-up: the maintenance switch of the web / e-shop sends the admin's
--   password as `confirm_password`; the audit log did not strip that key, so the PLAIN TEXT
--   password stood in `context_data` of web_logs / shop_logs (readable by everyone with the log
--   permission and in every log export). Fixed in App\Traits\LogsActivity (2026-10-26); this
--   removes the key from the rows written before. core_logs are cleaned the same way for safety.
-- @note Run once (idempotent; MariaDB 10.2.3+ / MySQL 5.7+ JSON functions). The passwords of
--   every admin who switched the maintenance mode must be treated as disclosed - change them.
--   Find who:  SELECT DISTINCT user_plain FROM web_logs WHERE JSON_CONTAINS_PATH(context_data, 'one', '$.confirm_password')
--              UNION SELECT DISTINCT user_plain FROM shop_logs WHERE JSON_CONTAINS_PATH(context_data, 'one', '$.confirm_password');
--   (run it BEFORE the updates below).
-- =============================================================================

UPDATE `web_logs`  SET `context_data` = JSON_REMOVE(`context_data`, '$.confirm_password')
WHERE JSON_VALID(`context_data`) AND JSON_CONTAINS_PATH(`context_data`, 'one', '$.confirm_password');

UPDATE `shop_logs` SET `context_data` = JSON_REMOVE(`context_data`, '$.confirm_password')
WHERE JSON_VALID(`context_data`) AND JSON_CONTAINS_PATH(`context_data`, 'one', '$.confirm_password');

UPDATE `core_logs` SET `context_data` = JSON_REMOVE(`context_data`, '$.confirm_password')
WHERE JSON_VALID(`context_data`) AND JSON_CONTAINS_PATH(`context_data`, 'one', '$.confirm_password');
