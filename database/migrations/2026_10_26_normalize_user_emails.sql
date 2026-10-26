-- =============================================================================
-- @file 2026_10_26_normalize_user_emails.sql
-- @path database/migrations/2026_10_26_normalize_user_emails.sql
-- @project RPSW Web
-- @author RPSW
-- @created 2026-10-26
-- @description Login e-mails in canonical form (lower case, no surrounding whitespace /
--   new line / tab). Since 2026-10-26 the API writes `users.user_email` only in this form
--   (User::setUserEmailAttribute()) and looks accounts up by it; rows written before (or edited
--   by hand in phpMyAdmin - a trailing new line made the account unable to log in) are fixed here.
-- @note Run once (idempotent; MariaDB 10.0.5+ / MySQL 8 - REGEXP_REPLACE). Check first that no two rows collapse into the same e-mail:
--     SELECT LOWER(REGEXP_REPLACE(user_email, '^[[:space:]]+|[[:space:]]+$', '')) AS e, COUNT(*)
--     FROM users GROUP BY e HAVING COUNT(*) > 1;
--   (must return no row - otherwise merge / rename those accounts by hand first). Invisible
--   Unicode characters (zero-width space, NBSP) are not handled by SQL TRIM - the API strips
--   them on the next save of the account.
-- =============================================================================

UPDATE `users`
SET `user_email` = LOWER(REGEXP_REPLACE(`user_email`, '^[[:space:]]+|[[:space:]]+$', ''));
