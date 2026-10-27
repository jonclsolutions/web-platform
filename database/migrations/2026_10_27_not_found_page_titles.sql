-- =============================================================================
-- @file 2026_10_27_not_found_page_titles.sql
-- @path database/migrations/2026_10_27_not_found_page_titles.sql
-- @project RPSW Web
-- @author RPSW
-- @created 2026-10-27
-- @description Browser tab titles of the public 404 pages. Since 2026-10-27 every public area has
--   its own catch-all 404 route (`publicNotFoundRoute()` in the Angular app) with the route title
--   `<area>.not-found`: `web.not-found` (any unknown URL of the web, and /404) and
--   `shop.not-found` (unknown /shop/... URL). PageTitleStrategy looks the title up in
--   `legal_page_titles`; without a row the tab shows the default title of index.html.
--   The texts are editable afterwards in admin → Company details → Page titles.
-- @note Idempotent: INSERT IGNORE on the unique (area, page_key) - an existing row (e.g.
--   `web.not-found` created earlier) keeps its edited text. MariaDB / MySQL.
-- =============================================================================

INSERT IGNORE INTO `legal_page_titles` (`area`, `page_key`, `route_path`, `title_i18n`, `sort_order`, `updated_at`) VALUES
  ('web',  'not-found', '/<unknown address>',      '{"cz":"Stránka nenalezena","en":"Page not found"}', 900, NOW()),
  ('shop', 'not-found', '/shop/<unknown address>', '{"cz":"Stránka nenalezena","en":"Page not found"}', 900, NOW());
