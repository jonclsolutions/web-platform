-- =============================================================================
-- @file baseline.sql
-- @path api/database/schema/baseline.sql
-- @project RPSW Web
-- @author RPSW
-- @created 2026-10-30
-- @description STRUCTURE of the whole database (no data) - created from the dump of 2026-10-29
--   (database/db.sql) by removing every INSERT, the `migrations` table (Laravel keeps its own)
--   and the data-dependent AUTO_INCREMENT counters. Executed once by the migration
--   0000_00_00_000000_create_baseline_schema on an EMPTY database; later schema changes are
--   ordinary Laravel migrations (never edit this file for them).
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `account_activation_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `core_email_access_rules` (
  `id` int(10) UNSIGNED NOT NULL,
  `type` enum('domain','email') NOT NULL,
  `value` varchar(255) NOT NULL COMMENT 'Domena (bez @) nebo cely email - vzdy ulozeno lowercase/trim',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_external_links` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `url` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `core_import_batches` (
  `id` int(10) UNSIGNED NOT NULL,
  `resource` varchar(100) NOT NULL COMMENT 'Klíč z config/importable_resources.php, stejný string jako apiEndpoint na frontendu',
  `user_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'Kdo import spustil - NULL pokud mezitím účet zanikl (ON DELETE SET NULL)',
  `original_filename` varchar(255) DEFAULT NULL,
  `format` varchar(10) NOT NULL COMMENT 'csv, xlsx, json, txt',
  `temp_path` varchar(500) DEFAULT NULL COMMENT 'Cesta k dočasně uloženému souboru na disku - mazána po commitu nebo purge příkazem',
  `status` enum('validated','queued','processing','completed','failed') NOT NULL DEFAULT 'validated',
  `total_rows` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `valid_rows` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `invalid_rows` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `imported_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `skipped_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `error_summary` text DEFAULT NULL COMMENT 'JSON pole {row, reason} - jen prvních N chyb, ne nutně všechny (viz ImportFileParser::MAX_STORED_ERRORS)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `origin` varchar(255) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `module` varchar(100) NOT NULL,
  `description` varchar(1000) NOT NULL,
  `affected_entity_type` varchar(50) DEFAULT NULL,
  `affected_entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `context_data` text DEFAULT NULL,
  `user_id_plain` varchar(255) DEFAULT NULL,
  `user_plain` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_permissions` (
  `id` int(10) UNSIGNED NOT NULL,
  `permission_key` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `module` varchar(50) DEFAULT 'core',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `forces_2fa` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Sysadmin nastavil, že tato role vyžaduje 2FA pro všechny uživatele s touto rolí (hromadné vynucení bez nutnosti nastavovat per-uživatel). Netýká se sysadmin/admin - ty mají 2FA vynuceno natvrdo v kódu bez ohledu na tento sloupec.',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_role_permissions` (
  `role_id` int(10) UNSIGNED NOT NULL,
  `permission_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_security_events` (
  `id` int(10) UNSIGNED NOT NULL,
  `fingerprint` char(64) NOT NULL COMMENT 'SHA-256(event_type|ip|time_bucket) - bucketovací klíč proti zahlcení tabulky při útoku, viz CoreSecurityEvent::record()',
  `event_type` varchar(50) NOT NULL COMMENT 'captcha_failed, throttle_exceeded, login_failed_spike, scan_probe, oversized_upload, ...',
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IPv4/IPv6 - osobní údaj dle GDPR, viz retence v core_security_settings',
  `user_agent` varchar(255) DEFAULT NULL,
  `route` varchar(255) DEFAULT NULL,
  `method` varchar(10) DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `occurrences` int(10) UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Počet výskytů v rámci časového okna - viz bucketing',
  `first_seen_at` datetime NOT NULL,
  `last_seen_at` datetime NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'new' COMMENT 'new, reviewed, false_positive, confirmed_attack',
  `notes` varchar(1000) DEFAULT NULL,
  `context_data` text DEFAULT NULL COMMENT 'Krátký JSON kontext - NIKDY celý request payload (GDPR minimalizace dat)',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `core_security_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `retention_days` smallint(5) UNSIGNED NOT NULL DEFAULT 90 COMMENT 'Po kolika dnech se core_security_events automaticky maže (GDPR retence)',
  `primary_email_domain` varchar(255) DEFAULT NULL COMMENT 'Hlavni povolena domena pro nove admin ucty (napr. rpsw.cz). NULL = bez omezeni.',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `document_sections` (
  `id` int(10) UNSIGNED NOT NULL,
  `document_type_id` int(10) UNSIGNED NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `heading` varchar(255) DEFAULT NULL,
  `content` text NOT NULL,
  `lang` varchar(5) NOT NULL DEFAULT 'cz',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `document_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `slug` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `legal_page_titles` (
  `id` int(10) UNSIGNED NOT NULL,
  `area` enum('web','shop','admin') NOT NULL COMMENT 'web = public website, shop = e-shop, admin = administration',
  `page_key` varchar(64) NOT NULL COMMENT 'Stable page identifier, matches Angular route title "area.page_key"',
  `route_path` varchar(255) NOT NULL COMMENT 'Informative URL shown in admin (not used for routing)',
  `title_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Tab title per language code' CHECK (json_valid(`title_i18n`)),
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `legal_site_settings` (
  `id` int(11) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `ico` varchar(20) NOT NULL,
  `dic` varchar(20) DEFAULT NULL,
  `google_analytics_id` varchar(20) DEFAULT NULL,
  `brand_tagline` varchar(255) NOT NULL,
  `brand_tagline_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`brand_tagline_i18n`)),
  `copyright_text` varchar(255) NOT NULL,
  `copyright_text_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`copyright_text_i18n`)),
  `contact_email` varchar(255) NOT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `address` text NOT NULL,
  `footer_text` varchar(255) DEFAULT '©2025 RegioPartner, s.r.o., Všechna práva vyhrazena.',
  `logo_path` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `legal_social_links` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `url` varchar(255) NOT NULL,
  `icon_path` varchar(255) NOT NULL,
  `position` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `password_reset_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(64) NOT NULL COMMENT 'SHA-256 hash raw tokenu, nikdy raw hodnota',
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `used_at` timestamp NULL DEFAULT NULL COMMENT 'NULL = dosud nepoužitý',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `slug` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `parent_id` int(10) UNSIGNED DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_coupons` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `discount_type` varchar(20) NOT NULL COMMENT 'percent, fixed',
  `discount_value` decimal(10,2) NOT NULL,
  `max_usage` int(11) DEFAULT NULL COMMENT 'NULL = neomezeno',
  `usage_count` int(11) DEFAULT 0,
  `min_order_amount` decimal(10,2) DEFAULT NULL,
  `applies_to` varchar(50) DEFAULT 'all' COMMENT 'all, products, categories',
  `valid_from` datetime DEFAULT NULL,
  `valid_until` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_customers` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `email` varchar(150) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `company` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `country` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `total_spent` decimal(12,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `origin` varchar(255) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `module` varchar(100) NOT NULL,
  `description` varchar(1000) NOT NULL,
  `affected_entity_type` varchar(50) DEFAULT NULL,
  `affected_entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `context_data` text DEFAULT NULL,
  `user_id_plain` varchar(255) DEFAULT NULL,
  `user_plain` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `shop_orders` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `customer_first_name` varchar(100) DEFAULT NULL COMMENT 'Buyer as given for this order',
  `customer_last_name` varchar(100) DEFAULT NULL,
  `customer_email` varchar(150) DEFAULT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `customer_company` varchar(150) DEFAULT NULL,
  `order_number` varchar(50) NOT NULL,
  `status` varchar(50) DEFAULT 'pending' COMMENT 'pending, confirmed, processing, shipped, delivered, returned, canceled',
  `payment_status` varchar(50) DEFAULT 'pending' COMMENT 'pending, paid, failed, refunded, cod',
  `total_amount` decimal(10,2) NOT NULL,
  `shipping_amount` decimal(10,2) DEFAULT 0.00,
  `tax_amount` decimal(10,2) DEFAULT 0.00,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `final_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `coupon_id` int(10) UNSIGNED DEFAULT NULL,
  `payment_method_id` int(10) UNSIGNED DEFAULT NULL,
  `shipping_method_id` int(10) UNSIGNED DEFAULT NULL,
  `shipping_address` varchar(255) DEFAULT NULL,
  `shipping_city` varchar(100) DEFAULT NULL,
  `shipping_postal_code` varchar(10) DEFAULT NULL,
  `shipping_country` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_order_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `order_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `product_variant_id` int(10) UNSIGNED DEFAULT NULL,
  `product_name` varchar(200) NOT NULL COMMENT 'Kopie názvu (pro historii)',
  `variant_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `vat_rate` decimal(5,2) NOT NULL DEFAULT 21.00 COMMENT 'VAT rate in % at the time of the sale',
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_payments` (
  `id` int(10) UNSIGNED NOT NULL,
  `order_id` int(10) UNSIGNED NOT NULL,
  `gateway_transaction_id` varchar(255) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) DEFAULT 'EUR',
  `status` varchar(50) DEFAULT 'pending',
  `gateway_provider` varchar(50) DEFAULT 'stripe',
  `gateway_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`gateway_response`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_payment_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `payment_id` int(10) UNSIGNED NOT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) NOT NULL,
  `gateway_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`gateway_response`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_payment_methods` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL COMMENT 'např. stripe, bank_transfer, cod',
  `name` varchar(100) NOT NULL COMMENT 'Název pro zákazníka',
  `image_path` varchar(255) DEFAULT NULL COMMENT 'Cesta k logu/obrázku platební metody',
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Poplatek za platbu',
  `provider` varchar(50) NOT NULL DEFAULT 'manual' COMMENT 'stripe, paypal, manual, atd.',
  `is_external` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 = manuální/v e-shopu, 1 = přesměrování na bránu',
  `bank_account_number` varchar(50) DEFAULT NULL COMMENT 'Číslo účtu bez kódu banky',
  `bank_account_code` varchar(10) DEFAULT NULL COMMENT 'Kód banky (např. 0100)',
  `bank_iban` varchar(34) DEFAULT NULL COMMENT 'Pro mezinárodní platby',
  `bank_swift_bic` varchar(11) DEFAULT NULL,
  `variable_symbol_type` enum('order_number','phone_number','none') DEFAULT 'order_number',
  `config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT json_object() COMMENT 'Specifická konfigurace pro platební brány a metody' CHECK (json_valid(`config`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft Delete pro koš'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_products` (
  `id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED DEFAULT NULL,
  `supplier_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `name_en` varchar(200) DEFAULT NULL,
  `slug` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `description_en` text DEFAULT NULL,
  `short_description` varchar(500) DEFAULT NULL,
  `short_description_en` varchar(500) DEFAULT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `stock_warning_level` int(11) DEFAULT 10,
  `is_active` tinyint(1) DEFAULT 1,
  `is_featured` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_product_categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = primární kategorie (kopíruje category_id)',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_product_images` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `variant_id` int(10) UNSIGNED DEFAULT NULL,
  `image_path` varchar(255) NOT NULL,
  `alt_text` varchar(200) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_product_prices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `variant_id` int(10) UNSIGNED DEFAULT NULL COMMENT 'NULL pokud jde o hlavní produkt',
  `vat_rate` decimal(5,2) NOT NULL DEFAULT 21.00,
  `price_eur_without_vat` decimal(10,2) DEFAULT NULL,
  `cost_price_eur` decimal(12,4) DEFAULT NULL,
  `price_eur_with_vat` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_product_variants` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `variant_name` varchar(100) NOT NULL COMMENT 'např. "Černá - Velikost M"',
  `attribute_1_name` varchar(50) DEFAULT NULL COMMENT 'např. "Barva"',
  `attribute_1_value` varchar(100) DEFAULT NULL COMMENT 'např. "Černá"',
  `attribute_2_name` varchar(50) DEFAULT NULL COMMENT 'např. "Velikost"',
  `attribute_2_value` varchar(100) DEFAULT NULL COMMENT 'např. "M"',
  `sku_variant` varchar(50) DEFAULT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_reviews` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `rating` tinyint(1) NOT NULL COMMENT '1-5',
  `title` varchar(100) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `is_approved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_shipping_methods` (
  `id` int(10) UNSIGNED NOT NULL,
  `code` varchar(50) NOT NULL COMMENT 'např. ppl_parcel, zasilkovna, osobni_odber',
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `shipping_type` varchar(30) NOT NULL DEFAULT 'address',
  `base_price` decimal(8,2) NOT NULL DEFAULT 0.00,
  `free_shipping_threshold` decimal(10,2) DEFAULT NULL,
  `max_weight` decimal(8,2) DEFAULT NULL,
  `requires_pickup_point` tinyint(1) DEFAULT 0 COMMENT '1 = vyžaduje výběr pobočky (mapu)',
  `allows_cod` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 = nepodporuje dobírku',
  `cod_price` decimal(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Příplatek za dobírku',
  `tracking_url` varchar(255) DEFAULT NULL COMMENT 'Např. https://www.ppl.cz/vyhledat-balik?slug={T}',
  `logo_path` varchar(255) DEFAULT NULL,
  `delivery_days_min` int(11) DEFAULT NULL,
  `delivery_days_max` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_site_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `is_shop_active` tinyint(1) NOT NULL DEFAULT 1,
  `maintenance_message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop_suppliers` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(200) NOT NULL,
  `ico` varchar(20) DEFAULT NULL,
  `contact_person` varchar(150) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `country` varchar(50) DEFAULT NULL,
  `payment_terms` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `two_factor_codes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `login_token_hash` varchar(64) NOT NULL COMMENT 'SHA-256 hash opaque tokenu pending-login session (raw hodnota jde jen klientovi)',
  `code_hash` varchar(64) NOT NULL COMMENT 'SHA-256 hash 6místného OTP kódu odeslaného e-mailem, raw hodnota se NIKDY neukládá',
  `attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Počet neúspěšných pokusů o ověření kódu - po dosažení limitu (5) session invalidovat',
  `resend_count` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Kolikrát byl v rámci téhle pending-login session vyžádán nový kód (anti-spam strop)',
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Platnost kódu, doporučeno +10 minut od vytvoření/posledního resendu',
  `last_sent_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Čas posledního odeslání e-mailu - použito pro resend cooldown (60s)',
  `used_at` timestamp NULL DEFAULT NULL COMMENT 'NULL = dosud nepoužitý',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP, ze které byl login zahájen - audit',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `dpp_hours_spent` int(5) NOT NULL DEFAULT 0,
  `enable_2fa` tinyint(1) NOT NULL DEFAULT 0,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `activated_at` timestamp NULL DEFAULT NULL,
  `two_fa_forced_by_admin` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Sysadmin vynutil 2FA tomuto uživateli nezávisle na jeho vlastní enable_2fa volbě',
  `internal_note` text DEFAULT NULL,
  `user_password_hash` varchar(255) DEFAULT NULL,
  `user_password_salt` varchar(255) DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_permissions` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `permission_id` int(10) UNSIGNED NOT NULL,
  `granted_by` int(10) UNSIGNED DEFAULT NULL COMMENT 'user_id of the admin who granted this explicit permission - audit trail.',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `user_roles` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `role_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `web_attachments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `attachable_type` varchar(191) NOT NULL,
  `attachable_id` bigint(20) UNSIGNED NOT NULL,
  `disk` varchar(50) NOT NULL DEFAULT 'public',
  `path` varchar(500) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime_type` varchar(150) DEFAULT NULL,
  `size_bytes` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `web_job_applications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `position_name` varchar(150) NOT NULL,
  `message` text DEFAULT NULL,
  `cv_path` varchar(255) DEFAULT NULL,
  `cv_original_name` varchar(255) DEFAULT NULL,
  `state` varchar(50) NOT NULL DEFAULT 'new',
  `internal_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `origin` varchar(255) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `module` varchar(100) NOT NULL,
  `description` varchar(1000) NOT NULL,
  `affected_entity_type` varchar(50) DEFAULT NULL,
  `affected_entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `context_data` text DEFAULT NULL,
  `user_id_plain` varchar(255) DEFAULT NULL,
  `user_plain` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `web_news` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` varchar(10000) NOT NULL,
  `author` varchar(255) NOT NULL,
  `thema` varchar(255) NOT NULL,
  `bullet_1` varchar(255) DEFAULT NULL,
  `bullet_2` varchar(255) DEFAULT NULL,
  `bullet_3` varchar(255) DEFAULT NULL,
  `bullet_4` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `web_projects` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED DEFAULT NULL,
  `order_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `platform` varchar(100) DEFAULT NULL,
  `project_lead` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(255) DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `technologies` text DEFAULT NULL,
  `estimated_completion_from` date DEFAULT NULL,
  `estimated_completion_to` date DEFAULT NULL,
  `visibility` enum('public','private') NOT NULL DEFAULT 'private',
  `status` enum('new','development','finished') NOT NULL DEFAULT 'new',
  `access_token` varchar(64) NOT NULL,
  `access_password_hash` varchar(255) NOT NULL,
  `password_generated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_project_checkpoints` (
  `id` int(10) UNSIGNED NOT NULL,
  `project_id` int(10) UNSIGNED NOT NULL,
  `label` varchar(255) NOT NULL,
  `status` enum('new','active','done') NOT NULL DEFAULT 'new',
  `status_changed_at` timestamp NULL DEFAULT NULL,
  `sort_order` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_project_sessions` (
  `id` int(10) UNSIGNED NOT NULL,
  `project_id` int(10) UNSIGNED NOT NULL,
  `session_token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_used_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_project_threads` (
  `id` int(10) UNSIGNED NOT NULL,
  `project_id` int(10) UNSIGNED NOT NULL,
  `subject` varchar(255) NOT NULL,
  `priority` enum('low','medium','high','critic') NOT NULL DEFAULT 'medium',
  `status` enum('active','closed') NOT NULL DEFAULT 'active',
  `opened_by` enum('customer','admin') NOT NULL DEFAULT 'customer',
  `last_message_at` timestamp NULL DEFAULT NULL,
  `customer_last_read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_project_thread_messages` (
  `id` int(10) UNSIGNED NOT NULL,
  `thread_id` int(10) UNSIGNED NOT NULL,
  `author_type` enum('customer','admin') NOT NULL,
  `author_label` varchar(255) DEFAULT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_raw_request_commissions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `thema` varchar(255) NOT NULL,
  `contact_email` varchar(255) NOT NULL,
  `contact_phone` varchar(255) DEFAULT NULL,
  `order_description` text NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'new',
  `priority` varchar(255) NOT NULL DEFAULT 'neutral',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `note` text DEFAULT NULL,
  `lang` varchar(5) NOT NULL DEFAULT 'cz'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_sales_leads` (
  `id` int(10) UNSIGNED NOT NULL,
  `public_token` varchar(64) DEFAULT NULL,
  `public_token_used_at` timestamp NULL DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `salesman_name` varchar(255) NOT NULL,
  `first_contact_date` date DEFAULT NULL,
  `subject_name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `source_channel` varchar(255) NOT NULL,
  `source_url` varchar(500) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `priority` varchar(255) DEFAULT 'neutral',
  `status` varchar(255) DEFAULT 'new',
  `last_contact_date` date DEFAULT NULL,
  `next_step` varchar(255) DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `contact_phone` varchar(255) DEFAULT NULL,
  `contact_other` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_sales_orders` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED DEFAULT NULL,
  `salesman_name` varchar(255) DEFAULT NULL,
  `ico` varchar(20) DEFAULT NULL,
  `client_name` varchar(255) NOT NULL,
  `client_address` varchar(500) DEFAULT NULL,
  `client_phone` varchar(255) DEFAULT NULL,
  `client_email` varchar(255) DEFAULT NULL,
  `order_description` text DEFAULT NULL,
  `data_processing_agreement` tinyint(1) NOT NULL DEFAULT 0,
  `tos_agreement` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_site_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `is_web_active` tinyint(1) NOT NULL DEFAULT 1,
  `web_maintenance_message` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `raw_request_email_title_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `raw_request_email_intro_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `raw_request_email_outro_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `raw_request_email_labels_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `raw_request_email_subject_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `web_support_tickets` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `user_name_plain` varchar(255) NOT NULL,
  `user_plain` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `priority` varchar(50) DEFAULT 'medium',
  `state` varchar(50) DEFAULT 'new',
  `subject` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_original_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `account_activation_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_activation_tokens_token_hash_unique` (`token_hash`),
  ADD KEY `account_activation_tokens_user_id_index` (`user_id`);

ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

ALTER TABLE `core_email_access_rules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `core_email_access_rules_type_value_unique` (`type`,`value`);

ALTER TABLE `core_external_links`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_external_links_user_id` (`user_id`);

ALTER TABLE `core_import_batches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_import_batches_resource` (`resource`),
  ADD KEY `idx_import_batches_status` (`status`),
  ADD KEY `fk_import_batches_user_id` (`user_id`);

ALTER TABLE `core_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_core_logs_user_id` (`user_id`);

ALTER TABLE `core_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_permission_key` (`permission_key`);

ALTER TABLE `core_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

ALTER TABLE `core_role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `fk_crp_permission_id` (`permission_id`);

ALTER TABLE `core_security_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_security_event_fingerprint` (`fingerprint`),
  ADD KEY `fk_security_events_user_id` (`user_id`),
  ADD KEY `idx_security_events_event_type` (`event_type`),
  ADD KEY `idx_security_events_last_seen_at` (`last_seen_at`);

ALTER TABLE `core_security_settings`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `document_sections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_document_type` (`document_type_id`);

ALTER TABLE `document_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

ALTER TABLE `legal_page_titles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_legal_page_titles_area_key` (`area`,`page_key`);

ALTER TABLE `legal_site_settings`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `legal_social_links`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `password_reset_tokens_token_hash_unique` (`token_hash`),
  ADD KEY `password_reset_tokens_user_id_used_at_index` (`user_id`,`used_at`);

ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_unique` (`token`),
  ADD KEY `tokenable_index` (`tokenable_type`,`tokenable_id`);

ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_unique` (`token`),
  ADD KEY `fk_refresh_user_id` (`user_id`);

ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

ALTER TABLE `shop_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_slug_per_level` (`slug`,`parent_id`),
  ADD KEY `idx_shop_categories_parent` (`parent_id`),
  ADD KEY `idx_shop_categories_active_sort` (`is_active`,`sort_order`);

ALTER TABLE `shop_coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `shop_customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_shop_customers_user` (`user_id`);

ALTER TABLE `shop_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_logs_user_id` (`user_id`);

ALTER TABLE `shop_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `fk_shop_orders_customer` (`customer_id`),
  ADD KEY `fk_shop_orders_coupon` (`coupon_id`),
  ADD KEY `fk_shop_orders_payment` (`payment_method_id`),
  ADD KEY `fk_shop_orders_shipping` (`shipping_method_id`);

ALTER TABLE `shop_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_order_items_order` (`order_id`),
  ADD KEY `fk_shop_order_items_product` (`product_id`),
  ADD KEY `fk_shop_order_items_variant` (`product_variant_id`);

ALTER TABLE `shop_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_payment_order` (`order_id`);

ALTER TABLE `shop_payment_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_payment_log_payment` (`payment_id`);

ALTER TABLE `shop_payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `shop_products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `fk_shop_products_category` (`category_id`),
  ADD KEY `fk_shop_products_supplier` (`supplier_id`);

ALTER TABLE `shop_product_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_category` (`product_id`,`category_id`),
  ADD KEY `idx_spc_product_id` (`product_id`),
  ADD KEY `idx_spc_category_id` (`category_id`);

ALTER TABLE `shop_product_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_product_images_product` (`product_id`),
  ADD KEY `fk_shop_product_images_variant` (`variant_id`);

ALTER TABLE `shop_product_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_prices_product_id` (`product_id`),
  ADD KEY `fk_prices_variant_id` (`variant_id`);

ALTER TABLE `shop_product_variants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku_variant` (`sku_variant`),
  ADD KEY `fk_shop_product_variants_product` (`product_id`);

ALTER TABLE `shop_reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_reviews_product` (`product_id`),
  ADD KEY `fk_shop_reviews_customer` (`customer_id`);

ALTER TABLE `shop_shipping_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

ALTER TABLE `shop_site_settings`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `shop_suppliers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ico` (`ico`);

ALTER TABLE `two_factor_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_2fa_login_token_hash` (`login_token_hash`),
  ADD KEY `fk_2fa_user_id` (`user_id`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_email` (`user_email`);

ALTER TABLE `user_permissions`
  ADD PRIMARY KEY (`user_id`,`permission_id`),
  ADD KEY `fk_up_permission_id` (`permission_id`),
  ADD KEY `fk_up_granted_by` (`granted_by`);

ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `fk_ur_role_id` (`role_id`);

ALTER TABLE `web_attachments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `web_attachments_attachable_index` (`attachable_type`,`attachable_id`);

ALTER TABLE `web_job_applications`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `web_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_logs_user_id` (`user_id`);

ALTER TABLE `web_news`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `web_projects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_web_projects_access_token` (`access_token`),
  ADD UNIQUE KEY `uq_web_projects_order_id` (`order_id`),
  ADD KEY `fk_web_projects_lead_id` (`lead_id`),
  ADD KEY `fk_web_projects_order_id` (`order_id`),
  ADD KEY `idx_web_projects_visibility` (`visibility`);

ALTER TABLE `web_project_checkpoints`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_project_checkpoints_project_id` (`project_id`),
  ADD KEY `idx_web_project_checkpoints_sort` (`project_id`,`sort_order`);

ALTER TABLE `web_project_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_web_project_sessions_token_hash` (`session_token_hash`),
  ADD KEY `fk_web_project_sessions_project_id` (`project_id`),
  ADD KEY `idx_web_project_sessions_expires_at` (`expires_at`);

ALTER TABLE `web_project_threads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_project_threads_project_id` (`project_id`),
  ADD KEY `idx_web_project_threads_last_message_at` (`project_id`,`last_message_at`);

ALTER TABLE `web_project_thread_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_project_thread_messages_thread_id` (`thread_id`);

ALTER TABLE `web_raw_request_commissions`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `web_sales_leads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_web_sales_leads_public_token` (`public_token`),
  ADD KEY `fk_web_sales_leads_user_id` (`user_id`);

ALTER TABLE `web_sales_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_sales_orders_lead_id` (`lead_id`);

ALTER TABLE `web_site_settings`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `web_support_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_support_user_id` (`user_id`);

ALTER TABLE `account_activation_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_email_access_rules`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_external_links`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_import_batches`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_security_events`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `core_security_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `document_sections`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `document_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `legal_page_titles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `legal_site_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `legal_social_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `password_reset_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_coupons`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_order_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_payment_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_payment_methods`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_product_categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_product_images`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_product_prices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_product_variants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_reviews`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_shipping_methods`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_site_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `shop_suppliers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `two_factor_codes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_attachments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_job_applications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_projects`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_project_checkpoints`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_project_sessions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_project_threads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_project_thread_messages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_raw_request_commissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_sales_leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_sales_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_site_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `web_support_tickets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE `account_activation_tokens`
  ADD CONSTRAINT `account_activation_tokens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `core_external_links`
  ADD CONSTRAINT `fk_web_external_links_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `core_import_batches`
  ADD CONSTRAINT `fk_import_batches_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `core_role_permissions`
  ADD CONSTRAINT `fk_crp_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `core_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_crp_role_id` FOREIGN KEY (`role_id`) REFERENCES `core_roles` (`id`) ON DELETE CASCADE;

ALTER TABLE `core_security_events`
  ADD CONSTRAINT `fk_security_events_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `document_sections`
  ADD CONSTRAINT `fk_document_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`) ON DELETE CASCADE;

ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `fk_refresh_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_categories`
  ADD CONSTRAINT `fk_shop_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `shop_categories` (`id`);

ALTER TABLE `shop_customers`
  ADD CONSTRAINT `fk_shop_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `shop_logs`
  ADD CONSTRAINT `fk_shop_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `shop_orders`
  ADD CONSTRAINT `fk_shop_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `shop_coupons` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers` (`id`),
  ADD CONSTRAINT `fk_shop_orders_payment` FOREIGN KEY (`payment_method_id`) REFERENCES `shop_payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_orders_shipping` FOREIGN KEY (`shipping_method_id`) REFERENCES `shop_shipping_methods` (`id`) ON DELETE SET NULL;

ALTER TABLE `shop_order_items`
  ADD CONSTRAINT `fk_shop_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `shop_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_shop_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`),
  ADD CONSTRAINT `fk_shop_order_items_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `shop_product_variants` (`id`) ON DELETE SET NULL;

ALTER TABLE `shop_payments`
  ADD CONSTRAINT `fk_shop_payment_order` FOREIGN KEY (`order_id`) REFERENCES `shop_orders` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_payment_logs`
  ADD CONSTRAINT `fk_shop_payment_log_payment` FOREIGN KEY (`payment_id`) REFERENCES `shop_payments` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_products`
  ADD CONSTRAINT `fk_shop_products_category` FOREIGN KEY (`category_id`) REFERENCES `shop_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_products_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `shop_suppliers` (`id`) ON DELETE SET NULL;

ALTER TABLE `shop_product_categories`
  ADD CONSTRAINT `fk_spc_category_id` FOREIGN KEY (`category_id`) REFERENCES `shop_categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_spc_product_id` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_product_images`
  ADD CONSTRAINT `fk_shop_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_shop_product_images_variant` FOREIGN KEY (`variant_id`) REFERENCES `shop_product_variants` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_product_prices`
  ADD CONSTRAINT `fk_prices_product_id` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_prices_variant_id` FOREIGN KEY (`variant_id`) REFERENCES `shop_product_variants` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_product_variants`
  ADD CONSTRAINT `fk_shop_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE;

ALTER TABLE `shop_reviews`
  ADD CONSTRAINT `fk_shop_reviews_customer` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE;

ALTER TABLE `two_factor_codes`
  ADD CONSTRAINT `fk_2fa_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `user_permissions`
  ADD CONSTRAINT `fk_up_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_up_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `core_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_up_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_ur_role_id` FOREIGN KEY (`role_id`) REFERENCES `core_roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

ALTER TABLE `web_logs`
  ADD CONSTRAINT `fk_web_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `web_projects`
  ADD CONSTRAINT `fk_web_projects_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `web_sales_leads` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_web_projects_order_id` FOREIGN KEY (`order_id`) REFERENCES `web_sales_orders` (`id`) ON DELETE SET NULL;

ALTER TABLE `web_project_checkpoints`
  ADD CONSTRAINT `fk_web_project_checkpoints_project_id` FOREIGN KEY (`project_id`) REFERENCES `web_projects` (`id`) ON DELETE CASCADE;

ALTER TABLE `web_project_sessions`
  ADD CONSTRAINT `fk_web_project_sessions_project_id` FOREIGN KEY (`project_id`) REFERENCES `web_projects` (`id`) ON DELETE CASCADE;

ALTER TABLE `web_project_threads`
  ADD CONSTRAINT `fk_web_project_threads_project_id` FOREIGN KEY (`project_id`) REFERENCES `web_projects` (`id`) ON DELETE CASCADE;

ALTER TABLE `web_project_thread_messages`
  ADD CONSTRAINT `fk_web_project_thread_messages_thread_id` FOREIGN KEY (`thread_id`) REFERENCES `web_project_threads` (`id`) ON DELETE CASCADE;

ALTER TABLE `web_sales_leads`
  ADD CONSTRAINT `fk_web_sales_leads_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `web_sales_orders`
  ADD CONSTRAINT `fk_web_sales_orders_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `web_sales_leads` (`id`) ON DELETE SET NULL;

ALTER TABLE `web_support_tickets`
  ADD CONSTRAINT `fk_web_support_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;
