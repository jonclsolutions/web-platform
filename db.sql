-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Aug 26, 2026 at 01:20 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `rp_website`
--

-- --------------------------------------------------------

--
-- Table structure for table `account_activation_tokens`
--

CREATE TABLE `account_activation_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cache`
--

INSERT INTO `cache` (`key`, `value`, `expiration`) VALUES
('laravel-cache-54a3532e057dad0aaee884059fab91c3', 'i:1;', 1787572132),
('laravel-cache-54a3532e057dad0aaee884059fab91c3:timer', 'i:1787572132;', 1787572132),
('laravel-cache-5696cb0a09ed2d5fdc602f10842aec0e', 'i:1;', 1787734112),
('laravel-cache-5696cb0a09ed2d5fdc602f10842aec0e:timer', 'i:1787734112;', 1787734112),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba', 'i:20;', 1787671204),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787671204;', 1787671204),
('laravel-cache-6fb84aed32facd1299ee1e77c8fd2b1a6352669e', 'i:1;', 1787571757),
('laravel-cache-6fb84aed32facd1299ee1e77c8fd2b1a6352669e:timer', 'i:1787571757;', 1787571757),
('laravel-cache-812ed4562d3211363a7b813aa9cd2cf042b63bb2', 'i:3;', 1787572133),
('laravel-cache-812ed4562d3211363a7b813aa9cd2cf042b63bb2:timer', 'i:1787572133;', 1787572133),
('laravel-cache-862e0a123663139c2a0be726ddb86842', 'i:1;', 1787734112),
('laravel-cache-862e0a123663139c2a0be726ddb86842:timer', 'i:1787734112;', 1787734112),
('laravel-cache-8e123e8d24ec68e7f5368b44433ec751', 'i:1;', 1787571558),
('laravel-cache-8e123e8d24ec68e7f5368b44433ec751:timer', 'i:1787571558;', 1787571558),
('laravel-cache-account-activation-activate5c785c036466adea360111aa28563bfd556b5fba', 'i:3;', 1787691820),
('laravel-cache-account-activation-activate5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787691820;', 1787691820),
('laravel-cache-account-activation-show5c785c036466adea360111aa28563bfd556b5fba', 'i:5;', 1787691820),
('laravel-cache-account-activation-show5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787691820;', 1787691820),
('laravel-cache-ae6983357c75cd0504c65f79682f5e6e', 'i:1;', 1787571812),
('laravel-cache-ae6983357c75cd0504c65f79682f5e6e:timer', 'i:1787571812;', 1787571812),
('laravel-cache-babf79d7e6993b354b018be8ec035fff', 'i:3;', 1787691822),
('laravel-cache-babf79d7e6993b354b018be8ec035fff:timer', 'i:1787691822;', 1787691822),
('laravel-cache-f57842f6d821fe7713b8263d8fc90fb3', 'i:5;', 1787691813),
('laravel-cache-f57842f6d821fe7713b8263d8fc90fb3:timer', 'i:1787691813;', 1787691813),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400', 'i:2;', 1787742905),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400:timer', 'i:1787742905;', 1787742905),
('laravel-cache-login-fail:joner@test.cz', 'i:2;', 1787572236),
('laravel-cache-login-fail:joner@test.cz:timer', 'i:1787572236;', 1787572236),
('laravel-cache-login-fail:utok-test@example.com', 'i:3;', 1787692653),
('laravel-cache-login-fail:utok-test@example.com:timer', 'i:1787692653;', 1787692653),
('laravel-cache-login-verify-2fa5c785c036466adea360111aa28563bfd556b5fba', 'i:1;', 1787734123),
('laravel-cache-login-verify-2fa5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787734123;', 1787734123),
('laravel-cache-password-forgot5c785c036466adea360111aa28563bfd556b5fba', 'i:5;', 1787691815),
('laravel-cache-password-forgot5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787691815;', 1787691815),
('laravel-cache-password-reset-email:utok-test@example.com', 'i:3;', 1787692655),
('laravel-cache-password-reset-email:utok-test@example.com:timer', 'i:1787692655;', 1787692655),
('laravel-cache-password-reset5c785c036466adea360111aa28563bfd556b5fba', 'i:5;', 1787691821),
('laravel-cache-password-reset5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787691821;', 1787691821),
('laravel-cache-sales-orders5c785c036466adea360111aa28563bfd556b5fba', 'i:10;', 1787691815),
('laravel-cache-sales-orders5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787691815;', 1787691815),
('laravel-cache-scan-probe5c785c036466adea360111aa28563bfd556b5fba', 'i:10;', 1787691817),
('laravel-cache-scan-probe5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1787691817;', 1787691817),
('laravel-cache-site_setting_active_web', 'O:29:\"App\\Models\\Web\\WebSiteSetting\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:17:\"web_site_settings\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:10:{s:2:\"id\";i:1;s:13:\"is_web_active\";i:1;s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";s:10:\"updated_at\";s:19:\"2026-08-22 00:06:58\";s:28:\"raw_request_email_title_i18n\";s:88:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Your request has been accepted\"}\";s:28:\"raw_request_email_intro_i18n\";s:240:\"{\"cz\":\"d\\u011bkujeme za Va\\u0161i popt\\u00e1vku. Byla \\u00fasp\\u011b\\u0161n\\u011b p\\u0159ijate a n\\u00e1\\u0161 t\\u00fdm se j\\u00ed bude v nejbli\\u017e\\u0161\\u00ed dob\\u011b v\\u011bnovat.\",\"en\":\"thank you for order we will take look at it.\"}\";s:28:\"raw_request_email_outro_i18n\";s:121:\"{\"cz\":\"V p\\u0159\\u00edpad\\u011b dotaz\\u016f n\\u00e1s nev\\u00e1hejte kontaktovat.\",\"en\":\"If you have questing contact us\"}\";s:29:\"raw_request_email_labels_i18n\";s:236:\"{\"cz\":[],\"en\":{\"greeting\":\"Hello,\",\"summary_header\":\"Recapitulation\",\"label_thema\":\"Thema\",\"label_email\":\"Contact Email\",\"label_phone\":\"Telephone\",\"label_description\":\"Description\",\"label_attachments\":\"Accessments\",\"label_date\":\"Date\"}}\";s:30:\"raw_request_email_subject_i18n\";s:75:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Order information\"}\";}s:11:\"\0*\0original\";a:10:{s:2:\"id\";i:1;s:13:\"is_web_active\";i:1;s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";s:10:\"updated_at\";s:19:\"2026-08-22 00:06:58\";s:28:\"raw_request_email_title_i18n\";s:88:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Your request has been accepted\"}\";s:28:\"raw_request_email_intro_i18n\";s:240:\"{\"cz\":\"d\\u011bkujeme za Va\\u0161i popt\\u00e1vku. Byla \\u00fasp\\u011b\\u0161n\\u011b p\\u0159ijate a n\\u00e1\\u0161 t\\u00fdm se j\\u00ed bude v nejbli\\u017e\\u0161\\u00ed dob\\u011b v\\u011bnovat.\",\"en\":\"thank you for order we will take look at it.\"}\";s:28:\"raw_request_email_outro_i18n\";s:121:\"{\"cz\":\"V p\\u0159\\u00edpad\\u011b dotaz\\u016f n\\u00e1s nev\\u00e1hejte kontaktovat.\",\"en\":\"If you have questing contact us\"}\";s:29:\"raw_request_email_labels_i18n\";s:236:\"{\"cz\":[],\"en\":{\"greeting\":\"Hello,\",\"summary_header\":\"Recapitulation\",\"label_thema\":\"Thema\",\"label_email\":\"Contact Email\",\"label_phone\":\"Telephone\",\"label_description\":\"Description\",\"label_attachments\":\"Accessments\",\"label_date\":\"Date\"}}\";s:30:\"raw_request_email_subject_i18n\";s:75:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Order information\"}\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:6:{s:13:\"is_web_active\";s:7:\"boolean\";s:28:\"raw_request_email_title_i18n\";s:5:\"array\";s:28:\"raw_request_email_intro_i18n\";s:5:\"array\";s:28:\"raw_request_email_outro_i18n\";s:5:\"array\";s:29:\"raw_request_email_labels_i18n\";s:5:\"array\";s:30:\"raw_request_email_subject_i18n\";s:5:\"array\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:7:{i:0;s:13:\"is_web_active\";i:1;s:23:\"web_maintenance_message\";i:2;s:28:\"raw_request_email_title_i18n\";i:3;s:28:\"raw_request_email_intro_i18n\";i:4;s:28:\"raw_request_email_outro_i18n\";i:5;s:29:\"raw_request_email_labels_i18n\";i:6;s:30:\"raw_request_email_subject_i18n\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1787741944);

-- --------------------------------------------------------

--
-- Table structure for table `core_email_access_rules`
--

CREATE TABLE `core_email_access_rules` (
  `id` int(10) UNSIGNED NOT NULL,
  `type` enum('domain','email') NOT NULL,
  `value` varchar(255) NOT NULL COMMENT 'Domena (bez @) nebo cely email - vzdy ulozeno lowercase/trim',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `core_email_access_rules`
--

INSERT INTO `core_email_access_rules` (`id`, `type`, `value`, `created_at`, `updated_at`) VALUES
(4, 'domain', 'gmail.com', '2026-08-26 11:00:28', '2026-08-26 11:00:28'),
(5, 'email', 'fonet@test.cz', '2026-08-26 11:23:45', '2026-08-26 11:23:45');

-- --------------------------------------------------------

--
-- Table structure for table `core_import_batches`
--

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

--
-- Dumping data for table `core_import_batches`
--

INSERT INTO `core_import_batches` (`id`, `resource`, `user_id`, `original_filename`, `format`, `temp_path`, `status`, `total_rows`, `valid_rows`, `invalid_rows`, `imported_count`, `skipped_count`, `error_summary`, `created_at`, `updated_at`, `completed_at`) VALUES
(1, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/36b4902c-ac6e-4d38-9df8-c2854fcce025.json', 'validated', 5, 5, 0, 0, 0, '[]', '2026-08-22 23:19:42', '2026-08-22 23:19:42', NULL),
(2, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/392427b6-8ad7-4b98-ad29-39c35892cfa7.json', 'validated', 5, 5, 0, 0, 0, '[]', '2026-08-22 23:27:42', '2026-08-22 23:27:42', NULL),
(3, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/8c5d2f2d-b1c7-49d5-b395-90480fb3e227.json', 'validated', 5, 5, 0, 0, 0, '[]', '2026-08-22 23:32:06', '2026-08-22 23:32:06', NULL),
(4, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/7e5e69b6-b88f-4908-bbc1-b4bc5520b18c.json', 'completed', 5, 5, 0, 5, 0, '[]', '2026-08-22 23:36:00', '2026-08-22 23:36:04', '2026-08-22 23:36:04'),
(5, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/1d86aca1-0ee8-40fc-ad5b-51d45be16554.json', 'completed', 5, 5, 0, 5, 0, '[]', '2026-08-22 23:41:27', '2026-08-22 23:41:29', '2026-08-22 23:41:29'),
(6, 'web/raw_request_commissions', 25, 'import-validni.csv', 'csv', 'imports/4ba158ac-e553-4a1d-9d8b-6604541943ba.csv', 'validated', 5, 5, 0, 0, 0, '[]', '2026-08-22 23:41:59', '2026-08-22 23:41:59', NULL),
(7, 'web/raw_request_commissions', 25, 'import-validni-60.csv', 'csv', 'imports/038bf1cb-4d5a-4be1-bac6-702f39df73be.csv', 'validated', 60, 0, 60, 0, 0, '[{\"row\":2,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":3,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":4,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":5,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":6,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":7,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":8,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":9,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":10,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":11,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":12,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":13,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":14,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":15,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":16,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":17,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":18,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":19,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":20,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":21,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":22,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":23,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":24,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":25,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":26,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":27,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":28,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":29,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":30,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":31,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":32,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":33,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":34,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":35,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":36,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":37,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":38,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":39,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":40,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":41,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":42,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":43,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":44,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":45,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":46,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":47,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":48,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":49,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":50,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":51,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":52,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":53,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":54,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":55,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":56,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":57,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":58,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":59,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":60,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":61,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}}]', '2026-08-22 23:50:20', '2026-08-22 23:50:20', NULL),
(8, 'web/raw_request_commissions', 25, 'import-validni-60.json', 'json', 'imports/2e613900-c57a-40d9-96ab-ae57a693e06b.json', 'validated', 60, 0, 60, 0, 0, '[{\"row\":2,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":3,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":4,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":5,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":6,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":7,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":8,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":9,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":10,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":11,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":12,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":13,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":14,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":15,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":16,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":17,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":18,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":19,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":20,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":21,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":22,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":23,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":24,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":25,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":26,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":27,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":28,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":29,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":30,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":31,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":32,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":33,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":34,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":35,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":36,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":37,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":38,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":39,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":40,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":41,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":42,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":43,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":44,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":45,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":46,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":47,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":48,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":49,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":50,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":51,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":52,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":53,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":54,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":55,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":56,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":57,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":58,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":59,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":60,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":61,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}}]', '2026-08-22 23:53:51', '2026-08-22 23:53:51', NULL),
(9, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/77c00620-db81-4363-96e3-e3aa9cb0321d.json', 'validated', 5, 5, 0, 0, 0, '[]', '2026-08-22 23:54:14', '2026-08-22 23:54:14', NULL),
(10, 'web/raw_request_commissions', 25, 'import-validni-60.json', 'json', 'imports/00cc83ec-61cb-4074-bd5a-755b51b86a58.json', 'validated', 60, 0, 60, 0, 0, '[{\"row\":2,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":3,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":4,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":5,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":6,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":7,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":8,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":9,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":10,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":11,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":12,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":13,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":14,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":15,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":16,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":17,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":18,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":19,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":20,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":21,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":22,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":23,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":24,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":25,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":26,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":27,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":28,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":29,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":30,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":31,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":32,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":33,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":34,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":35,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":36,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":37,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":38,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":39,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":40,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":41,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":42,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":43,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":44,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":45,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":46,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":47,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":48,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":49,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":50,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":51,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":52,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":53,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":54,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":55,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":56,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":57,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":58,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":59,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":60,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}},{\"row\":61,\"errors\":{\"thema\":[\"The thema field format is invalid.\"]}}]', '2026-08-22 23:54:22', '2026-08-22 23:54:22', NULL),
(11, 'web/raw_request_commissions', 25, 'import-validni-60.csv', 'csv', 'imports/ad307694-07e7-451c-8c4f-27a0fdcf0312.csv', 'completed', 60, 60, 0, 60, 0, '[]', '2026-08-22 23:58:00', '2026-08-22 23:58:02', '2026-08-22 23:58:02'),
(12, 'web/raw_request_commissions', 25, 'import-validni-60.json', 'json', 'imports/7568e504-550e-4253-a63e-54e9bc4eb1f0.json', 'completed', 60, 60, 0, 60, 0, '[]', '2026-08-22 23:58:19', '2026-08-22 23:58:21', '2026-08-22 23:58:21'),
(13, 'web/raw_request_commissions', 25, 'import-validni.csv', 'csv', 'imports/bf41459e-9537-400b-a8e1-fccae950d2c9.csv', 'completed', 5, 5, 0, 5, 0, '[]', '2026-08-22 23:58:31', '2026-08-22 23:58:33', '2026-08-22 23:58:33'),
(14, 'web/raw_request_commissions', 25, 'import-nevalidni.json', 'json', 'imports/515bd16d-f2bd-48d8-b8dd-81a1dff5a0f6.json', 'validated', 5, 0, 5, 0, 0, '[{\"row\":2,\"errors\":{\"thema\":[\"The thema field must be at least 3 characters.\"]}},{\"row\":3,\"errors\":{\"contact_email\":[\"The contact email field must be a valid email address.\"]}},{\"row\":4,\"errors\":{\"order_description\":[\"The order description field is required.\"]}},{\"row\":5,\"errors\":{\"status\":[\"The selected status is invalid.\"]}},{\"row\":6,\"errors\":{\"thema\":[\"The thema field format is invalid.\"],\"contact_phone\":[\"The contact phone field format is invalid.\"],\"priority\":[\"The selected priority is invalid.\"]}}]', '2026-08-23 00:24:29', '2026-08-23 00:24:29', NULL),
(15, 'web/raw_request_commissions', 25, 'import-validni.json', 'json', 'imports/8dc5a5a9-18da-4839-a977-c8f9b539021c.json', 'completed', 5, 5, 0, 5, 0, '[]', '2026-08-23 10:50:40', '2026-08-23 10:50:42', '2026-08-23 10:50:42'),
(16, 'web/raw_request_commissions', 25, 'Seznam aktivních požadavků-raw.txt', 'txt', 'imports/0b6ae2ac-c9c1-4dfe-85df-4c48b867ca43.txt', 'completed', 9, 9, 0, 9, 0, '[]', '2026-08-23 12:55:03', '2026-08-23 12:55:05', '2026-08-23 12:55:05'),
(17, 'web/raw_request_commissions', 25, 'Seznam aktivních požadavků-raw.json', 'json', 'imports/5ff801c8-844b-4535-9bc0-cfcfdf328eed.json', 'completed', 9, 9, 0, 9, 0, '[]', '2026-08-23 13:00:33', '2026-08-23 13:00:35', '2026-08-23 13:00:35'),
(18, 'web/raw_request_commissions', 25, 'Seznam aktivních požadavků-vybrane-raw.csv', 'csv', 'imports/0a68d7cc-69b7-47c1-b60e-78ee1763db48.csv', 'completed', 1, 1, 0, 1, 0, '[]', '2026-08-23 13:12:40', '2026-08-23 13:12:43', '2026-08-23 13:12:43'),
(19, 'web/raw_request_commissions', 25, 'Seznam aktivních požadavků-vybrane-raw.txt', 'txt', 'imports/834b6177-0a55-4fa9-bcbe-e44e8cc4b5b2.txt', 'completed', 1, 1, 0, 1, 0, '[]', '2026-08-23 13:20:35', '2026-08-23 13:20:37', '2026-08-23 13:20:37'),
(20, 'web/raw_request_commissions', 25, 'Seznam aktivních požadavků-vybrane-raw.json', 'json', 'imports/d32bcdd0-e395-4076-b580-50b93cc1e8aa.json', 'completed', 2, 2, 0, 2, 0, '[]', '2026-08-23 13:20:57', '2026-08-23 13:20:58', '2026-08-23 13:20:58'),
(21, 'web/raw_request_commissions', 25, 'Seznam aktivních požadavků-vybrane-raw.json', 'json', 'imports/4fb87b0a-5d76-418a-84d1-b1fa5599ee7b.json', 'completed', 2, 1, 1, 1, 1, '[{\"row\":2,\"errors\":{\"thema\":[\"The thema field is required.\"],\"contact_email\":[\"The contact email field must be a valid email address.\"]}}]', '2026-08-23 13:21:39', '2026-08-23 13:21:48', '2026-08-23 13:21:48'),
(22, 'web/support_tickets', 25, 'Seznam Support Ticketů-raw.csv', 'csv', 'imports/66ddddf3-849e-477c-b499-b5099f36275e.csv', 'completed', 2, 2, 0, 2, 0, '[]', '2026-08-23 15:57:02', '2026-08-23 15:57:03', '2026-08-23 15:57:03'),
(23, 'web/support_tickets', 25, 'Seznam Support Ticketů-vybrane-raw.csv', 'csv', 'imports/9f223ab9-2af2-4cbe-8ac6-7235979fa76d.csv', 'completed', 3, 3, 0, 3, 0, '[]', '2026-08-23 19:53:04', '2026-08-23 19:53:05', '2026-08-23 19:53:05'),
(24, 'web/sales_leads', 25, 'Seznam obchodních příležitostí-raw.csv', 'csv', 'imports/b191c623-9bd9-4e8f-a95a-d2940f69ffd9.csv', 'completed', 1, 1, 0, 1, 0, '[]', '2026-08-23 20:03:35', '2026-08-23 20:03:37', '2026-08-23 20:03:37'),
(25, 'shop/suppliers', 25, 'Seznam aktivních dodavatelů-vybrane-raw.csv', 'csv', 'imports/68cc6c16-5d39-4eca-8e03-bf190400c6c5.csv', 'validated', 2, 0, 2, 0, 0, '[{\"row\":2,\"errors\":{\"is_active\":[\"The is active field must be true or false.\"]}},{\"row\":3,\"errors\":{\"is_active\":[\"The is active field must be true or false.\"]}}]', '2026-08-23 20:45:23', '2026-08-23 20:45:23', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `core_logs`
--

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

--
-- Dumping data for table `core_logs`
--

INSERT INTO `core_logs` (`id`, `created_at`, `origin`, `event_type`, `module`, `description`, `affected_entity_type`, `affected_entity_id`, `user_id`, `context_data`, `user_id_plain`, `user_plain`) VALUES
(1, '2026-08-22 15:01:15', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(2, '2026-08-22 15:01:23', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(3, '2026-08-22 15:01:33', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"BCNsvuBXl5f07Avbqg1tK22RriqA2mX6duE1Vfx3Ig6JvxpZNgdI3zNXZWUkNnef\",\"code\":\"852729\"}', '0', 'system'),
(4, '2026-08-22 15:04:26', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(5, '2026-08-22 15:04:33', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(6, '2026-08-22 15:04:42', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"x9mNpaSbkzUynwzeS9DCNv5L5quWrLHhhDoafhGv5QjZUFLAN3hPEOmqwksgZo0m\",\"code\":\"460818\"}', '0', 'system'),
(7, '2026-08-22 15:08:25', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(8, '2026-08-22 15:08:34', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(9, '2026-08-22 15:08:41', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"9bE8hhQa7Jh9UIqZUO2bV5ulkH1Stpe0InFXl2RhWezKqxyadiFefSxfWmRuE8ZM\",\"code\":\"283934\"}', '0', 'system'),
(10, '2026-08-22 16:07:09', '127.0.0.1', 'security_retention_updated', 'Core', 'Retenční doba bezpečnostního monitoringu změněna z 90 na 14 dní.', 'CoreSecuritySetting', 1, 25, '{\"retention_days\":\"14\"}', '25', 'jonasbucina@rpsw.cz'),
(11, '2026-08-22 16:07:11', '127.0.0.1', 'security_events_purged', 'Core', 'Ruční vyčištění bezpečnostního monitoringu: smazáno 0 záznamů starších než 14 dní.', 'CoreSecurityEvent', NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(12, '2026-08-22 16:13:13', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(13, '2026-08-22 16:13:13', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(14, '2026-08-22 16:13:13', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(15, '2026-08-22 16:13:13', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(16, '2026-08-22 16:13:13', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(17, '2026-08-22 16:13:14', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(18, '2026-08-22 16:13:14', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(19, '2026-08-22 16:13:14', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(20, '2026-08-22 16:13:14', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(21, '2026-08-22 16:13:14', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(22, '2026-08-22 16:18:18', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #98 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 98, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(23, '2026-08-22 16:18:18', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #88 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 88, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(24, '2026-08-22 16:18:18', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #71 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 71, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(25, '2026-08-22 16:18:18', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #70 (login_brute_force_suspected, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 70, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(26, '2026-08-22 16:18:18', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #67 (login_failed, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 67, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(27, '2026-08-22 16:18:24', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(28, '2026-08-22 16:18:24', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(29, '2026-08-22 16:18:24', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(30, '2026-08-22 16:18:24', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(31, '2026-08-22 16:18:24', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(32, '2026-08-22 16:18:25', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(33, '2026-08-22 16:18:25', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(34, '2026-08-22 16:18:25', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(35, '2026-08-22 16:18:25', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(36, '2026-08-22 16:18:25', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(37, '2026-08-22 16:21:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #120 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 120, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(38, '2026-08-22 16:21:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #130 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 130, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(39, '2026-08-22 16:21:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #103 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 103, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(40, '2026-08-22 16:23:42', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(41, '2026-08-22 16:23:43', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(42, '2026-08-22 16:23:43', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(43, '2026-08-22 16:23:43', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(44, '2026-08-22 16:23:43', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(45, '2026-08-22 16:23:44', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(46, '2026-08-22 16:23:44', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(47, '2026-08-22 16:23:44', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(48, '2026-08-22 16:23:44', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(49, '2026-08-22 16:23:44', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(50, '2026-08-22 17:22:29', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #166 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 166, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(51, '2026-08-22 17:22:29', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #156 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 156, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(52, '2026-08-22 17:22:29', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #139 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 139, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(53, '2026-08-22 17:22:29', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #138 (login_brute_force_suspected, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 138, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(54, '2026-08-22 17:22:29', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #135 (login_failed, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 135, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(55, '2026-08-22 17:23:17', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(56, '2026-08-22 17:23:18', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(57, '2026-08-22 17:23:18', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(58, '2026-08-22 17:23:18', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(59, '2026-08-22 17:23:18', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(60, '2026-08-22 17:23:19', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(61, '2026-08-22 17:23:19', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(62, '2026-08-22 17:23:19', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(63, '2026-08-22 17:23:19', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(64, '2026-08-22 17:23:19', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(65, '2026-08-22 17:31:06', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #202 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 202, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(66, '2026-08-22 17:31:06', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #192 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 192, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(67, '2026-08-22 17:31:06', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #175 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 175, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(68, '2026-08-22 17:31:06', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #174 (login_brute_force_suspected, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 174, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(69, '2026-08-22 17:31:07', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #171 (login_failed, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 171, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(70, '2026-08-22 17:31:46', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(71, '2026-08-22 17:31:46', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(72, '2026-08-22 17:31:47', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(73, '2026-08-22 17:31:47', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(74, '2026-08-22 17:31:47', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(75, '2026-08-22 17:31:47', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(76, '2026-08-22 17:31:48', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(77, '2026-08-22 17:31:48', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(78, '2026-08-22 17:31:48', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(79, '2026-08-22 17:31:48', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(80, '2026-08-22 17:43:06', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #238 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 238, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(81, '2026-08-22 17:43:06', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #228 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 228, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(82, '2026-08-22 17:43:07', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #211 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 211, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(83, '2026-08-22 17:43:07', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #210 (login_brute_force_suspected, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 210, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(84, '2026-08-22 17:43:07', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #207 (login_failed, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 207, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(85, '2026-08-22 17:43:12', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(86, '2026-08-22 17:43:12', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(87, '2026-08-22 17:43:12', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(88, '2026-08-22 17:43:12', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(89, '2026-08-22 17:43:12', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(90, '2026-08-22 17:43:13', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(91, '2026-08-22 17:43:13', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(92, '2026-08-22 17:43:13', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(93, '2026-08-22 17:43:13', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(94, '2026-08-22 17:43:13', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(95, '2026-08-22 17:46:39', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #270 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 270, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(96, '2026-08-22 17:46:39', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #263 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 263, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(97, '2026-08-22 17:46:40', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #264 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 264, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(98, '2026-08-22 17:46:40', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #265 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 265, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(99, '2026-08-22 17:46:40', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #266 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 266, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(100, '2026-08-22 17:46:40', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #267 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 267, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(101, '2026-08-22 17:46:40', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #268 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 268, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(102, '2026-08-22 17:46:41', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #269 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 269, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(103, '2026-08-22 17:46:41', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #260 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 260, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(104, '2026-08-22 17:46:41', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #261 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 261, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(105, '2026-08-22 17:46:41', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #262 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 262, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(106, '2026-08-22 17:46:42', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #251 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 251, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(107, '2026-08-22 17:46:42', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #248 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 248, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(108, '2026-08-22 17:46:42', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #243 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 243, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(109, '2026-08-22 17:46:53', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(110, '2026-08-22 17:46:54', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(111, '2026-08-22 17:46:54', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(112, '2026-08-22 17:46:54', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(113, '2026-08-22 17:46:54', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(114, '2026-08-22 17:46:55', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(115, '2026-08-22 17:46:55', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(116, '2026-08-22 17:46:55', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(117, '2026-08-22 17:46:55', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(118, '2026-08-22 17:46:56', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(119, '2026-08-22 21:01:30', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(120, '2026-08-22 21:01:37', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(121, '2026-08-22 21:01:47', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"j7lFsvnu1X2T3p9GniKOXPUhHoStwKtgpUQenGIs4iOh06GlmNOPhP6PswAMrkjc\",\"code\":\"495198\"}', '0', 'system'),
(122, '2026-08-22 23:05:30', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(123, '2026-08-22 23:05:39', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"PGj6CeLgXVwmOJliVbXhSJJN8LNmeaW9UvhQXITlyYB8lTmjLJNrbobVTzK1fVHM\",\"code\":\"947757\"}', '0', 'system'),
(124, '2026-08-22 23:49:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #311 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 311, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(125, '2026-08-22 23:49:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #306 (refresh_token_invalid, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 306, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(126, '2026-08-22 23:49:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #296 (scan_probe, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 296, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(127, '2026-08-22 23:49:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #287 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 287, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(128, '2026-08-22 23:49:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #284 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 284, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(129, '2026-08-22 23:49:23', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #279 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 279, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(130, '2026-08-22 23:49:24', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #278 (login_brute_force_suspected, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 278, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(131, '2026-08-22 23:49:24', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #275 (login_failed, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 275, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(132, '2026-08-23 00:23:51', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #319 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 319, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(133, '2026-08-23 00:23:51', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #318 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 318, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(134, '2026-08-23 00:23:51', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #317 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 317, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(135, '2026-08-23 00:23:52', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #316 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 316, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(136, '2026-08-23 00:23:52', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #315 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 315, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(137, '2026-08-23 00:23:52', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #314 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 314, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(138, '2026-08-23 00:23:52', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #313 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 313, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(139, '2026-08-23 00:23:52', '127.0.0.1', 'security_event_deleted', 'Core', 'Bezpečnostní event #312 (throttle_exceeded, IP: 127.0.0.1) byl ručně smazán.', 'CoreSecurityEvent', 312, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(140, '2026-08-23 00:23:58', '127.0.0.1', 'security_retention_updated', 'Core', 'Retenční doba bezpečnostního monitoringu změněna z 14 na 60 dní.', 'CoreSecuritySetting', 1, 25, '{\"retention_days\":\"60\"}', '25', 'jonasbucina@rpsw.cz'),
(141, '2026-08-23 15:28:16', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(142, '2026-08-23 15:28:29', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"cUC3KcCM0mQzonfomscAeOPuBl7Ce6iHAYxZ0s2zlaudXxKagr00PQJe3mk5qdDP\",\"code\":\"134768\"}', '0', 'system'),
(143, '2026-08-23 19:52:01', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(144, '2026-08-23 19:52:09', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"kjphejYjfphLyslVCJyfVVYUy0GnyeW9dwbFg3TLhkClnWxiihdUwZE1JoRwYX4t\",\"code\":\"763941\"}', '0', 'system'),
(145, '2026-08-24 09:19:31', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(146, '2026-08-24 09:19:42', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"email\":\"jonasbucina@rpsw.cz\"}', '0', 'system'),
(147, '2026-08-24 11:24:14', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(148, '2026-08-24 11:24:22', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"PMbCOTr2E3jsATVsta9IoUxs7CablDwjT0XAaKCKfBabdYKOyu148Cfu2h9hoSdM\",\"code\":\"533220\"}', '0', 'system'),
(149, '2026-08-24 11:25:29', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel (čeká na aktivaci): joner@rpsw.cz', 'User', 94, 25, '{\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"Joner Foner\",\"role_id\":2,\"internal_note\":\"noper\",\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(150, '2026-08-24 11:43:13', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel (čeká na aktivaci): test@test.cz [AKTIVAČNÍ E-MAIL SE NEPODAŘILO ODESLAT]', 'User', 95, 25, '{\"user_email\":\"test@test.cz\",\"full_name\":\"test\",\"role_id\":2,\"internal_note\":null,\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(151, '2026-08-24 11:49:54', '127.0.0.1', 'resend_activation_failed', 'User', 'Opětovné odeslání aktivačního e-mailu selhalo: test@test.cz', 'User', 95, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(152, '2026-08-24 11:54:37', '127.0.0.1', 'resend_activation_failed', 'User', 'Opětovné odeslání aktivačního e-mailu selhalo: test@test.cz', 'User', 95, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(153, '2026-08-24 11:57:30', '127.0.0.1', 'resend_activation', 'User', 'Aktivační e-mail odeslán znovu: test@test.cz', 'User', 95, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(154, '2026-08-24 12:15:57', '127.0.0.1', 'soft_delete', 'User', 'Smazáno ID: 95', 'User', 95, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(155, '2026-08-24 12:16:23', '127.0.0.1', 'hard_delete', 'User', 'Smazáno ID: 95', 'User', 95, 25, '{\"force_delete\":\"true\"}', '25', 'jonasbucina@rpsw.cz'),
(156, '2026-08-24 12:16:39', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel (čeká na aktivaci): joner@rpsw.cz', 'User', 96, 25, '{\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"JOnerTEST\",\"role_id\":2,\"internal_note\":null,\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(157, '2026-08-24 13:35:19', '127.0.0.1', 'account_activated', 'User', 'Účet aktivován: joner@rpsw.cz', 'User', 96, NULL, '[]', '0', 'system'),
(158, '2026-08-24 13:35:36', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: joner@test.cz', 'User', NULL, NULL, '{\"email\":\"joner@test.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '0', 'system'),
(159, '2026-08-24 13:38:19', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: joner@test.cz', 'User', NULL, NULL, '{\"email\":\"joner@test.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '0', 'system'),
(160, '2026-08-24 13:38:24', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: joner@rpsw.cz', 'User', 96, 96, '{\"email\":\"joner@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '96', 'joner@rpsw.cz'),
(161, '2026-08-24 13:38:37', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: joner@rpsw.cz', 'User', 96, NULL, '{\"login_token\":\"KKJINvhO68pTAjVTWMbty5Ah66PjcbIxMLRE6ZhIbYNy185XQnW2GFb85fi4GoPj\",\"code\":\"252360\"}', '0', 'system'),
(162, '2026-08-24 13:38:54', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: joner@rpsw.cz', 'User', 96, 96, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '96', 'joner@rpsw.cz'),
(163, '2026-08-24 13:39:30', '127.0.0.1', 'create', 'CoreRole', 'Created role: test', 'CoreRole', 14, 25, '{\"role_name\":\"test\",\"description\":null,\"is_protected\":false,\"forces_2fa\":false,\"users_count\":0,\"permissions\":[]}', '25', 'jonasbucina@rpsw.cz'),
(164, '2026-08-24 13:39:40', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: joner@rpsw.cz', 'User', 96, 25, '{\"id\":96,\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"JOnerTEST\",\"two_fa_forced_by_admin\":false,\"activated_at\":\"2026-08-24 13:35:19\",\"internal_note\":null,\"last_login_at\":\"2026-08-24 13:38:37\",\"created_at\":\"2026-08-24 12:16:39\",\"updated_at\":\"2026-08-24 13:38:37\",\"deleted_at\":null,\"role_id\":14,\"roles\":[{\"id\":2,\"role_name\":\"admin\",\"description\":\"Administr\\u00e1tor - spr\\u00e1va webu\",\"is_protected\":true,\"forces_2fa\":false,\"users_count\":2,\"permissions\":[\"web-view-personal-info\",\"web-view-dashboard\",\"view-deleted\",\"shop-manage-products\",\"shop-manage-categories\",\"shop-view-orders\",\"shop-manage-customers\",\"view-web\",\"view-eshop\",\"shop-view-dashboard\",\"shop-view-logs\",\"core-view-welcome-page\",\"web-support-tickets-view\",\"web-support-tickets-create\",\"web-support-tickets-update\",\"web-support-tickets-delete\",\"web-sales-leads-view\",\"web-sales-leads-create\",\"web-sales-leads-update\",\"web-sales-leads-delete\",\"web-news-view\",\"web-news-create\",\"web-news-update\",\"web-news-delete\",\"web-sales-orders-view\",\"web-sales-orders-create\",\"web-sales-orders-update\",\"web-sales-orders-delete\",\"web-job-applications-view\",\"web-job-applications-create\",\"web-job-applications-update\",\"web-job-applications-delete\",\"web-user-requests-view\",\"web-user-requests-create\",\"web-user-requests-update\",\"web-user-requests-delete\"],\"created_at\":\"2026-02-14 09:12:31\",\"updated_at\":\"2026-02-14 09:12:31\"}],\"user_permissions\":[\"web-view-personal-info\",\"web-view-dashboard\",\"view-deleted\",\"shop-manage-products\",\"shop-manage-categories\",\"shop-view-orders\",\"shop-manage-customers\",\"view-web\",\"view-eshop\",\"shop-view-dashboard\",\"shop-view-logs\",\"core-view-welcome-page\",\"web-support-tickets-view\",\"web-support-tickets-create\",\"web-support-tickets-update\",\"web-support-tickets-delete\",\"web-sales-leads-view\",\"web-sales-leads-create\",\"web-sales-leads-update\",\"web-sales-leads-delete\",\"web-news-view\",\"web-news-create\",\"web-news-update\",\"web-news-delete\",\"web-sales-orders-view\",\"web-sales-orders-create\",\"web-sales-orders-update\",\"web-sales-orders-delete\",\"web-job-applications-view\",\"web-job-applications-create\",\"web-job-applications-update\",\"web-job-applications-delete\",\"web-user-requests-view\",\"web-user-requests-create\",\"web-user-requests-update\",\"web-user-requests-delete\"],\"permissions\":[\"web-view-personal-info\",\"web-view-dashboard\",\"view-deleted\",\"shop-manage-products\",\"shop-manage-categories\",\"shop-view-orders\",\"shop-manage-customers\",\"view-web\",\"view-eshop\",\"shop-view-dashboard\",\"shop-view-logs\",\"core-view-welcome-page\",\"web-support-tickets-view\",\"web-support-tickets-create\",\"web-support-tickets-update\",\"web-support-tickets-delete\",\"web-sales-leads-view\",\"web-sales-leads-create\",\"web-sales-leads-update\",\"web-sales-leads-delete\",\"web-news-view\",\"web-news-create\",\"web-news-update\",\"web-news-delete\",\"web-sales-orders-view\",\"web-sales-orders-create\",\"web-sales-orders-update\",\"web-sales-orders-delete\",\"web-job-applications-view\",\"web-job-applications-create\",\"web-job-applications-update\",\"web-job-applications-delete\",\"web-user-requests-view\",\"web-user-requests-create\",\"web-user-requests-update\",\"web-user-requests-delete\"]}', '25', 'jonasbucina@rpsw.cz'),
(165, '2026-08-24 13:39:40', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: joner@rpsw.cz', 'User', 96, 25, '{\"id\":96,\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"JOnerTEST\",\"two_fa_forced_by_admin\":false,\"activated_at\":\"2026-08-24 13:35:19\",\"internal_note\":null,\"last_login_at\":\"2026-08-24 13:38:37\",\"created_at\":\"2026-08-24 12:16:39\",\"updated_at\":\"2026-08-24 13:38:37\",\"deleted_at\":null,\"role_id\":14,\"roles\":[{\"id\":2,\"role_name\":\"admin\",\"description\":\"Administr\\u00e1tor - spr\\u00e1va webu\",\"is_protected\":true,\"forces_2fa\":false,\"users_count\":2,\"permissions\":[\"web-view-personal-info\",\"web-view-dashboard\",\"view-deleted\",\"shop-manage-products\",\"shop-manage-categories\",\"shop-view-orders\",\"shop-manage-customers\",\"view-web\",\"view-eshop\",\"shop-view-dashboard\",\"shop-view-logs\",\"core-view-welcome-page\",\"web-support-tickets-view\",\"web-support-tickets-create\",\"web-support-tickets-update\",\"web-support-tickets-delete\",\"web-sales-leads-view\",\"web-sales-leads-create\",\"web-sales-leads-update\",\"web-sales-leads-delete\",\"web-news-view\",\"web-news-create\",\"web-news-update\",\"web-news-delete\",\"web-sales-orders-view\",\"web-sales-orders-create\",\"web-sales-orders-update\",\"web-sales-orders-delete\",\"web-job-applications-view\",\"web-job-applications-create\",\"web-job-applications-update\",\"web-job-applications-delete\",\"web-user-requests-view\",\"web-user-requests-create\",\"web-user-requests-update\",\"web-user-requests-delete\"],\"created_at\":\"2026-02-14 09:12:31\",\"updated_at\":\"2026-02-14 09:12:31\"}],\"user_permissions\":[\"web-view-personal-info\",\"web-view-dashboard\",\"view-deleted\",\"shop-manage-products\",\"shop-manage-categories\",\"shop-view-orders\",\"shop-manage-customers\",\"view-web\",\"view-eshop\",\"shop-view-dashboard\",\"shop-view-logs\",\"core-view-welcome-page\",\"web-support-tickets-view\",\"web-support-tickets-create\",\"web-support-tickets-update\",\"web-support-tickets-delete\",\"web-sales-leads-view\",\"web-sales-leads-create\",\"web-sales-leads-update\",\"web-sales-leads-delete\",\"web-news-view\",\"web-news-create\",\"web-news-update\",\"web-news-delete\",\"web-sales-orders-view\",\"web-sales-orders-create\",\"web-sales-orders-update\",\"web-sales-orders-delete\",\"web-job-applications-view\",\"web-job-applications-create\",\"web-job-applications-update\",\"web-job-applications-delete\",\"web-user-requests-view\",\"web-user-requests-create\",\"web-user-requests-update\",\"web-user-requests-delete\"],\"permissions\":[\"web-view-personal-info\",\"web-view-dashboard\",\"view-deleted\",\"shop-manage-products\",\"shop-manage-categories\",\"shop-view-orders\",\"shop-manage-customers\",\"view-web\",\"view-eshop\",\"shop-view-dashboard\",\"shop-view-logs\",\"core-view-welcome-page\",\"web-support-tickets-view\",\"web-support-tickets-create\",\"web-support-tickets-update\",\"web-support-tickets-delete\",\"web-sales-leads-view\",\"web-sales-leads-create\",\"web-sales-leads-update\",\"web-sales-leads-delete\",\"web-news-view\",\"web-news-create\",\"web-news-update\",\"web-news-delete\",\"web-sales-orders-view\",\"web-sales-orders-create\",\"web-sales-orders-update\",\"web-sales-orders-delete\",\"web-job-applications-view\",\"web-job-applications-create\",\"web-job-applications-update\",\"web-job-applications-delete\",\"web-user-requests-view\",\"web-user-requests-create\",\"web-user-requests-update\",\"web-user-requests-delete\"]}', '25', 'jonasbucina@rpsw.cz'),
(166, '2026-08-24 13:41:08', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: joner@rpsw.cz', 'User', 96, 96, '{\"email\":\"joner@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '96', 'joner@rpsw.cz'),
(167, '2026-08-24 13:41:37', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: joner@rpsw.cz', 'User', 96, NULL, '{\"login_token\":\"nBxScm50C7Bnv5cX4QRWhBxN3JCwHq9XUSioWZ5NDZystruSOEXyOjFBgY52Lpkn\",\"code\":\"995414\"}', '0', 'system'),
(168, '2026-08-24 13:41:55', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: joner@rpsw.cz', 'User', 96, 25, '{\"id\":96,\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"JOnerTEST\",\"enable_2fa\":false,\"two_fa_forced_by_admin\":false,\"is_blocked\":false,\"activated_at\":\"2026-08-24 13:35:19\",\"internal_note\":null,\"last_login_at\":\"2026-08-24 13:38:37\",\"created_at\":\"2026-08-24 12:16:39\",\"updated_at\":\"2026-08-24 13:38:37\",\"deleted_at\":null,\"role_id\":14,\"roles\":[{\"id\":14,\"role_name\":\"test\",\"description\":null,\"is_protected\":false,\"forces_2fa\":false,\"users_count\":1,\"permissions\":[],\"created_at\":\"2026-08-24 13:39:30\",\"updated_at\":\"2026-08-24 13:39:30\"}],\"user_permissions\":[],\"permissions\":[]}', '25', 'jonasbucina@rpsw.cz'),
(169, '2026-08-24 13:42:06', '127.0.0.1', 'account_blocked', 'User', 'Účet zablokován, aktivní tokeny zneplatněny: joner@rpsw.cz', 'User', 96, 25, '{\"id\":96,\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"JOnerTEST\",\"enable_2fa\":false,\"two_fa_forced_by_admin\":false,\"is_blocked\":true,\"activated_at\":\"2026-08-24 13:35:19\",\"internal_note\":null,\"last_login_at\":\"2026-08-24 13:41:37\",\"created_at\":\"2026-08-24 12:16:39\",\"updated_at\":\"2026-08-24 13:41:55\",\"deleted_at\":null,\"role_id\":14,\"roles\":[{\"id\":14,\"role_name\":\"test\",\"description\":null,\"is_protected\":false,\"forces_2fa\":false,\"users_count\":1,\"permissions\":[],\"created_at\":\"2026-08-24 13:39:30\",\"updated_at\":\"2026-08-24 13:39:30\"}],\"user_permissions\":[],\"permissions\":[]}', '25', 'jonasbucina@rpsw.cz'),
(170, '2026-08-24 13:42:06', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: joner@rpsw.cz', 'User', 96, 25, '{\"id\":96,\"user_email\":\"joner@rpsw.cz\",\"full_name\":\"JOnerTEST\",\"enable_2fa\":false,\"two_fa_forced_by_admin\":false,\"is_blocked\":true,\"activated_at\":\"2026-08-24 13:35:19\",\"internal_note\":null,\"last_login_at\":\"2026-08-24 13:41:37\",\"created_at\":\"2026-08-24 12:16:39\",\"updated_at\":\"2026-08-24 13:41:55\",\"deleted_at\":null,\"role_id\":14,\"roles\":[{\"id\":14,\"role_name\":\"test\",\"description\":null,\"is_protected\":false,\"forces_2fa\":false,\"users_count\":1,\"permissions\":[],\"created_at\":\"2026-08-24 13:39:30\",\"updated_at\":\"2026-08-24 13:39:30\"}],\"user_permissions\":[],\"permissions\":[]}', '25', 'jonasbucina@rpsw.cz'),
(171, '2026-08-24 13:42:32', '127.0.0.1', 'login_blocked', 'Auth', 'Pokus o přihlášení na zablokovaný účet: joner@rpsw.cz', 'User', 96, NULL, '{\"email\":\"joner@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '0', 'system');
INSERT INTO `core_logs` (`id`, `created_at`, `origin`, `event_type`, `module`, `description`, `affected_entity_type`, `affected_entity_id`, `user_id`, `context_data`, `user_id_plain`, `user_plain`) VALUES
(172, '2026-08-24 13:47:23', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel (čeká na aktivaci): test@test.cz', 'User', 97, 25, '{\"user_email\":\"test@test.cz\",\"full_name\":\"sdksdlfj\",\"role_id\":14,\"enable_2fa\":false,\"internal_note\":null,\"dpp_hours_spent\":0}', '25', 'jonasbucina@rpsw.cz'),
(173, '2026-08-24 13:47:42', '127.0.0.1', 'account_activated', 'User', 'Účet aktivován: test@test.cz', 'User', 97, NULL, '[]', '0', 'system'),
(174, '2026-08-24 13:47:53', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: test@test.cz', 'User', 97, 97, '{\"email\":\"test@test.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '97', 'test@test.cz'),
(175, '2026-08-24 13:48:49', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: test@test.cz', 'User', 97, 97, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '97', 'test@test.cz'),
(176, '2026-08-25 17:19:02', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(177, '2026-08-25 17:19:03', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(178, '2026-08-25 17:19:03', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(179, '2026-08-25 17:19:03', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(180, '2026-08-25 17:19:04', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(181, '2026-08-25 17:19:04', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(182, '2026-08-25 17:19:04', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(183, '2026-08-25 17:19:04', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(184, '2026-08-25 17:19:05', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(185, '2026-08-25 17:19:05', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(186, '2026-08-25 23:02:33', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(187, '2026-08-25 23:02:33', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(188, '2026-08-25 23:02:34', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(189, '2026-08-25 23:02:34', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(190, '2026-08-25 23:02:34', '127.0.0.1', 'login_captcha_failed', 'Auth', 'Neplatná/chybějící captcha pro: utok-test@example.com', 'User', NULL, NULL, '{\"email\":\"utok-test@example.com\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\"}', '0', 'system'),
(191, '2026-08-25 23:02:35', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(192, '2026-08-25 23:02:35', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(193, '2026-08-25 23:02:35', '127.0.0.1', 'password_reset_requested', 'Auth', 'Vyžádán reset hesla pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(194, '2026-08-25 23:02:35', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(195, '2026-08-25 23:02:35', '127.0.0.1', 'password_reset_email_rate_limited', 'Auth', 'Limit počtu pokusů o reset hesla překročen pro e-mail: utok-test@example.com', NULL, NULL, NULL, '{\"email\":\"utok-test@example.com\"}', '0', 'system'),
(196, '2026-08-25 23:02:41', '127.0.0.1', 'password_reset_failed', 'Auth', 'Reset hesla selhal - neplatný odkaz', NULL, NULL, NULL, '[]', '0', 'system'),
(197, '2026-08-25 23:02:41', '127.0.0.1', 'password_reset_failed', 'Auth', 'Reset hesla selhal - neplatný odkaz', NULL, NULL, NULL, '[]', '0', 'system'),
(198, '2026-08-25 23:02:41', '127.0.0.1', 'password_reset_failed', 'Auth', 'Reset hesla selhal - neplatný odkaz', NULL, NULL, NULL, '[]', '0', 'system'),
(199, '2026-08-25 23:02:41', '127.0.0.1', 'password_reset_failed', 'Auth', 'Reset hesla selhal - neplatný odkaz', NULL, NULL, NULL, '[]', '0', 'system'),
(200, '2026-08-25 23:02:41', '127.0.0.1', 'password_reset_failed', 'Auth', 'Reset hesla selhal - neplatný odkaz', NULL, NULL, NULL, '[]', '0', 'system'),
(201, '2026-08-26 10:46:53', '127.0.0.1', 'email_access_primary_domain_updated', 'Core', 'Hlavní e-mailová doména změněna z (bez omezení) na rpsw.cz.', 'CoreSecuritySetting', 1, 25, '{\"primary_email_domain\":\"rpsw.cz\"}', '25', 'jonasbucina@rpsw.cz'),
(202, '2026-08-26 10:47:26', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(203, '2026-08-26 10:47:32', '127.0.0.1', 'login_2fa_challenge_sent', 'Auth', '2FA kód odeslán: jonasbucina@rpsw.cz', 'User', 25, 25, '{\"email\":\"jonasbucina@rpsw.cz\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\"}', '25', 'jonasbucina@rpsw.cz'),
(204, '2026-08-26 10:47:43', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, NULL, '{\"login_token\":\"bo1ynXHruxorLiUydmwQTb16QAprBfUYDRPf9lEoK9mkAjBWO4r1oTABGHdcrPYC\",\"code\":\"362347\"}', '0', 'system'),
(205, '2026-08-26 10:48:00', '127.0.0.1', 'email_access_primary_domain_updated', 'Core', 'Hlavní e-mailová doména změněna z (bez omezení) na rpsw.cz.', 'CoreSecuritySetting', 1, 25, '{\"primary_email_domain\":\"rpsw.cz\"}', '25', 'jonasbucina@rpsw.cz'),
(206, '2026-08-26 10:48:53', '127.0.0.1', 'email_access_rule_created', 'Core', 'Přidána whitelist položka (domain): foner.com', 'CoreEmailAccessRule', 1, 25, '{\"type\":\"domain\",\"value\":\"foner.com\"}', '25', 'jonasbucina@rpsw.cz'),
(207, '2026-08-26 10:49:30', '127.0.0.1', 'email_access_rule_created', 'Core', 'Přidána whitelist položka (email): exter@gmail.com', 'CoreEmailAccessRule', 2, 25, '{\"type\":\"email\",\"value\":\"exter@gmail.com\"}', '25', 'jonasbucina@rpsw.cz'),
(208, '2026-08-26 10:50:22', '127.0.0.1', 'email_access_rule_created', 'Core', 'Přidána whitelist položka (email): asd@sadf.cu', 'CoreEmailAccessRule', 3, 25, '{\"type\":\"email\",\"value\":\"asd@sadf.cu\"}', '25', 'jonasbucina@rpsw.cz'),
(209, '2026-08-26 10:51:24', '127.0.0.1', 'email_access_rule_deleted', 'Core', 'Smazána whitelist položka (email): asd@sadf.cu', 'CoreEmailAccessRule', 3, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(210, '2026-08-26 10:51:25', '127.0.0.1', 'email_access_rule_deleted', 'Core', 'Smazána whitelist položka (domain): foner.com', 'CoreEmailAccessRule', 1, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(211, '2026-08-26 11:00:09', '127.0.0.1', 'email_access_primary_domain_updated', 'Core', 'Hlavní e-mailová doména změněna z (bez omezení) na rpsw.cz.', 'CoreSecuritySetting', 1, 25, '{\"primary_email_domain\":\"rpsw.cz\"}', '25', 'jonasbucina@rpsw.cz'),
(212, '2026-08-26 11:00:17', '127.0.0.1', 'email_access_rule_deleted', 'Core', 'Smazána whitelist položka (email): exter@gmail.com', 'CoreEmailAccessRule', 2, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(213, '2026-08-26 11:00:28', '127.0.0.1', 'email_access_rule_created', 'Core', 'Přidána whitelist položka (domain): gmail.com', 'CoreEmailAccessRule', 4, 25, '{\"type\":\"domain\",\"value\":\"gmail.com\"}', '25', 'jonasbucina@rpsw.cz'),
(214, '2026-08-26 11:22:30', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel (čeká na aktivaci): figaro@rpsw.cz', 'User', 98, 25, '{\"user_email\":\"figaro@rpsw.cz\",\"full_name\":\"figaro\",\"role_id\":1,\"internal_note\":null,\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(215, '2026-08-26 11:23:00', '127.0.0.1', 'create_denied', 'User', 'Zamítnut pokus o vytvoření účtu s nepovolenou e-mailovou doménou: test@test.cu', NULL, NULL, 25, '{\"user_email\":\"test@test.cu\",\"full_name\":\"dasdasd\",\"role_id\":1,\"internal_note\":null,\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(216, '2026-08-26 11:23:45', '127.0.0.1', 'email_access_rule_created', 'Core', 'Přidána whitelist položka (email): fonet@test.cz', 'CoreEmailAccessRule', 5, 25, '{\"type\":\"email\",\"value\":\"fonet@test.cz\"}', '25', 'jonasbucina@rpsw.cz'),
(217, '2026-08-26 11:23:53', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel (čeká na aktivaci): fonet@test.cz', 'User', 99, 25, '{\"user_email\":\"fonet@test.cz\",\"full_name\":\"fonet\",\"role_id\":1,\"internal_note\":null,\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(218, '2026-08-26 11:31:14', '127.0.0.1', 'create_denied', 'User', 'Zamítnut pokus o vytvoření účtu s nepovolenou e-mailovou doménou: test@testasdasd.cz', NULL, NULL, 25, '{\"user_email\":\"test@testasdasd.cz\",\"full_name\":\"asld\\u016falskd\",\"role_id\":1,\"internal_note\":null,\"dpp_hours_spent\":0,\"enable_2fa\":false}', '25', 'jonasbucina@rpsw.cz'),
(219, '2026-08-26 12:55:00', '127.0.0.1', 'soft_delete', 'User', 'Smazáno ID: 99', 'User', 99, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(220, '2026-08-26 12:55:03', '127.0.0.1', 'soft_delete', 'User', 'Smazáno ID: 98', 'User', 98, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(221, '2026-08-26 12:55:06', '127.0.0.1', 'soft_delete', 'User', 'Smazáno ID: 97', 'User', 97, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(222, '2026-08-26 12:55:10', '127.0.0.1', 'soft_delete', 'User', 'Smazáno ID: 96', 'User', 96, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(223, '2026-08-26 12:55:16', '127.0.0.1', 'force_delete_all', 'User', 'Vysypání koše. Smazáno: 4', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz');

-- --------------------------------------------------------

--
-- Table structure for table `core_permissions`
--

CREATE TABLE `core_permissions` (
  `id` int(10) UNSIGNED NOT NULL,
  `permission_key` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `module` varchar(50) DEFAULT 'core',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `core_permissions`
--

INSERT INTO `core_permissions` (`id`, `permission_key`, `description`, `module`, `created_at`) VALUES
(2, 'web-view-web-logs', 'Zobrazit historii logů (auditní záznam akcí) webové sekce', 'web', '2026-02-14 08:12:31'),
(3, 'web-view-personal-info', 'Zobrazit a upravit vlastní osobní údaje přihlášeného uživatele', 'web', '2026-02-14 08:12:31'),
(5, 'web-view-dashboard', '[doporučení: vždy zapnuto] Zobrazit úvodní nástěnku webové sekce (výchozí stránka po vstupu do menu Web)', 'web', '2026-02-14 08:12:31'),
(6, 'web-view-edit-website', 'Upravit texty a nastavení veřejné webové prezentace', 'web', '2026-02-14 08:12:31'),
(7, 'view-deleted', 'Zobrazit softdeleted (smazané) záznamy v koši napříč moduly', 'web', '2026-02-14 08:12:31'),
(13, 'shop-manage-products', 'Správa produktů e-shopu (vytváření, úprava, mazání)', 'shop', '2026-03-22 08:12:31'),
(14, 'shop-manage-categories', 'Správa kategorií produktů e-shopu', 'shop', '2026-03-22 08:12:31'),
(15, 'shop-view-orders', 'Zobrazit objednávky e-shopu', 'shop', '2026-03-22 08:12:31'),
(16, 'shop-manage-customers', 'Správa zákazníků e-shopu', 'shop', '2026-03-22 08:12:31'),
(17, 'shop-view-reports', 'Zobrazit reporty a statistiky e-shopu', 'shop', '2026-03-22 08:12:31'),
(18, 'view-web', '[doporučení: vždy zapnuto] Zobrazit záložku Web v menu administrace - bez tohoto práva se do sekce nelze dostat', 'core', '2026-03-25 11:37:06'),
(19, 'view-eshop', '[doporučení: vždy zapnuto] Zobrazit záložku Eshop v menu administrace - bez tohoto práva se do sekce nelze dostat', 'core', '2026-03-25 11:37:06'),
(20, 'shop-view-dashboard', '[doporučení: vždy zapnuto] Zobrazit úvodní nástěnku e-shop sekce (výchozí stránka po vstupu do menu Eshop)', 'core', '2026-03-25 11:42:21'),
(21, 'shop-view-logs', 'Zobrazit historii logů (auditní záznam akcí) e-shopu', 'core', '2026-03-26 22:39:15'),
(22, 'shop-manage-shipping-methods', 'Správa metod dopravy e-shopu', 'core', '2026-03-27 14:41:13'),
(23, 'shop-manage-suppliers', 'Správa dodavatelů e-shopu', 'core', '2026-03-27 14:41:13'),
(24, 'shop-manage-payment-methods', 'Správa způsobů platby e-shopu', 'core', '2026-03-27 14:49:37'),
(26, 'shop-set-maintenance-mode', 'Přepnout e-shop do režimu údržby (nepřístupný pro zákazníky)', 'shop', '2026-06-12 13:09:55'),
(29, 'shop-view-edit-eshop', 'Upravit texty a nastavení e-shopu', 'core', '2026-06-30 10:01:32'),
(30, 'core-view-welcome-page', '[doporučení: vždy zapnuto] Zobrazit uvítací stránku, na kterou je uživatel přesměrován hned po přihlášení', 'web', '2026-07-26 20:08:46'),
(32, 'view-core', '[doporučení: vždy zapnuto] Zobrazit záložku Core / System v menu administrace - bez tohoto práva se do sekce nelze dostat', 'core', '2026-08-07 07:23:39'),
(33, 'web-set-maintenance-mode', 'Přepnout web do režimu údržby (nepřístupný pro veřejnost)', 'web', '2026-08-11 22:30:26'),
(35, 'web-support-tickets-view', 'Zobrazit tickety podpory od zákazníků', 'web', '2026-08-13 08:53:39'),
(36, 'web-support-tickets-create', 'Vytvořit ticket podpory ručně (interně administrátorem)', 'web', '2026-08-13 08:53:39'),
(37, 'web-support-tickets-update', 'Upravit / zpracovat ticket podpory', 'web', '2026-08-13 08:53:39'),
(38, 'web-support-tickets-delete', 'Smazat / obnovit ticket podpory z koše', 'web', '2026-08-13 08:53:39'),
(39, 'web-sales-leads-view', 'Zobrazit poptávkové leady (kontakty potenciálních zákazníků)', 'web', '2026-08-13 08:53:39'),
(40, 'web-sales-leads-create', 'Vytvořit poptávkový lead ručně (interně administrátorem)', 'web', '2026-08-13 08:53:39'),
(41, 'web-sales-leads-update', 'Upravit poptávkový lead', 'web', '2026-08-13 08:53:39'),
(42, 'web-sales-leads-delete', 'Smazat / obnovit poptávkový lead z koše', 'web', '2026-08-13 08:53:39'),
(43, 'web-news-view', 'Zobrazit novinky / články na webu', 'web', '2026-08-13 08:53:39'),
(44, 'web-news-create', 'Vytvořit novou novinku / článek', 'web', '2026-08-13 08:53:39'),
(45, 'web-news-update', 'Upravit existující novinku / článek', 'web', '2026-08-13 08:53:39'),
(46, 'web-news-delete', 'Smazat / obnovit novinku z koše', 'web', '2026-08-13 08:53:39'),
(47, 'web-sales-orders-view', 'Zobrazit poptávkové objednávky vzniklé z webového formuláře', 'web', '2026-08-13 08:53:39'),
(48, 'web-sales-orders-create', 'Vytvořit poptávkovou objednávku ručně (interně administrátorem)', 'web', '2026-08-13 08:53:39'),
(49, 'web-sales-orders-update', 'Upravit poptávkovou objednávku', 'web', '2026-08-13 08:53:39'),
(50, 'web-sales-orders-delete', 'Smazat / obnovit poptávkovou objednávku z koše', 'web', '2026-08-13 08:53:39'),
(51, 'web-job-applications-view', 'Zobrazit uchazeče, kteří reagovali na pracovní nabídku', 'web', '2026-08-13 08:53:39'),
(52, 'web-job-applications-create', 'Vytvořit záznam uchazeče ručně (interně administrátorem)', 'web', '2026-08-13 08:53:39'),
(53, 'web-job-applications-update', 'Upravit záznam uchazeče', 'web', '2026-08-13 08:53:39'),
(54, 'web-job-applications-delete', 'Smazat / obnovit záznam uchazeče z koše', 'web', '2026-08-13 08:53:39'),
(55, 'core-administrators-view', 'Zobrazit seznam administrátorských účtů', 'core', '2026-08-13 08:53:39'),
(56, 'core-administrators-create', 'Vytvořit nový administrátorský účet', 'core', '2026-08-13 08:53:39'),
(57, 'core-administrators-update', 'Upravit administrátorský účet', 'core', '2026-08-13 08:53:39'),
(58, 'core-administrators-delete', 'Smazat / obnovit administrátorský účet z koše', 'core', '2026-08-13 08:53:39'),
(59, 'core-external-links-view', 'Zobrazit externí odkazy zobrazené v administraci', 'core', '2026-08-13 08:53:39'),
(60, 'core-external-links-create', 'Vytvořit externí odkaz', 'core', '2026-08-13 08:53:39'),
(61, 'core-external-links-update', 'Upravit externí odkaz', 'core', '2026-08-13 08:53:39'),
(62, 'core-external-links-delete', 'Smazat / obnovit externí odkaz z koše', 'core', '2026-08-13 08:53:39'),
(63, 'core-legal-documents-view', 'Zobrazit právní dokumenty webu (GDPR, obchodní podmínky, cookies)', 'core', '2026-08-13 08:53:39'),
(64, 'core-legal-documents-create', 'Vytvořit novou sekci právního dokumentu', 'core', '2026-08-13 08:53:39'),
(65, 'core-legal-documents-update', 'Upravit sekci právního dokumentu', 'core', '2026-08-13 08:53:39'),
(66, 'core-legal-documents-delete', 'Smazat sekci právního dokumentu', 'core', '2026-08-13 08:53:39'),
(67, 'core-legal-config-view', 'Zobrazit firemní údaje a odkazy na sociální sítě', 'core', '2026-08-13 08:53:39'),
(68, 'core-legal-config-create', 'Vytvořit odkaz na sociální síť', 'core', '2026-08-13 08:53:39'),
(69, 'core-legal-config-update', 'Upravit firemní údaje / odkaz na sociální síť', 'core', '2026-08-13 08:53:39'),
(70, 'core-legal-config-delete', 'Smazat odkaz na sociální síť', 'core', '2026-08-13 08:53:39'),
(73, 'web-user-requests-view', 'Zobrazit uživatelské požadavky na výplatu provize', 'web', '2026-08-13 12:10:56'),
(74, 'web-user-requests-create', 'Vytvořit uživatelský požadavek na provizi ručně', 'web', '2026-08-13 12:10:56'),
(75, 'web-user-requests-update', 'Upravit uživatelský požadavek na provizi (např. schválení)', 'web', '2026-08-13 12:10:56'),
(76, 'web-user-requests-delete', 'Smazat / obnovit uživatelský požadavek na provizi z koše', 'web', '2026-08-13 12:10:56'),
(77, 'core-security-view', 'Zobrazit bezpečnostní monitoring (podezřelé requesty, captcha, throttle)', 'core', '2026-08-22 11:34:11'),
(78, 'core-security-update', 'Změnit stav bezpečnostního záznamu (vyřešeno/false positive) a nastavit retenci logů', 'core', '2026-08-22 11:34:11'),
(79, 'core-security-delete', 'Ručně smazat bezpečnostní záznam nebo spustit okamžitý purge starých záznamů', 'core', '2026-08-22 11:34:11');

-- --------------------------------------------------------

--
-- Table structure for table `core_roles`
--

CREATE TABLE `core_roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `forces_2fa` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Sysadmin nastavil, že tato role vyžaduje 2FA pro všechny uživatele s touto rolí (hromadné vynucení bez nutnosti nastavovat per-uživatel). Netýká se sysadmin/admin - ty mají 2FA vynuceno natvrdo v kódu bez ohledu na tento sloupec.',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `core_roles`
--

INSERT INTO `core_roles` (`id`, `role_name`, `description`, `forces_2fa`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'sysadmin', 'Systémový administrátor - má vše', 0, '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(2, 'admin', 'Administrátor - správa webu', 0, '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(14, 'test', NULL, 0, '2026-08-24 11:39:30', '2026-08-24 11:39:30', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `core_role_permissions`
--

CREATE TABLE `core_role_permissions` (
  `role_id` int(10) UNSIGNED NOT NULL,
  `permission_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `core_role_permissions`
--

INSERT INTO `core_role_permissions` (`role_id`, `permission_id`) VALUES
(1, 2),
(1, 3),
(1, 5),
(1, 6),
(1, 7),
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 26),
(1, 29),
(1, 30),
(1, 32),
(1, 33),
(1, 35),
(1, 36),
(1, 37),
(1, 38),
(1, 39),
(1, 40),
(1, 41),
(1, 42),
(1, 43),
(1, 44),
(1, 45),
(1, 46),
(1, 47),
(1, 48),
(1, 49),
(1, 50),
(1, 51),
(1, 52),
(1, 53),
(1, 54),
(1, 55),
(1, 56),
(1, 57),
(1, 58),
(1, 59),
(1, 60),
(1, 61),
(1, 62),
(1, 63),
(1, 64),
(1, 65),
(1, 66),
(1, 67),
(1, 68),
(1, 69),
(1, 70),
(1, 73),
(1, 74),
(1, 75),
(1, 76),
(1, 77),
(1, 78),
(1, 79),
(2, 3),
(2, 5),
(2, 7),
(2, 13),
(2, 14),
(2, 15),
(2, 16),
(2, 18),
(2, 19),
(2, 20),
(2, 21),
(2, 30),
(2, 35),
(2, 36),
(2, 37),
(2, 38),
(2, 39),
(2, 40),
(2, 41),
(2, 42),
(2, 43),
(2, 44),
(2, 45),
(2, 46),
(2, 47),
(2, 48),
(2, 49),
(2, 50),
(2, 51),
(2, 52),
(2, 53),
(2, 54),
(2, 73),
(2, 74),
(2, 75),
(2, 76);

-- --------------------------------------------------------

--
-- Table structure for table `core_security_events`
--

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

--
-- Dumping data for table `core_security_events`
--

INSERT INTO `core_security_events` (`id`, `fingerprint`, `event_type`, `severity`, `ip_address`, `user_agent`, `route`, `method`, `user_id`, `occurrences`, `first_seen_at`, `last_seen_at`, `status`, `notes`, `context_data`, `created_at`, `updated_at`) VALUES
(1, 'fe049d80a7df659612a9a7aaf9657395650c099e284f95c93bdd3f93074132ba', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/security_events', 'GET', NULL, 2, '2026-08-25 23:01:55', '2026-08-25 23:01:55', 'new', NULL, '{\"route\":\"api\\/core\\/security_events\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-25 23:01:55', '2026-08-25 23:01:55'),
(3, '8a5c310457daf1c17ea3ccb5101df07ede3967e472e874876bb68f17566179aa', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (SecurityTestScript)', 'api/login', 'POST', NULL, 3, '2026-08-25 23:02:33', '2026-08-25 23:02:34', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\",\"user_id\":null,\"email\":\"utok-test@example.com\"}', '2026-08-25 23:02:33', '2026-08-25 23:02:34'),
(6, 'aebbd04daa163e5ee4b1288619fdb945767ab96aec7a45441cb00b9f6f08dfdd', 'login_brute_force_suspected', 'critical', '127.0.0.1', 'Mozilla/5.0 (SecurityTestScript)', 'api/login', 'POST', NULL, 1, '2026-08-25 23:02:34', '2026-08-25 23:02:34', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\",\"user_id\":null,\"email\":\"utok-test@example.com\"}', '2026-08-25 23:02:34', '2026-08-25 23:02:34'),
(7, '4420de438697858f30962835eb42e8bc82d4b85895b64f255a04aaf618f84342', 'login_captcha_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (SecurityTestScript)', 'api/login', 'POST', NULL, 2, '2026-08-25 23:02:34', '2026-08-25 23:02:34', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\",\"user_id\":null,\"email\":\"utok-test@example.com\",\"reason\":\"empty_token\"}', '2026-08-25 23:02:34', '2026-08-25 23:02:34'),
(9, '3b1a20a69d49044b0d210932af9afaa42cbb5c168c532fe3932e1fd2bb869a82', 'throttle_exceeded', 'warning', '127.0.0.1', 'Mozilla/5.0 (SecurityTestScript)', 'api/login', 'POST', NULL, 5, '2026-08-25 23:02:34', '2026-08-25 23:02:34', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (SecurityTestScript)\",\"user_id\":null}', '2026-08-25 23:02:34', '2026-08-25 23:02:34'),
(14, '1b3950c69f857b3a44aa2376a44bcadec947bb6532a051c91178b1701ca9a67b', 'password_reset_email_rate_limited', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/forgot-password', 'POST', NULL, 2, '2026-08-25 23:02:35', '2026-08-25 23:02:35', 'new', NULL, '{\"route\":\"api\\/forgot-password\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"email_requested\":\"utok-test@example.com\"}', '2026-08-25 23:02:35', '2026-08-25 23:02:35'),
(16, '25c8473949257cbd55bcaf365a6e611f47f8e1c202d05f1f074c982ec5421164', 'throttle_exceeded', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/forgot-password', 'POST', NULL, 3, '2026-08-25 23:02:35', '2026-08-25 23:02:35', 'new', NULL, '{\"route\":\"api\\/forgot-password\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-08-25 23:02:35', '2026-08-25 23:02:35'),
(19, 'c109c95bde1e6235678b9d15ee3f60b4d240f089fa15a54a7dca3cf300fa9a0c', 'throttle_exceeded', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/sales_orders', 'POST', NULL, 4, '2026-08-25 23:02:37', '2026-08-25 23:02:37', 'new', NULL, '{\"route\":\"api\\/sales_orders\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-08-25 23:02:37', '2026-08-25 23:02:37'),
(23, '290c7584f94d27a00da93a003c8bd100024d910f749b63828c35f49aca2a5a90', 'scan_probe', 'warning', '127.0.0.1', 'Mozilla/5.0 (compatible; SecurityTestBot/1.0)', 'api/.env', 'GET', NULL, 10, '2026-08-25 23:02:37', '2026-08-25 23:02:38', 'new', NULL, '{\"route\":\"api\\/.env\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (compatible; SecurityTestBot\\/1.0)\",\"user_id\":null}', '2026-08-25 23:02:37', '2026-08-25 23:02:38'),
(33, 'd3be1b26ae0bc8fef07a5cba096af42749b136396bd0076abcbd491b17f91a42', 'refresh_token_invalid', 'info', '127.0.0.1', 'curl/8.11.1', 'api/refresh', 'POST', NULL, 5, '2026-08-25 23:02:38', '2026-08-25 23:02:39', 'new', NULL, '{\"route\":\"api\\/refresh\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-08-25 23:02:38', '2026-08-25 23:02:39'),
(38, '115d3fe39cb0328cc946ea5778ba35f9b5cd019b6c0a5c58479c0b9f4b07e20b', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'curl/8.11.1', 'api/core/users', 'GET', NULL, 10, '2026-08-25 23:02:39', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-08-25 23:02:39', '2026-08-25 23:02:40'),
(48, '334e9442e0815ae94096f1ba4c0b5ced61d0f0715c50ff944fb0a612c855dce9', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-1', 'GET', NULL, 1, '2026-08-25 23:02:40', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-1\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:40', '2026-08-25 23:02:40'),
(49, '46dbb66da76c8f3c3b00d0d3512aca88905766571d613233aca966422b00d492', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-2', 'GET', NULL, 1, '2026-08-25 23:02:40', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-2\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:40', '2026-08-25 23:02:40'),
(50, '01ff30b47963b14565aa9ad61fdcd36dadf605bd6db1d56ad1ecb6bc49ad4821', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-3', 'GET', NULL, 1, '2026-08-25 23:02:40', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-3\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:40', '2026-08-25 23:02:40'),
(51, 'eec7fa879a2f30be6280854d621b425981c4a730882d2ff3ca7640330b42a8b1', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-4', 'GET', NULL, 1, '2026-08-25 23:02:40', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-4\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:40', '2026-08-25 23:02:40'),
(52, '2a7c6fa9bb1e60a801bffb7d496a2fabceeab2672506e309286878a101cf2c15', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-5', 'GET', NULL, 1, '2026-08-25 23:02:40', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-5\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:40', '2026-08-25 23:02:40'),
(53, 'a300d77f7c21c7cf125c21a01994135caae469d9554eb121ce31f9b4e512c63d', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-post-1', 'POST', NULL, 1, '2026-08-25 23:02:40', '2026-08-25 23:02:40', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-post-1\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:40', '2026-08-25 23:02:40'),
(54, '82b3c09f8323af7d1c93d9b000c20e3766964723f7fdbf928e046ef84da19f08', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-post-2', 'POST', NULL, 1, '2026-08-25 23:02:41', '2026-08-25 23:02:41', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-post-2\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:41', '2026-08-25 23:02:41'),
(55, 'f497f1fdb53c9c7cb2bf44389ca9ad52252089d2b880ac24493cc611899a0618', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/account-activation/neplatny-aktivacni-token-post-3', 'POST', NULL, 1, '2026-08-25 23:02:41', '2026-08-25 23:02:41', 'new', NULL, '{\"route\":\"api\\/account-activation\\/neplatny-aktivacni-token-post-3\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:41', '2026-08-25 23:02:41'),
(56, 'c6bc7911a08458da153e2f06f8eca6075633499484ce8fcad16a015350b664a8', 'password_reset_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/reset-password', 'POST', NULL, 5, '2026-08-25 23:02:41', '2026-08-25 23:02:41', 'new', NULL, '{\"route\":\"api\\/reset-password\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"invalid_token\"}', '2026-08-25 23:02:41', '2026-08-25 23:02:41'),
(61, 'a38f643f26f242364f44403642c53006ba49b4ec16bf73bbcf48f7e62dc6a984', 'login_2fa_session_invalid', 'info', '127.0.0.1', 'curl/8.11.1', 'api/login/verify-2fa', 'POST', NULL, 3, '2026-08-25 23:02:41', '2026-08-25 23:02:42', 'new', NULL, '{\"route\":\"api\\/login\\/verify-2fa\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-08-25 23:02:41', '2026-08-25 23:02:42'),
(64, 'f886754ac60d2c1cc3a2433570d02144a0aaa1ceaf16533cf41ba2de431d1039', 'login_2fa_session_invalid', 'info', '127.0.0.1', 'curl/8.11.1', 'api/login/resend-2fa', 'POST', NULL, 3, '2026-08-25 23:02:42', '2026-08-25 23:02:42', 'new', NULL, '{\"route\":\"api\\/login\\/resend-2fa\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-08-25 23:02:42', '2026-08-25 23:02:42'),
(67, '6e4f62b3de60c215c59d79c7f2a34f2a4e774eba07601f0d1987d78adffb0e5d', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/public/sales-leads/neexistujici-lead-token-1', 'GET', NULL, 1, '2026-08-25 23:02:42', '2026-08-25 23:02:42', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/neexistujici-lead-token-1\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:42', '2026-08-25 23:02:42'),
(68, '51a99440d8d437c4003e581ca4a71e4d6479d99d1c7498a15103edb495652dde', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/public/sales-leads/neexistujici-lead-token-2', 'GET', NULL, 1, '2026-08-25 23:02:42', '2026-08-25 23:02:42', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/neexistujici-lead-token-2\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:42', '2026-08-25 23:02:42'),
(69, 'b7c608a4b2ad9d6a0c40c2af4cd81972362901df22db36c582adb81a13700932', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/public/sales-leads/neexistujici-lead-token-3', 'GET', NULL, 1, '2026-08-25 23:02:42', '2026-08-25 23:02:42', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/neexistujici-lead-token-3\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:42', '2026-08-25 23:02:42'),
(70, '9ff0ff4580b118c576181c3a17e9a1ce82d1732e692047a76850cdb89e99c4d6', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/public/sales-leads/neexistujici-lead-token-4', 'GET', NULL, 1, '2026-08-25 23:02:42', '2026-08-25 23:02:42', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/neexistujici-lead-token-4\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:42', '2026-08-25 23:02:42'),
(71, '0b7bfe55c9e6308b8caecc658ea8fe9acac1b5312fc3287a35697a232694686e', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/public/sales-leads/neexistujici-lead-token-5', 'GET', NULL, 1, '2026-08-25 23:02:43', '2026-08-25 23:02:43', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/neexistujici-lead-token-5\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-08-25 23:02:43', '2026-08-25 23:02:43'),
(72, '78cb6704834e29df204a3d2419bcebbae77150879eaa0529349c1135c9129a17', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'GET', NULL, 2, '2026-08-26 10:43:40', '2026-08-26 10:43:40', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-26 10:43:40', '2026-08-26 10:43:40'),
(74, '70118802803a5bbf5066dfe39a749d38768c2667d469ac5af31c8b090ab6aba2', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/roles', 'GET', NULL, 2, '2026-08-26 10:43:40', '2026-08-26 10:43:40', 'new', NULL, '{\"route\":\"api\\/core\\/roles\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-26 10:43:40', '2026-08-26 10:43:40'),
(76, '7beb53c9688c891877c04d26197ad11a0907aee82047f837195b80cbdaef5f6e', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', 25, 1, '2026-08-26 11:23:00', '2026-08-26 11:23:00', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":25,\"attempted_email\":\"test@test.cu\",\"attempted_domain\":\"test.cu\"}', '2026-08-26 11:23:00', '2026-08-26 11:23:00'),
(77, '8e1ff3d259a9d29f47fd42f06c2fb0ea5327b628d3fda4e23b2c53efbc3aac2e', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', 25, 1, '2026-08-26 11:31:14', '2026-08-26 11:31:14', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":25,\"attempted_email\":\"test@testasdasd.cz\",\"attempted_domain\":\"testasdasd.cz\"}', '2026-08-26 11:31:14', '2026-08-26 11:31:14'),
(78, '44502d4ec120e6ef3305e1f70fff43ef5c8c42d8a8d630a7b33a974ee7447d82', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_leads', 'GET', NULL, 2, '2026-08-26 11:54:50', '2026-08-26 11:54:50', 'new', NULL, '{\"route\":\"api\\/web\\/sales_leads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-26 11:54:50', '2026-08-26 11:54:50');

-- --------------------------------------------------------

--
-- Table structure for table `core_security_settings`
--

CREATE TABLE `core_security_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `retention_days` smallint(5) UNSIGNED NOT NULL DEFAULT 90 COMMENT 'Po kolika dnech se core_security_events automaticky maže (GDPR retence)',
  `primary_email_domain` varchar(255) DEFAULT NULL COMMENT 'Hlavni povolena domena pro nove admin ucty (napr. rpsw.cz). NULL = bez omezeni.',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `core_security_settings`
--

INSERT INTO `core_security_settings` (`id`, `retention_days`, `primary_email_domain`, `created_at`, `updated_at`) VALUES
(1, 60, 'rpsw.cz', '2026-08-22 13:34:11', '2026-08-26 11:00:09');

-- --------------------------------------------------------

--
-- Table structure for table `document_sections`
--

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

--
-- Dumping data for table `document_sections`
--

INSERT INTO `document_sections` (`id`, `document_type_id`, `position`, `heading`, `content`, `lang`, `created_at`, `updated_at`) VALUES
(24, 1, 1, '1. Úvodní ustanovení', 'Tyto Zásady zpracování osobních údajů (dále jen „Zásady“) popisují, jak společnost RegioPartner, s.r.o., se sídlem Kytlická 862/6, 190 00 Praha, IČO: 25133161, DIČ: CZ25133161, zapsaná v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 52029 (dále jen „my“ nebo „Správce“), shromažďuje, používá a chrání osobní údaje, které nám poskytujete v souvislosti s používáním našich webových stránek a našich služeb, zejména inzerce digitálních produktů a služeb. Zavazujeme se chránit vaše soukromí a zpracováváme osobní údaje v souladu s Nařízením Evropského parlamentu a Rady (EU) 2016/679 (dále jen „GDPR“) a platnými právními předpisy České republiky, zejména zákonem č. 110/2019 Sb., o zpracování osobních údajů, ve znění pozdějších předpisů. Pokud s těmito Zásadami nesouhlasíte, prosíme, nepoužívejte naše webové stránky ani služby.', 'cz', '2026-06-13 05:55:39', '2026-08-10 17:34:30'),
(25, 1, 2, '2. Správce osobních údajů', 'Správcem vašich osobních údajů je: RegioPartner, s.r.o. Sídlo: Kytlická 862/6, 190 00 Praha IČO: 25133161 DIČ: CZ25133161 E-mail: info@rpsw.cz Telefon: +420 733 188 328 V případě dotazů ohledně zpracování osobních údajů nás prosím kontaktujte na výše uvedeném e-mailu.', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(26, 1, 3, '3. Jaké osobní údaje shromažďujeme a proč', 'Shromažďujeme a zpracováváme osobní údaje pouze pro definované, legitimní účely a v rozsahu nezbytném pro naplnění těchto účelů. 3.1. Údaje poskytnuté vámi: Můžeme shromažďovat osobní údaje, které nám dobrovolně poskytnete, například při: Vytvoření objednávky služeb: Jméno, příjmení, e-mail, telefon. Účel: Vyřízení objednávky a poskytnutí sjednané služby. Právní základ: Plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR). Kontaktu prostřednictvím formuláře: Jméno, e-mail, telefon, obsah zprávy. Účel: Zodpovězení dotazu, řešení požadavku, poskytnutí cenové nabídky. Právní základ: Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR) na efektivní komunikaci se zákazníky/uživateli a předsmluvní jednání. Přihlášení k odběru newsletteru: E-mail. Účel: Zasílání obchodních sdělení a informací o novinkách. Právní základ: Souhlas (čl. 6 odst. 1 písm. a) GDPR). 3.2. Údaje shromažďované automaticky: Při používání našich webových stránek můžeme automaticky shromažďovat některé informace, jako jsou: IP adresa: Účel: Zabezpečení webu, diagnostika problémů, statistiky návštěvnosti. Právní základ: Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR). Údaje o prohlížeči a zařízení: Typ prohlížeče, operační systém, jazyk. Účel: Zajištění správné funkčnosti webu, optimalizace zobrazení. Právní základ: Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR). Údaje o návštěvnosti webu (cookies a podobné technologie): Zobrazované stránky, doba strávená na stránce, reference na jiné weby. Účel: Zlepšování funkčnosti webu, analýza chování uživatelů. Právní základ: Souhlas (pro marketingové a analytické cookies, čl. 6 odst. 1 písm. a) GDPR), oprávněný zájem (pro nezbytné cookies, čl. 6 odst. 1 písm. f) GDPR).', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:56:51'),
(27, 1, 4, '4. Jak dlouho osobní údaje uchováváme', 'Osobní údaje uchováváme pouze po dobu nezbytně nutnou k naplnění účelů, pro které byly shromážděny, nebo po dobu stanovenou právními předpisy. Doba uchování se liší v závislosti na typu údajů a účelu zpracování: Údaje pro plnění smlouvy: Po dobu trvání smluvního vztahu a následně po dobu stanovenou zákonem pro archivaci účetních a daňových dokladů (obvykle 10 let). Údaje pro marketingové účely (newsletter): Po dobu trvání vašeho souhlasu, nejdéle však 5 let od jeho udělení, nebo do odvolání souhlasu. Údaje z kontaktních formulářů: Po dobu nezbytnou pro vyřízení vašeho požadavku, obvykle 1 rok. Údaje z cookies: Doba uchování se liší dle typu cookies (viz naše Zásady používání souborů cookie). Po uplynutí doby uchování jsou osobní údaje vymazány nebo anonymizovány.', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(28, 1, 5, '5. Komu osobní údaje předáváme (Příjemci)', 'Vaše osobní údaje předáváme pouze v nezbytném rozsahu a pouze prověřeným subjektům, a to na základě smlouvy o zpracování osobních údajů, která zajišťuje stejnou úroveň ochrany. Může se jednat o: Poskytovatelé IT služeb a hostingu: Pro zajištění provozu webu a informačních systémů. Jedná se například o společnost INTERNET CZ, a.s. Poskytovatelé marketingových a analytických služeb: (např. Google Analytics, nástroje pro e-mail marketing). Poskytovatelé platebních služeb: Pro zpracování plateb (např. banky, platební brány). Účetní a právní poradci: Pro plnění právních povinností a obranu právních nároků. Orgány veřejné moci: V případě zákonné povinnosti (např. soudy, policie, finanční úřad). Nepředáváme osobní údaje do zemí mimo Evropskou unii nebo Evropský hospářský prostor bez zajištění odpovídajících záruk ochrany osobních údajů (např. standardní smluvní doložky).', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(29, 1, 6, '6. Vaše práva v souvislosti se zpracováním osobních údajů', 'V souladu s GDPR máte následující práva: Právo na přístup k osobním údajům (čl. 15 GDPR): Máte právo získat potvrzení, zda jsou či nejsou vaše osobní údaje zpracovávány. Právo na opravu (čl. 16 GDPR): Máte právo na opravu nepřesných nebo doplnění neúplných údajů. Právo na výmaz (čl. 17 GDPR): Právo „být zapomenut“, pokud jsou splněny zákonné důvody. Právo na omezení zpracování (čl. 18 GDPR): Máte právo na omezení zpracování v případech stanovených GDPR. Právo na přenositelnost údajů (čl. 20 GDPR): Právo získat údaje ve strukturovaném a strojově čitelném formátu. Právo vznést námitku (čl. 21 GDPR): Právo vznést námitku proti zpracování založeném na oprávněném zájmu nebo pro přímý marketing. Právo odvolat souhlas (čl. 7 odst. 3 GDPR): Právo souhlas kdykoli odvolat. Právo podat stížnost u dozorového úřadu (čl. 77 GDPR). Kontakt na dozorový úřad: Úřad pro ochranu osobních údajů Pplk. Sochora 27, 170 00 Praha 7 Telefon: +420 234 665 800 Web: www.uoou.cz', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(30, 1, 7, '7. Bezpečnost osobních údajů', 'Přijali jsme vhodná technická a organizační opatření k ochraně vašich osobních údajů před neoprávněným přístupem, změnou, zveřejněním nebo zničením. Mezi tato opatření patří: šifrování dat (SSL/TLS), provoz na zabezpečených serverech s pravidelnými audity, striktní řízení přístupu pomocí silných hesel, pravidelné zálohování dat a školení zaměstnanců v oblasti bezpečnosti dat.', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(31, 1, 8, '8. Změny těchto Zásad', 'Tyto Zásady můžeme čas od času aktualizovat. Jakékoli změny zveřejme na této stránce s uvedením data poslední aktualizace. Doporučujeme pravidelně kontrolovat tuto stránku, abyste byli informováni o tom, jak chráníme vaše údaje.', 'cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(32, 2, 1, '1. Úvodní ustanovení', 'Tyto obchodní podmínky (dále jen „OP“) společnosti RegioPartner, s.r.o., se sídlem Kytlická 862/6, 190 00 Praha, IČO: 25133161, DIČ: CZ25133161, zapsané v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 52029 (dále jen „Prodávající“), upravují v souladu s ustanovením § 1751 odst. 1 zákona č. 89/2012 Sb., občanský zákoník (dále jen „občanský zákoník“), vzájemná práva a povinnosti smluvních stran vzniklé v souvislosti nebo na základě kupní smlouvy uzavírané mezi Prodávajícím a jinou fyzickou či právnickou osobou (dále jen „Kupující“) prostřednictvím webového rozhraní Prodávajícího umístěného na internetové adrese www.rpsw.cz (dále jen „e-shop“). Ustanovení OP jsou nedílnou součástí kupní smlouvy. Odchylná ujednání v kupní smlouvě mají přednost před ustanoveními OP. Znění OP může Prodávající měnit či doplňovat. Nové znění OP nabývá účinnosti dnem jeho zveřejnění na webové stránce Prodávajícího.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(33, 2, 2, '2. Předmět smlouvy', 'Předmětem kupní smlouvy je prodej a poskytování digitálních produktů a služeb, které jsou specifikovány v nabídce na e-shopu Prodávajícího. Digitální produkty zahrnují, ale nejsou omezeny na: software, online kurzy, e-booky, grafické šablony, audio a video záznamy. Služby zahrnují například tvorbu a správu online reklamy.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(34, 2, 3, '3. Objednávka a uzavření kupní smlouvy', 'Veškerá prezentace zboží a služeb umístěná ve webovém rozhraní e-shopu je informativního charakteru a Prodávající není povinen uzavřít kupní smlouvu ohledně tohoto zboží a služeb. Ustanovení § 1732 odst. 2 občanského zákoníku se nepoužije. Pro objednání zboží (služeb) vyplní Kupující objednávkový formulář na webové stránce. Objednávkový formulář obsahuje zejména informace o: objednávaném zboží (službách) (Kupující vloží objednávané zboží do elektronického nákupního košíku webového rozhraní obchodu), způsobu úhrady kupní ceny zboží (služeb), údajích o požadovaném způsobu doručení objednávaného zboží, informacích o nákladech spojených s dodáním zboží (služeb). Odesláním objednávky Kupující potvrzuje, že se seznámil s těmito OP a souhlasí s nimi. Kupní smlouva je uzavřena doručením přijetí objednávky (akceptací) Prodávajícího Kupujícímu elektronickou poštou, a to na e-mailovou adresu Kupujícího uvedenou v objednávce.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(35, 2, 4, '4. Cena zboží a platební podmínky', 'Ceny zboží a služeb jsou uvedeny včetně DPH, pokud není výslovně uvedeno jinak. Společně s kupní cenou je Kupující povinen uhradit Prodávajícímu také náklady spojené s dodáním zboží (služeb) ve sjednané výši. Prodávající akceptuje následující způsoby platby: bankovním převodem na účet Prodávajícího, online platbou kartou prostřednictvím platební brány. V případě bezhotovostní platby je kupní cena splatná do 7 dnů od uzavření kupní smlouvy. Závazek Kupujícího uhradit kupní cenu je splněn okamžikem připsání příslušné částky na účet Prodávajícího.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(36, 2, 5, '5. Dodání digitálních produktů a služeb', 'Digitální produkty jsou dodány bez zbytečného odkladu po uhrazení ceny, zpravidla do 24 hodin, a to ve formě odkazu ke stažení, přístupu do členské sekce, nebo zasláním souborů na e-mail Kupujícího. V případě služeb je dodání stanoveno individuálně na základě dohody s Kupujícím. Náklady na dopravu zboží jsou uvedeny v objednávce a jsou součástí kupní ceny.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(37, 2, 6, '6. Odstoupení od smlouvy', 'Vzhledem k povaze digitálního obsahu, který není dodáván na hmotném nosiči, a s ohledem na ust. § 1837 písm. l) občanského zákoníku, nemá Kupující právo odstoupit od smlouvy, pokud mu byl obsah dodán s jeho předchozím výslovným souhlasem a před uplynutím lhůty pro odstoupení od smlouvy Kupující prohlásil, že byl poučen o tom, že dodáním digitálního obsahu zaniká jeho právo na odstoupení od smlouvy. Pokud se jedná o službu, Kupující spotřebitel má právo odstoupit od kupní smlouvy bez udání důvodu ve lhůtě 14 dnů od jejího uzavření, pokud poskytování služby již nezačalo. Oznámení o odstoupení od smlouvy musí být Prodávajícímu doručeno ve výše uvedené lhůtě.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(38, 2, 7, '7. Práva z vadného plnění (Reklamace)', 'Práva a povinnosti smluvních stran ohledně práv z vadného plnění se řídí příslušnými obecně závaznými právními předpisy (zejména ustanoveními § 1914 až 1925, § 2099 až 2117 a § 2161 až 2174 občanského zákoníku a zákonem č. 634/1992 Sb., o ochraně spotřebitele, ve znění pozdějších předpisů). Prodávající odpovídá Kupujícímu, že digitální produkt nebo služba při převzetí nemá vady. Zejména Prodávající odpovídá Kupujícímu, že v době, kdy Kupující produkt převzal, má vlastnosti, které si strany ujednaly, hodí se k účelu, který pro jeho použití Prodávající uvádí, a odpovídá požadavkům právních předpisů. Práva z vadného plnění uplatňuje Kupující u Prodávajícího elektronickou poštou na adrese: info@rpsw.cz.', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(39, 2, 8, '8. Ochrana osobních údajů', 'Prodávající se zavazuje chránit osobní údaje Kupujícího v souladu s platnými právními předpisy, zejména s nařízením GDPR (Nařízení Evropského parlamentu a Rady (EU) 2016/679 o ochraně fyzických osob v souvislosti se zpracováním osobních údajů). Podrobné informace o zpracování osobních údajů jsou k dispozici v samostatném dokumentu \"Zásady ochrany osobních údajů\", který je dostupný na webové stránce Prodávajícího. Odkaz:', 'cz', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(40, 2, 9, '9. Práva z vadného plnění a reklamační řád', 'Kupující je povinen při převzetí digitálního produktu či zahájení čerpání služby bez zbytečného odkladu ověřit jejich funkčnost a soulad s objednávkou. Pokud digitální produkt nebo služba vykazuje vady, jako je například nefunkční odkaz ke stažení, nesoulad se specifikací v objednávce či nedostupnost přístupu k členské sekci, má Kupující právo na reklamaci. Reklamaci je Kupující povinen uplatnit bez zbytečného odkladu poté, co vadu zjistí, a to elektronickou poštou na e-mailovou adresu info@rpsw.cz. Oznámení o reklamaci musí obsahovat identifikaci Kupujícího, tedy jméno a e-mail použitý při objednávce, číslo objednávky, detailní popis vady, případně vizuální dokumentaci vady, a požadovaný způsob vyřízení reklamace. Prodávající o reklamaci rozhodne ihned, ve složitých případech do tří pracovních dnů, přičemž do této lhůty se nezapočítává doba přiměřená podle druhu digitálního obsahu či služby potřebná k odbornému posouzení vady. Reklamace včetně odstranění vady bude vyřízena bez zbytečného odkladu, nejpozději do 30 dnů ode dne uplatnění reklamace, pokud se Prodávající s Kupujícím nedohodnou na delší lhůtě. Prodávající odpovídá Kupujícímu za to, že digitální produkt je při dodání bez vad a má vlastnosti, které byly ujednány nebo které lze vzhledem k povaze produktu očekávat. V případě, že vadu nelze odstranit, má Kupující právo na přiměřenou slevu z kupní ceny nebo na odstoupení od kupní smlouvy v souladu s příslušnými ustanoveními občanského zákoníku.', 'cz', '2026-06-13 05:58:39', '2026-06-13 06:26:22'),
(41, 2, 10, '10. Závěrečná ustanovení', 'Je-li některé ustanovení OP neplatné nebo neúčinné, nebo se takovým stane, namísto neplatných ustanovení nastoupí ustanovení, jehož smysl se neplatnému ustanovení co nejvíce přibližuje. Tyto obchodní podmínky se řídí právním řádem České republiky. Veškeré spory vznikající z těchto OP nebo v souvislosti s nimi budou řešeny příslušnými soudy České republiky. V případě, že dojde mezi Prodávajícím a spotřebitelem ke vzniku spotřebitelského sporu z kupní smlouvy, který se nepodaří vyřešit vzájemnou dohodou, může spotřebitel podat návrh na mimosoudní řešení takového sporu určenému subjektu mimosoudního řešení spotřebitelských sporů, kterým je: Česká obchodní inspekce, Ústřední inspektorát – oddělení ADR, Štěpánská 44, 110 00 Praha 1, Web: www.coi.cz. Tyto obchodní podmínky nabývají účinnosti dnem 22. srpna 2025.', 'cz', '2026-06-13 06:25:49', '2026-06-13 06:25:49'),
(81, 3, 1, '1. Co jsou cookies', 'Cookies jsou malé textové soubory, které se při návštěvě webové stránky ukládají do vašeho prohlížeče. Umožňují webu zapamatovat si informace o vaší návštěvě (např. zvolený jazyk nebo to, že jste s používáním cookies souhlasili), a díky tomu je další prohlížení webu pohodlnější. Některé cookies jsou nezbytné pro základní fungování webu, jiné nám pomáhají web vylepšovat nebo vám zobrazovat relevantnější obsah.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49'),
(82, 3, 2, '2. Jaké kategorie cookies používáme', 'Cookies na našem webu dělíme do čtyř kategorií: Nezbytné cookies - nutné pro základní fungování webu (např. zapamatování vašeho souhlasu s cookies); tyto nelze vypnout. Funkční cookies - umožňují si web zapamatovat vaše preference (např. zvolený jazyk) a nabídnout pohodlnější prohlížení. Analytické cookies - pomáhají nám pochopit, jak návštěvníci web používají (např. Google Analytics), abychom ho mohli postupně vylepšovat. Marketingové cookies - používají se k zobrazování relevantnější reklamy na základě vašeho zájmu, a to i na jiných webech. Analytické a marketingové cookies používáme pouze na základě vašeho výslovného souhlasu.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49'),
(83, 3, 3, '3. Konkrétní cookies, které používáme', 'Nezbytné: rpsw_cookie_consent - uchovává vaši volbu ohledně souhlasu s cookies, platnost 180 dní. Analytické (pouze se souhlasem): _ga, _ga_* - Google Analytics, rozlišování návštěvníků a měření návštěvnosti, platnost až 2 roky; poskytovatel Google Ireland Limited. Marketingové (pouze se souhlasem): cookies reklamních a remarketingových nástrojů (např. Google Ads, Meta), pokud jsou na webu aktivně nasazeny - jejich přesný výčet a účel doplníme, jakmile konkrétní nástroj nasadíme. Funkční: cookies pro zapamatování zvoleného jazyka webu.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49'),
(84, 3, 4, '4. Jak dlouho cookies uchováváme', 'Doba uchování se liší podle typu cookie. Váš souhlas s cookies uchováváme 180 dní, po jejich uplynutí vás požádáme o souhlas znovu. Analytické cookies od Google Analytics jsou uchovávány dle nastavení tohoto nástroje, standardně až 2 roky. Cookies pro zapamatování jazyka jsou trvalé (persistentní) do doby, než je sami smažete v nastavení prohlížeče, nebo dokud znovu nezměníte volbu jazyka.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49'),
(85, 3, 5, '5. Jak můžete svůj souhlas změnit nebo odvolat', 'Svůj souhlas s jednotlivými kategoriemi cookies můžete kdykoli změnit nebo odvolat - stačí použít tlačítko \"Změnit nastavení cookies\" na této stránce, které znovu otevře lištu s možností volby jednotlivých kategorií. Odvolání souhlasu nemá vliv na zákonnost zpracování prováděného na základě souhlasu před jeho odvoláním. Cookies si také můžete kdykoli smazat přímo v nastavení svého prohlížeče - tím se ale současně smaže i záznam o vašem souhlasu a lišta se při další návštěvě zobrazí znovu.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49'),
(86, 3, 6, '6. Cookies třetích stran', 'Pro analytické účely využíváme službu Google Analytics, provozovanou společností Google Ireland Limited. Tato služba může ukládat vlastní cookies a zpracovávat údaje o vašem chování na webu v souladu se zásadami ochrany soukromí Google. Tyto cookies se ukládají pouze v případě, že s analytickými cookies vyslovíte souhlas. Podrobnosti o zpracování údajů společností Google najdete na stránkách policies.google.com/privacy.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49'),
(87, 3, 7, '7. Kontakt a změny těchto zásad', 'V případě jakýchkoli dotazů ohledně používání cookies nás můžete kontaktovat na e-mailu info@rpsw.cz. Tyto zásady můžeme čas od času aktualizovat, zejména v souvislosti se změnami v tom, jaké nástroje na webu používáme. Aktuální znění je vždy dostupné na této stránce.', 'cz', '2026-07-31 21:50:49', '2026-07-31 21:50:49');

-- --------------------------------------------------------

--
-- Table structure for table `document_types`
--

CREATE TABLE `document_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `slug` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `document_types`
--

INSERT INTO `document_types` (`id`, `slug`, `title`, `created_at`, `updated_at`) VALUES
(1, 'gdpr', 'GDPR - Ochrana osobních údajů', '2026-06-12 19:15:23', '2026-06-12 19:15:23'),
(2, 'tos', 'Obchodní podmínky', '2026-06-12 19:15:23', '2026-06-13 05:35:46'),
(3, 'cookies', 'Zásady používání cookies', '2026-07-31 21:50:49', '2026-07-31 21:50:49');

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `failed_jobs`
--

INSERT INTO `failed_jobs` (`id`, `uuid`, `connection`, `queue`, `payload`, `exception`, `failed_at`) VALUES
(2, '34d96d26-7a41-4cce-9f6b-1e91a8900966', 'database', 'default', '{\"uuid\":\"34d96d26-7a41-4cce-9f6b-1e91a8900966\",\"displayName\":\"App\\\\Mail\\\\Web\\\\WebRawRequestCommissionReceived\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Mail\\\\SendQueuedMailable\",\"command\":\"O:34:\\\"Illuminate\\\\Mail\\\\SendQueuedMailable\\\":15:{s:8:\\\"mailable\\\";O:44:\\\"App\\\\Mail\\\\Web\\\\WebRawRequestCommissionReceived\\\":3:{s:17:\\\"requestCommission\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:38:\\\"App\\\\Models\\\\Web\\\\WebRawRequestCommission\\\";s:2:\\\"id\\\";i:231;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:2:\\\"to\\\";a:1:{i:0;a:2:{s:4:\\\"name\\\";N;s:7:\\\"address\\\";s:10:\\\"dgfd@dfg.z\\\";}}s:6:\\\"mailer\\\";s:4:\\\"smtp\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:13:\\\"maxExceptions\\\";N;s:17:\\\"shouldBeEncrypted\\\";b:0;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;s:3:\\\"job\\\";N;}\"},\"createdAt\":1787741663,\"delay\":null}', 'Illuminate\\Database\\Eloquent\\ModelNotFoundException: No query results for model [App\\Models\\Web\\WebRawRequestCommission]. in /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Database/Eloquent/Builder.php:750\nStack trace:\n#0 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/SerializesAndRestoresModelIdentifiers.php(110): Illuminate\\Database\\Eloquent\\Builder->firstOrFail()\n#1 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/SerializesAndRestoresModelIdentifiers.php(63): App\\Mail\\Web\\WebRawRequestCommissionReceived->restoreModel()\n#2 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/SerializesModels.php(97): App\\Mail\\Web\\WebRawRequestCommissionReceived->getRestoredPropertyValue()\n#3 [internal function]: App\\Mail\\Web\\WebRawRequestCommissionReceived->__unserialize()\n#4 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(95): unserialize()\n#5 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(62): Illuminate\\Queue\\CallQueuedHandler->getCommand()\n#6 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Jobs/Job.php(102): Illuminate\\Queue\\CallQueuedHandler->call()\n#7 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(444): Illuminate\\Queue\\Jobs\\Job->fire()\n#8 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(394): Illuminate\\Queue\\Worker->process()\n#9 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(180): Illuminate\\Queue\\Worker->runJob()\n#10 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(148): Illuminate\\Queue\\Worker->daemon()\n#11 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(131): Illuminate\\Queue\\Console\\WorkCommand->runWorker()\n#12 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Queue\\Console\\WorkCommand->handle()\n#13 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#14 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure()\n#15 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod()\n#16 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Container.php(754): Illuminate\\Container\\BoundMethod::call()\n#17 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Console/Command.php(211): Illuminate\\Container\\Container->call()\n#18 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Command/Command.php(318): Illuminate\\Console\\Command->execute()\n#19 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Console/Command.php(180): Symfony\\Component\\Console\\Command\\Command->run()\n#20 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(1092): Illuminate\\Console\\Command->run()\n#21 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(341): Symfony\\Component\\Console\\Application->doRunCommand()\n#22 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(192): Symfony\\Component\\Console\\Application->doRun()\n#23 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(197): Symfony\\Component\\Console\\Application->run()\n#24 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(1234): Illuminate\\Foundation\\Console\\Kernel->handle()\n#25 /home/joncl/prg/Typescript/rp_website/api/artisan(16): Illuminate\\Foundation\\Application->handleCommand()\n#26 {main}', '2026-08-26 10:55:00'),
(3, '7f4aa0c0-7cc9-4c4a-9705-9b3807972bc4', 'database', 'default', '{\"uuid\":\"7f4aa0c0-7cc9-4c4a-9705-9b3807972bc4\",\"displayName\":\"App\\\\Mail\\\\Web\\\\WebRawRequestCommissionReceived\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Mail\\\\SendQueuedMailable\",\"command\":\"O:34:\\\"Illuminate\\\\Mail\\\\SendQueuedMailable\\\":15:{s:8:\\\"mailable\\\";O:44:\\\"App\\\\Mail\\\\Web\\\\WebRawRequestCommissionReceived\\\":3:{s:17:\\\"requestCommission\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:38:\\\"App\\\\Models\\\\Web\\\\WebRawRequestCommission\\\";s:2:\\\"id\\\";i:232;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:2:\\\"to\\\";a:1:{i:0;a:2:{s:4:\\\"name\\\";N;s:7:\\\"address\\\";s:15:\\\"asd.asd@sdf.dsf\\\";}}s:6:\\\"mailer\\\";s:4:\\\"smtp\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:13:\\\"maxExceptions\\\";N;s:17:\\\"shouldBeEncrypted\\\";b:0;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;s:3:\\\"job\\\";N;}\"},\"createdAt\":1787741674,\"delay\":null}', 'Illuminate\\Database\\Eloquent\\ModelNotFoundException: No query results for model [App\\Models\\Web\\WebRawRequestCommission]. in /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Database/Eloquent/Builder.php:750\nStack trace:\n#0 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/SerializesAndRestoresModelIdentifiers.php(110): Illuminate\\Database\\Eloquent\\Builder->firstOrFail()\n#1 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/SerializesAndRestoresModelIdentifiers.php(63): App\\Mail\\Web\\WebRawRequestCommissionReceived->restoreModel()\n#2 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/SerializesModels.php(97): App\\Mail\\Web\\WebRawRequestCommissionReceived->getRestoredPropertyValue()\n#3 [internal function]: App\\Mail\\Web\\WebRawRequestCommissionReceived->__unserialize()\n#4 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(95): unserialize()\n#5 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(62): Illuminate\\Queue\\CallQueuedHandler->getCommand()\n#6 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Jobs/Job.php(102): Illuminate\\Queue\\CallQueuedHandler->call()\n#7 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(444): Illuminate\\Queue\\Jobs\\Job->fire()\n#8 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(394): Illuminate\\Queue\\Worker->process()\n#9 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(180): Illuminate\\Queue\\Worker->runJob()\n#10 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(148): Illuminate\\Queue\\Worker->daemon()\n#11 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(131): Illuminate\\Queue\\Console\\WorkCommand->runWorker()\n#12 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Queue\\Console\\WorkCommand->handle()\n#13 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#14 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure()\n#15 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod()\n#16 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Container.php(754): Illuminate\\Container\\BoundMethod::call()\n#17 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Console/Command.php(211): Illuminate\\Container\\Container->call()\n#18 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Command/Command.php(318): Illuminate\\Console\\Command->execute()\n#19 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Console/Command.php(180): Symfony\\Component\\Console\\Command\\Command->run()\n#20 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(1092): Illuminate\\Console\\Command->run()\n#21 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(341): Symfony\\Component\\Console\\Application->doRunCommand()\n#22 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(192): Symfony\\Component\\Console\\Application->doRun()\n#23 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(197): Symfony\\Component\\Console\\Application->run()\n#24 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(1234): Illuminate\\Foundation\\Console\\Kernel->handle()\n#25 /home/joncl/prg/Typescript/rp_website/api/artisan(16): Illuminate\\Foundation\\Application->handleCommand()\n#26 {main}', '2026-08-26 10:55:00');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `legal_site_settings`
--

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

--
-- Dumping data for table `legal_site_settings`
--

INSERT INTO `legal_site_settings` (`id`, `company_name`, `ico`, `dic`, `google_analytics_id`, `brand_tagline`, `brand_tagline_i18n`, `copyright_text`, `copyright_text_i18n`, `contact_email`, `contact_phone`, `address`, `footer_text`, `logo_path`, `updated_at`) VALUES
(1, 'Joncletika, s.r.o.', '25133161', 'CZ25133161', 'G-TEST123456', 'Tvoříme digitální produkty, na které jste hrdí. - TEST', '{\"cz\":\"Tvo\\u0159\\u00edme digit\\u00e1ln\\u00ed produkty, na kter\\u00e9 jste hrd\\u00ed. - TEST\",\"en\":\"Creating digital products you can be proud of.\"}', '© 2026 RegioPartner, s.r.o. | Vytvořeno & Spravováno RPSW', '{\"cz\":\"\\u00a9 2026 RegioPartner, s.r.o. | Vytvo\\u0159eno & Spravov\\u00e1no RPSW\",\"en\":\"\\u00a9 2026 RegioPartner, s.r.o. | Created & Powered by RPSW\"}', 'gamber@rpsw.cz', '733 188 328', 'Kytlická 862/6, 190 00 Praha', '©2026 RegioPartner, s.r.o., Všechna práva vyhrazena.', 'site-logos/dJxyZbRjvhFROyCtxEyx5JdTY2AwVZBrl2vuAt0X.png', '2026-08-10 18:19:58');

-- --------------------------------------------------------

--
-- Table structure for table `legal_social_links`
--

CREATE TABLE `legal_social_links` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `url` varchar(255) NOT NULL,
  `icon_path` varchar(255) NOT NULL,
  `position` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `legal_social_links`
--

INSERT INTO `legal_social_links` (`id`, `name`, `url`, `icon_path`, `position`, `created_at`, `updated_at`) VALUES
(2, 'Instagram', 'https://www.instagram.com/rpsw.cz', 'social-icons/EqJdhL4hXthHqtVw4tlDlQgz6JDoJ3rQjDTVPesV.png', 1, '2026-06-13 09:24:35', '2026-06-13 11:44:13');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(10, '2025_07_10_155210_create_personal_access_tokens_table', 3),
(11, '2025_07_15_101409_create_refresh_tokens_table', 3),
(12, '2025_07_10_075603_create_raw_request_commissions_table', 4),
(13, '2026_07_26_120000_recreate_password_reset_tokens_table', 5);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token_hash` varchar(64) NOT NULL COMMENT 'SHA-256 hash raw tokenu, nikdy raw hodnota',
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `used_at` timestamp NULL DEFAULT NULL COMMENT 'NULL = dosud nepoužitý',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `password_reset_tokens`
--

INSERT INTO `password_reset_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`) VALUES
(8, 34, '3332713ea59d425c9776eb4830344e203c5801f67323798ab47a53d95323b869', '2026-07-26 19:28:05', '2026-07-26 19:28:05', '2026-07-26 19:27:03'),
(15, 25, '731576aa255ecc4ec0b9a56df2c4a85e04f2f03545b6a5abf8e7104cbb6289a3', '2026-08-24 07:34:42', NULL, '2026-08-24 07:19:42');

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

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

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(87, 'App\\Models\\User', 59, 'access-token', 'c58f7b40a4862562dc033216ec4ba476336d5cc77af42b57e8a6721e0c735545', '[\"*\"]', '2026-02-15 22:41:38', '2026-02-15 23:11:38', '2026-02-15 22:41:38', '2026-02-15 22:41:38'),
(134, 'App\\Models\\User', 62, 'access-token', '696da6ddfce759f43fcd6c430016ffff654238b4bd746c50642599a4b68a1cd7', '[\"*\"]', '2026-02-18 02:12:13', '2026-02-18 03:12:09', '2026-02-18 02:12:09', '2026-02-18 02:12:13'),
(172, 'App\\Models\\User', 77, 'access-token', 'f783051fdb88711a863e9ccd4e5176a5a3f2a3606204c816754c3227d07698f8', '[\"*\"]', '2026-02-25 00:08:53', '2026-02-25 00:42:29', '2026-02-24 23:42:29', '2026-02-25 00:08:53'),
(591, 'App\\Models\\User', 34, 'access-token', '68783429471135aedb98b9dd0c6fea1dda24afe7d6cbb225d9e9a8ab20236672', '[\"*\"]', '2026-07-26 20:10:52', '2026-07-26 21:08:21', '2026-07-26 20:08:21', '2026-07-26 20:10:52'),
(695, 'App\\Models\\User', 86, 'access-token', 'c01dd389ec650634ad228e9a6534e6391de2ed139c2a50bae4be0e9f48265c71', '[\"*\"]', '2026-08-11 12:34:19', '2026-08-11 13:34:19', '2026-08-11 12:34:19', '2026-08-11 12:34:19'),
(913, 'App\\Models\\User', 25, 'access-token', 'dda5373e155e5694d38753ebbf7b60e3831d20c9ac2f1a25ce4cd04c49721573', '[\"*\"]', '2026-08-26 11:14:05', '2026-08-26 12:14:05', '2026-08-26 11:14:05', '2026-08-26 11:14:05');

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `refresh_tokens`
--

INSERT INTO `refresh_tokens` (`id`, `user_id`, `token`, `expires_at`, `created_at`, `updated_at`) VALUES
(912, 25, 'e0f708fa240b16ef0c44251692db90fbaa0a4b75acfb3e282d5acea0e7c7cc99', '2026-09-02 11:14:05', '2026-08-26 11:14:05', '2026-08-26 11:14:05');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shop_categories`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_coupons`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_customers`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_logs`
--

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

--
-- Dumping data for table `shop_logs`
--

INSERT INTO `shop_logs` (`id`, `created_at`, `origin`, `event_type`, `module`, `description`, `affected_entity_type`, `affected_entity_id`, `user_id`, `context_data`, `user_id_plain`, `user_plain`) VALUES
(1, '2026-08-25 23:48:06', '127.0.0.1', 'create', 'ShopSupplier', 'Vytvořen dodavatel: fonetika', 'ShopSupplier', 11, 25, '{\"name\":\"fonetika\",\"ico\":null,\"contact_person\":null,\"email\":null,\"phone\":null,\"address\":null,\"city\":null,\"postal_code\":null,\"country\":null,\"payment_terms\":null,\"is_active\":\"1\",\"notes\":null}', '25', 'jonasbucina@rpsw.cz'),
(2, '2026-08-25 23:48:16', '127.0.0.1', 'create', 'ShopSupplier', 'Vytvořen dodavatel: joner', 'ShopSupplier', 12, 25, '{\"name\":\"joner\",\"ico\":null,\"contact_person\":null,\"email\":null,\"phone\":null,\"address\":null,\"city\":null,\"postal_code\":null,\"country\":null,\"payment_terms\":null,\"is_active\":\"1\",\"notes\":null}', '25', 'jonasbucina@rpsw.cz');

-- --------------------------------------------------------

--
-- Table structure for table `shop_orders`
--

CREATE TABLE `shop_orders` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
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

-- --------------------------------------------------------

--
-- Table structure for table `shop_order_items`
--

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
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shop_payments`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_payment_logs`
--

CREATE TABLE `shop_payment_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `payment_id` int(10) UNSIGNED NOT NULL,
  `old_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) NOT NULL,
  `gateway_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`gateway_response`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shop_payment_methods`
--

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

--
-- Dumping data for table `shop_payment_methods`
--

INSERT INTO `shop_payment_methods` (`id`, `code`, `name`, `image_path`, `description`, `price`, `provider`, `is_external`, `bank_account_number`, `bank_account_code`, `bank_iban`, `bank_swift_bic`, `variable_symbol_type`, `config`, `is_active`, `sort_order`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'bank_transfer_cz', 'Bankovní převod (CZ)', 'payment-methods-images/bank-transfer-cz.png', 'Platba převodem v CZK v rámci ČR. Podklady k platbě a QR kód obdržíte v potvrzení objednávky.', 0.00, 'manual', 0, '2201992201', '2010', 'CZ6820100000002201992201', 'FIOBCZPPXXX', 'order_number', '{}', 0, 1, '2026-06-01 17:17:01', '2026-06-01 20:33:07', NULL),
(2, 'bank_transfer_sepa', 'Bankovní převod (EUR / SEPA)', 'payment-methods-images/bank_transfer_eu.svg', 'Platba v EUR prostřednictvím SEPA platby. Vhodné pro zákazníky ze Slovenska a EU.', 0.00, 'manual', 0, NULL, NULL, 'SK1220100000002201992202', 'FIOBCZPPXXX', 'order_number', '{}', 0, 2, '2026-06-01 17:17:01', '2026-06-01 20:32:59', NULL),
(3, 'stripe_card', 'Platba kartou online', 'payment-methods-images/stripe-card.png', 'Rychlá a bezpečná platba kartou Visa, MasterCard nebo Maestro přes bránu Stripe.', 0.00, 'stripe', 1, NULL, NULL, NULL, NULL, 'none', '{\"public_key\": \"\", \"secret_key\": \"\", \"webhook_secret\": \"\"}', 1, 3, '2026-06-01 17:17:01', '2026-06-01 20:23:08', NULL),
(4, 'apple_pay', 'Apple Pay', 'payment-methods-images/apple-pay.png', 'Rychlá platba pomocí Apple Wallet pro zařízení Apple (iPhone, iPad, Mac).', 0.00, 'stripe', 1, NULL, NULL, NULL, NULL, 'none', '{\"public_key\":null,\"secret_key\":null,\"webhook_secret\":null}', 1, 4, '2026-06-01 17:17:01', '2026-06-20 10:05:06', NULL),
(5, 'paypal', 'PayPal', 'payment-methods-images/paypal.png', 'Platba přes celosvětový platební systém PayPal (účet nebo rychlá platba kartou).', 0.00, 'paypal', 1, NULL, NULL, NULL, NULL, 'none', '{\"client_id\":null,\"secret_key\":null,\"mode\":\"sandbox\"}', 0, 6, '2026-06-01 17:17:01', '2026-06-16 19:18:41', NULL),
(6, 'cash_on_delivery', 'Platba při převzetí (Dobírka)', 'payment-methods-images/cash-on-delivery.png', 'Zaplatíte hotově nebo kartou kurýrovi při převzetí zásilky na vaší adrese.', 49.00, 'manual', 0, NULL, NULL, NULL, NULL, 'none', '{}', 0, 7, '2026-06-01 17:17:01', '2026-06-01 20:17:49', NULL),
(7, 'cash', 'Hotovost při osobním odběru', 'payment-methods-images/cash.png', 'Platba v hotovosti na naší pobočce při vyzvednutí zboží.', 0.00, 'manual', 0, NULL, NULL, NULL, NULL, 'none', '{}', 0, 8, '2026-06-01 17:17:01', '2026-06-01 20:17:29', NULL),
(8, 'google_pay', 'Google Pay', 'payment-methods-images/google-pay.png', 'Okamžitá platba pomocí Google peněženky pro Android zařízení a prohlížeč Chrome.', 0.00, 'stripe', 1, NULL, NULL, NULL, NULL, 'none', '{\"public_key\":null,\"secret_key\":null,\"webhook_secret\":null}', 0, 5, '2026-06-01 17:17:01', '2026-06-16 19:18:32', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `shop_products`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_product_categories`
--

CREATE TABLE `shop_product_categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = primární kategorie (kopíruje category_id)',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shop_product_images`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_product_prices`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_product_variants`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_reviews`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_shipping_methods`
--

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

--
-- Dumping data for table `shop_shipping_methods`
--

INSERT INTO `shop_shipping_methods` (`id`, `code`, `name`, `description`, `shipping_type`, `base_price`, `free_shipping_threshold`, `max_weight`, `requires_pickup_point`, `allows_cod`, `cod_price`, `tracking_url`, `logo_path`, `delivery_days_min`, `delivery_days_max`, `is_active`, `sort_order`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'local_pickup', 'Osobní vyzvednutí', 'Vyzvedněte si objednávku osobně na naší centrální pobočce. Zdarma a bez čekání.', 'store', 0.00, 0.00, NULL, 0, 1, 0.00, NULL, NULL, NULL, NULL, 1, 1, '2026-06-12 07:42:17', '2026-06-12 07:42:17', NULL),
(2, 'closest_carrier', 'Doručení na adresu (nejbližší dopravce)', 'Automaticky vybereme nejrychlejšího a nejspolehlivějšího dopravce pro vaši doručovací adresu po celé Evropě.', 'address', 120.00, 2500.00, 30.00, 0, 1, 40.00, NULL, NULL, NULL, NULL, 1, 2, '2026-06-12 07:42:17', '2026-06-12 07:42:17', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `shop_site_settings`
--

CREATE TABLE `shop_site_settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `is_shop_active` tinyint(1) NOT NULL DEFAULT 1,
  `maintenance_message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shop_site_settings`
--

INSERT INTO `shop_site_settings` (`id`, `is_shop_active`, `maintenance_message`, `created_at`, `updated_at`) VALUES
(1, 0, 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.', '2026-06-12 11:42:21', '2026-08-15 16:21:24');

-- --------------------------------------------------------

--
-- Table structure for table `shop_suppliers`
--

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

--
-- Dumping data for table `shop_suppliers`
--

INSERT INTO `shop_suppliers` (`id`, `name`, `ico`, `contact_person`, `email`, `phone`, `address`, `city`, `postal_code`, `country`, `payment_terms`, `is_active`, `notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(11, 'fonetika', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, '2026-08-25 21:48:06', '2026-08-25 21:48:06', NULL),
(12, 'joner', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL, '2026-08-25 21:48:16', '2026-08-25 21:48:16', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `two_factor_codes`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

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

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `user_email`, `full_name`, `dpp_hours_spent`, `enable_2fa`, `is_blocked`, `activated_at`, `two_fa_forced_by_admin`, `internal_note`, `user_password_hash`, `user_password_salt`, `last_login_at`, `created_at`, `updated_at`, `deleted_at`, `is_deleted`) VALUES
(25, 'jonasbucina@rpsw.cz', 'Jonáš Bučina', 0, 1, 0, '2026-08-24 09:42:32', 0, NULL, '$2y$12$MF8zzdDCIKktF2CN3QjzDuTr3i1krOrgJIYEy5WeVHbiuIwZ7QdbG', NULL, '2026-08-26 10:47:43', '2026-02-14 08:12:31', '2026-08-26 10:47:43', NULL, 0),
(34, 'lindicka@mazliva.cz', 'Lindička Trýbíčková Mazliva', 0, 1, 0, '2026-08-24 09:30:24', 0, NULL, '$2y$12$Xni0XZTdDsb22F686yDryefjAJKvlDDnh9G646kl90dDjwGLvSqtS', NULL, '2026-08-11 00:55:27', '2026-02-14 08:12:31', '2026-08-24 11:30:49', NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `role_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
(25, 1),
(34, 2);

-- --------------------------------------------------------

--
-- Table structure for table `web_attachments`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_external_links`
--

CREATE TABLE `web_external_links` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `url` varchar(500) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `web_job_applications`
--

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
  `state` varchar(50) DEFAULT 'Nový',
  `internal_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `web_logs`
--

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

--
-- Dumping data for table `web_logs`
--

INSERT INTO `web_logs` (`id`, `created_at`, `origin`, `event_type`, `module`, `description`, `affected_entity_type`, `affected_entity_id`, `user_id`, `context_data`, `user_id_plain`, `user_plain`) VALUES
(1, '2026-08-23 10:48:45', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 3 požadavků (požadováno 3, ID: 187,185,186).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[187,185,186]}', '25', 'jonasbucina@rpsw.cz'),
(2, '2026-08-23 10:48:59', '127.0.0.1', 'export_json', 'web/logs', 'User exported 1 selected records (JSON) from table: Seznam událostí systému.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(3, '2026-08-23 10:50:42', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 5 požadavků, přeskočeno 0 (soubor \'import-validni.json\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":15}', '25', 'jonasbucina@rpsw.cz'),
(4, '2026-08-23 10:51:22', '127.0.0.1', 'export_json', 'web/logs', 'User exported 1 selected records (JSON) from table: Seznam událostí systému.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(5, '2026-08-23 11:44:53', '127.0.0.1', 'export_csv', 'web/raw_request_commissions', 'User exported 9 records (CSV) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(6, '2026-08-23 12:54:18', '127.0.0.1', 'export_raw_txt', 'web/raw_request_commissions', 'User exported 9 records (TXT, RAW/import-compatible) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(7, '2026-08-23 12:54:41', '127.0.0.1', 'export_raw_json', 'web/raw_request_commissions', 'User exported 9 records (JSON, RAW/import-compatible) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(8, '2026-08-23 12:54:52', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 9 požadavků (požadováno 9, ID: 192,191,190,189,188,184,183,177,176).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[192,191,190,189,188,184,183,177,176]}', '25', 'jonasbucina@rpsw.cz'),
(9, '2026-08-23 12:55:05', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 9 požadavků, přeskočeno 0 (soubor \'Seznam aktivních požadavků-raw.txt\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":16}', '25', 'jonasbucina@rpsw.cz'),
(10, '2026-08-23 12:59:34', '127.0.0.1', 'export_json', 'web/raw_request_commissions', 'User exported 9 records (JSON) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(11, '2026-08-23 13:00:35', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 9 požadavků, přeskočeno 0 (soubor \'Seznam aktivních požadavků-raw.json\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":17}', '25', 'jonasbucina@rpsw.cz'),
(12, '2026-08-23 13:02:26', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 15 požadavků (požadováno 15, ID: 210,209,208,207,206,205,204,203,202,201,200,199,198,197,196).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[210,209,208,207,206,205,204,203,202,201,200,199,198,197,196]}', '25', 'jonasbucina@rpsw.cz'),
(13, '2026-08-23 13:02:34', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 3 požadavků (požadováno 3, ID: 195,194,193).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[195,194,193]}', '25', 'jonasbucina@rpsw.cz'),
(14, '2026-08-23 13:02:45', '127.0.0.1', 'force_delete_all', 'WebRawRequestCommission', 'Hromadné smazání koše provizí. Počet: 152', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(15, '2026-08-23 13:08:24', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sakdsa.md', 'WebRawRequestCommission', 211, 25, '{\"thema\":\"sakdsa.md\",\"contact_email\":\"sdf@sdf.cu\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sfsdfsdffsf\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(16, '2026-08-23 13:08:34', '127.0.0.1', 'export_raw_csv', 'web/raw_request_commissions', 'User exported 1 selected records (CSV, RAW/import-compatible) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(17, '2026-08-23 13:08:47', '127.0.0.1', 'soft_delete', 'WebRawRequestCommission', 'Smazání požadavku na provizi ID: 211', 'WebRawRequestCommission', 211, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(18, '2026-08-23 13:12:43', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 1 požadavků, přeskočeno 0 (soubor \'Seznam aktivních požadavků-vybrane-raw.csv\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":18}', '25', 'jonasbucina@rpsw.cz'),
(19, '2026-08-23 13:20:21', '127.0.0.1', 'export_raw_txt', 'web/raw_request_commissions', 'User exported 1 selected records (TXT, RAW/import-compatible) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(20, '2026-08-23 13:20:37', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 1 požadavků, přeskočeno 0 (soubor \'Seznam aktivních požadavků-vybrane-raw.txt\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":19}', '25', 'jonasbucina@rpsw.cz'),
(21, '2026-08-23 13:20:46', '127.0.0.1', 'export_raw_json', 'web/raw_request_commissions', 'User exported 2 selected records (JSON, RAW/import-compatible) from table: Seznam aktivních požadavků.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(22, '2026-08-23 13:20:58', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 2 požadavků, přeskočeno 0 (soubor \'Seznam aktivních požadavků-vybrane-raw.json\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":20}', '25', 'jonasbucina@rpsw.cz'),
(23, '2026-08-23 13:21:10', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 3 požadavků (požadováno 3, ID: 214,213,212).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[214,213,212]}', '25', 'jonasbucina@rpsw.cz'),
(24, '2026-08-23 13:21:48', '127.0.0.1', 'import', 'WebRawRequestCommission', 'Hromadný import: přidáno 1 požadavků, přeskočeno 1 (soubor \'Seznam aktivních požadavků-vybrane-raw.json\').', 'WebRawRequestCommission', NULL, 25, '{\"import_token\":21}', '25', 'jonasbucina@rpsw.cz'),
(25, '2026-08-23 14:57:23', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: test', 'WebNews', 19, 25, '{\"title\":\"test\",\"thema\":\"Miln\\u00edk\",\"author\":\"sdfsdf\",\"message\":\"asdasdasd\",\"bullet_1\":null,\"bullet_2\":null,\"bullet_3\":null,\"bullet_4\":null}', '25', 'jonasbucina@rpsw.cz'),
(26, '2026-08-23 14:57:33', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: askdmakmdalsd', 'WebNews', 20, 25, '{\"title\":\"askdmakmdalsd\",\"thema\":\"Miln\\u00edk\",\"author\":\"asdasdad\",\"message\":\"asdaspld\\u016fa\\u00a7d\",\"bullet_1\":null,\"bullet_2\":null,\"bullet_3\":null,\"bullet_4\":null}', '25', 'jonasbucina@rpsw.cz'),
(27, '2026-08-23 14:57:54', '127.0.0.1', 'soft_delete_bulk', 'WebNews', 'Hromadné smazání 2 novinek (požadováno 2, ID: 20,19).', 'WebNews', NULL, 25, '{\"ids\":[20,19]}', '25', 'jonasbucina@rpsw.cz'),
(28, '2026-08-23 14:58:09', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: askdmakmdalsd', 'WebNews', 20, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(29, '2026-08-23 14:58:12', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: test', 'WebNews', 19, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(30, '2026-08-23 14:58:34', '127.0.0.1', 'export_csv', 'web/news', 'User exported 2 records (CSV) from table: Seznam aktualit a novinek.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(31, '2026-08-23 15:47:22', '127.0.0.1', 'soft_delete_bulk', 'WebNews', 'Hromadné smazání 2 novinek (požadováno 2, ID: 20,19).', 'WebNews', NULL, 25, '{\"ids\":[20,19]}', '25', 'jonasbucina@rpsw.cz'),
(32, '2026-08-23 15:47:27', '127.0.0.1', 'force_delete_all', 'WebNews', 'Hromadné smazání koše novinek. Počet: 4', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(33, '2026-08-23 15:56:05', '127.0.0.1', 'create', 'WebSupportTicket', 'Nový ticket: test', 'WebSupportTicket', 23, 25, '{\"subject\":\"test\",\"category\":\"it\",\"priority\":\"low\",\"description\":\"asdsdsf\",\"attachment\":null}', '25', 'jonasbucina@rpsw.cz'),
(34, '2026-08-23 15:56:19', '127.0.0.1', 'create', 'WebSupportTicket', 'Nový ticket: s.sfs,dfm.sd', 'WebSupportTicket', 24, 25, '{\"subject\":\"s.sfs,dfm.sd\",\"category\":\"obchod\",\"priority\":\"medium\",\"description\":\"sdssdf\",\"attachment\":null}', '25', 'jonasbucina@rpsw.cz'),
(35, '2026-08-23 15:56:26', '127.0.0.1', 'export', 'WebSupportTicket', 'Hromadný export support ticketů.', NULL, NULL, 25, '{\"sort_by\":\"id\",\"sort_direction\":\"desc\",\"no_pagination\":\"true\"}', '25', 'jonasbucina@rpsw.cz'),
(36, '2026-08-23 15:56:27', '127.0.0.1', 'export_csv', 'web/support_tickets', 'User exported 2 records (CSV) from table: Seznam Support Ticketů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(37, '2026-08-23 15:56:42', '127.0.0.1', 'export', 'WebSupportTicket', 'Hromadný export support ticketů.', NULL, NULL, 25, '{\"sort_by\":\"id\",\"sort_direction\":\"desc\",\"no_pagination\":\"true\"}', '25', 'jonasbucina@rpsw.cz'),
(38, '2026-08-23 15:56:42', '127.0.0.1', 'export_raw_csv', 'web/support_tickets', 'User exported 2 records (CSV, RAW/import-compatible) from table: Seznam Support Ticketů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(39, '2026-08-23 15:57:03', '127.0.0.1', 'import', 'WebSupportTicket', 'Hromadný import: přidáno 2 ticketů, přeskočeno 0 (soubor \'Seznam Support Ticketů-raw.csv\').', 'WebSupportTicket', NULL, 25, '{\"import_token\":22}', '25', 'jonasbucina@rpsw.cz'),
(40, '2026-08-23 19:52:32', '127.0.0.1', 'export', 'WebSupportTicket', 'Hromadný export support ticketů.', NULL, NULL, 25, '{\"sort_by\":\"id\",\"sort_direction\":\"desc\",\"no_pagination\":\"true\"}', '25', 'jonasbucina@rpsw.cz'),
(41, '2026-08-23 19:52:33', '127.0.0.1', 'export_json', 'web/support_tickets', 'User exported 4 records (JSON) from table: Seznam Support Ticketů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(42, '2026-08-23 19:52:52', '127.0.0.1', 'export_raw_csv', 'web/support_tickets', 'User exported 3 selected records (CSV, RAW/import-compatible) from table: Seznam Support Ticketů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(43, '2026-08-23 19:53:05', '127.0.0.1', 'import', 'WebSupportTicket', 'Hromadný import: přidáno 3 ticketů, přeskočeno 0 (soubor \'Seznam Support Ticketů-vybrane-raw.csv\').', 'WebSupportTicket', NULL, 25, '{\"import_token\":23}', '25', 'jonasbucina@rpsw.cz'),
(44, '2026-08-23 20:01:01', '127.0.0.1', 'create', 'WebSalesLead', 'Vytvořen nový lead: kaslkda', 'WebSalesLead', 23, 25, '{\"subject_name\":\"kaslkda\",\"user_id\":null,\"salesman_name\":null,\"contact_other\":null,\"source_url\":null,\"first_contact_date\":null,\"contact_person\":null,\"contact_email\":null,\"contact_phone\":null,\"location\":null,\"source_channel\":\"LinkedIn - Direct Message\",\"status\":\"Nov\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"last_contact_date\":null,\"next_step\":null,\"description\":null}', '25', 'jonasbucina@rpsw.cz'),
(45, '2026-08-23 20:01:08', '127.0.0.1', 'export', 'WebSalesLead', 'Hromadný export obchodních leadů.', NULL, NULL, 25, '{\"sort_by\":\"id\",\"sort_direction\":\"desc\",\"no_pagination\":\"true\"}', '25', 'jonasbucina@rpsw.cz'),
(46, '2026-08-23 20:01:08', '127.0.0.1', 'export_raw_csv', 'web/sales_leads', 'User exported 1 records (CSV, RAW/import-compatible) from table: Seznam obchodních příležitostí.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(47, '2026-08-23 20:03:23', '127.0.0.1', 'export', 'WebSalesLead', 'Hromadný export obchodních leadů.', NULL, NULL, 25, '{\"sort_by\":\"id\",\"sort_direction\":\"desc\",\"no_pagination\":\"true\"}', '25', 'jonasbucina@rpsw.cz'),
(48, '2026-08-23 20:03:23', '127.0.0.1', 'export_raw_csv', 'web/sales_leads', 'User exported 1 records (CSV, RAW/import-compatible) from table: Seznam obchodních příležitostí.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(49, '2026-08-23 20:03:37', '127.0.0.1', 'import', 'WebSalesLead', 'Hromadný import: přidáno 1 leadů, přeskočeno 0 (soubor \'Seznam obchodních příležitostí-raw.csv\').', 'WebSalesLead', NULL, 25, '{\"import_token\":24}', '25', 'jonasbucina@rpsw.cz'),
(50, '2026-08-23 20:21:35', '127.0.0.1', 'create', 'Web', 'Vytvořen externí odkaz: asd', 'CoreExternalLink', 14, 25, '{\"name\":\"asd\",\"url\":\"https:\\/\\/analytics.google.com\",\"position\":null,\"is_active\":\"1\"}', '25', 'jonasbucina@rpsw.cz'),
(51, '2026-08-23 20:41:06', '127.0.0.1', 'create', 'Web', 'Vytvořen externí odkaz: kfmsdjfsd', 'CoreExternalLink', 15, 25, '{\"name\":\"kfmsdjfsd\",\"url\":\"https:\\/\\/analytics.google.com\",\"position\":null,\"is_active\":\"1\"}', '25', 'jonasbucina@rpsw.cz'),
(52, '2026-08-23 20:41:18', '127.0.0.1', 'soft_delete_bulk', 'Web', 'Hromadné smazání 2 externích odkazů (požadováno 2, ID: 14,15).', 'CoreExternalLink', NULL, 25, '{\"ids\":[14,15]}', '25', 'jonasbucina@rpsw.cz'),
(53, '2026-08-23 20:41:24', '127.0.0.1', 'force_delete_all', 'Web', 'Trvale smazáno 2 externích odkazů z koše', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(54, '2026-08-23 20:44:59', '127.0.0.1', 'export_json', 'shop/suppliers', 'User exported 2 selected records (JSON) from table: Seznam aktivních dodavatelů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(55, '2026-08-23 20:45:11', '127.0.0.1', 'export_raw_csv', 'shop/suppliers', 'User exported 2 selected records (CSV, RAW/import-compatible) from table: Seznam aktivních dodavatelů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(56, '2026-08-23 22:08:43', '127.0.0.1', 'create', 'Web', 'Vytvořen externí odkaz: asd,nas,d', 'CoreExternalLink', 16, 25, '{\"name\":\"asd,nas,d\",\"url\":\"https:\\/\\/analytics.google.com\",\"position\":null,\"is_active\":\"1\"}', '25', 'jonasbucina@rpsw.cz'),
(57, '2026-08-23 22:08:52', '127.0.0.1', 'soft_delete', 'Web', 'Smazán externí odkaz: asd,nas,d', 'CoreExternalLink', 16, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(58, '2026-08-25 16:34:11', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 2 požadavků (požadováno 2, ID: 216,215).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[216,215]}', '25', 'jonasbucina@rpsw.cz'),
(59, '2026-08-25 16:34:28', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: testsdfsf', 'WebRawRequestCommission', 217, 25, '{\"thema\":\"testsdfsf\",\"contact_email\":\"sfd@sdf.cu\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"dasdksjdk\\u016f\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(60, '2026-08-25 16:34:28', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: testsdfsf', 'WebRawRequestCommission', 218, 25, '{\"thema\":\"testsdfsf\",\"contact_email\":\"sfd@sdf.cu\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"dasdksjdk\\u016f\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(61, '2026-08-25 16:34:38', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 2 požadavků (požadováno 2, ID: 218,217).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[218,217]}', '25', 'jonasbucina@rpsw.cz'),
(62, '2026-08-25 16:35:19', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: kfsdf', 'WebRawRequestCommission', 219, 25, '{\"thema\":\"kfsdf\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdlfsd\\u016ffkdsl\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(63, '2026-08-25 16:35:20', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: kfsdf', 'WebRawRequestCommission', 220, 25, '{\"thema\":\"kfsdf\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdlfsd\\u016ffkdsl\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(64, '2026-08-25 16:35:20', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: kfsdf', 'WebRawRequestCommission', 221, 25, '{\"thema\":\"kfsdf\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdlfsd\\u016ffkdsl\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(65, '2026-08-25 16:35:21', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: kfsdf', 'WebRawRequestCommission', 222, 25, '{\"thema\":\"kfsdf\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdlfsd\\u016ffkdsl\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(66, '2026-08-25 16:35:21', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: kfsdf', 'WebRawRequestCommission', 223, 25, '{\"thema\":\"kfsdf\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdlfsd\\u016ffkdsl\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(67, '2026-08-25 16:41:18', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 5 požadavků (požadováno 5, ID: 223,222,221,220,219).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[223,222,221,220,219]}', '25', 'jonasbucina@rpsw.cz'),
(68, '2026-08-25 16:41:27', '127.0.0.1', 'force_delete_all', 'WebRawRequestCommission', 'Hromadné smazání koše provizí. Počet: 13', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(69, '2026-08-25 16:46:45', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sdkfmsd.f', 'WebRawRequestCommission', 224, 25, '{\"thema\":\"sdkfmsd.f\",\"contact_email\":\"dgfd@dfg.z\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"slkfsd\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(70, '2026-08-25 16:46:45', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sdkfmsd.f', 'WebRawRequestCommission', 225, 25, '{\"thema\":\"sdkfmsd.f\",\"contact_email\":\"dgfd@dfg.z\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"slkfsd\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(71, '2026-08-25 16:46:46', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sdkfmsd.f', 'WebRawRequestCommission', 226, 25, '{\"thema\":\"sdkfmsd.f\",\"contact_email\":\"dgfd@dfg.z\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"slkfsd\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(72, '2026-08-25 16:46:46', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sdkfmsd.f', 'WebRawRequestCommission', 227, 25, '{\"thema\":\"sdkfmsd.f\",\"contact_email\":\"dgfd@dfg.z\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"slkfsd\\u016ff\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(73, '2026-08-25 16:47:05', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 4 požadavků (požadováno 4, ID: 227,226,225,224).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[227,226,225,224]}', '25', 'jonasbucina@rpsw.cz'),
(74, '2026-08-25 16:47:42', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: asdn', 'WebRawRequestCommission', 228, 25, '{\"thema\":\"asdn\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"fks\\u016flfsdkf\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(75, '2026-08-25 16:47:58', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sdfmad', 'WebRawRequestCommission', 229, 25, '{\"thema\":\"sdfmad\",\"contact_email\":\"d@saf.cz\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"dsklfjsd\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(76, '2026-08-25 17:20:24', '127.0.0.1', 'export_json', 'core/security_events', 'User exported 15 records (JSON) from table: Bezpečnostní monitoring.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(77, '2026-08-25 23:03:32', '127.0.0.1', 'export_json', 'core/security_events', 'User exported 15 records (JSON) from table: Bezpečnostní monitoring.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(78, '2026-08-25 23:31:41', '127.0.0.1', 'create', 'Web', 'Vytvořen externí odkaz: Fonetický Express', 'CoreExternalLink', 17, 25, '{\"name\":\"Fonetick\\u00fd Express\",\"url\":\"https:\\/\\/analytics.google.com\",\"position\":null,\"is_active\":\"1\"}', '25', 'jonasbucina@rpsw.cz'),
(79, '2026-08-25 23:31:56', '127.0.0.1', 'create', 'Web', 'Vytvořen externí odkaz: jonas', 'CoreExternalLink', 18, 25, '{\"name\":\"jonas\",\"url\":\"https:\\/\\/www.google.com\\/?hl=cs\",\"position\":null,\"is_active\":\"1\"}', '25', 'jonasbucina@rpsw.cz'),
(80, '2026-08-26 11:33:13', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: asdaasd', 'WebRawRequestCommission', 230, 25, '{\"thema\":\"asdaasd\",\"contact_email\":\"dgfd@dfg.z\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"dsdsdsddsd\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(81, '2026-08-26 11:35:38', '127.0.0.1', 'create', 'WebSalesLead', 'Vytvořen nový lead: asdkasds', 'WebSalesLead', 25, 25, '{\"subject_name\":\"asdkasds\",\"user_id\":null,\"salesman_name\":null,\"contact_other\":null,\"source_url\":null,\"first_contact_date\":null,\"contact_person\":null,\"contact_email\":null,\"contact_phone\":null,\"location\":null,\"source_channel\":\"LinkedIn - Direct Message\",\"status\":\"Nov\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"last_contact_date\":null,\"next_step\":null,\"description\":null}', '25', 'jonasbucina@rpsw.cz'),
(82, '2026-08-26 12:44:25', '127.0.0.1', 'soft_delete', 'Web', 'Smazán externí odkaz: jonas', 'CoreExternalLink', 18, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(83, '2026-08-26 12:44:27', '127.0.0.1', 'soft_delete', 'Web', 'Smazán externí odkaz: Fonetický Express', 'CoreExternalLink', 17, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(84, '2026-08-26 12:44:34', '127.0.0.1', 'force_delete_all', 'Web', 'Trvale smazáno 3 externích odkazů z koše', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(85, '2026-08-26 12:46:31', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 3 požadavků (požadováno 3, ID: 230,229,228).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[230,229,228]}', '25', 'jonasbucina@rpsw.cz'),
(86, '2026-08-26 12:46:39', '127.0.0.1', 'force_delete_all', 'WebRawRequestCommission', 'Hromadné smazání koše provizí. Počet: 7', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(87, '2026-08-26 12:46:46', '127.0.0.1', 'soft_delete_bulk', 'WebSalesLead', 'Hromadné smazání 3 leadů (požadováno 3, ID: 25,24,23).', 'WebSalesLead', NULL, 25, '{\"ids\":[25,24,23]}', '25', 'jonasbucina@rpsw.cz'),
(88, '2026-08-26 12:46:53', '127.0.0.1', 'force_delete_all', 'WebSalesLead', 'Hromadné smazání koše leadů. Počet: 3', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(89, '2026-08-26 12:47:14', '127.0.0.1', 'soft_delete_bulk', 'WebSupportTicket', 'Hromadné smazání 7 ticketů (požadováno 7, ID: 29,28,27,26,25,24,23).', 'WebSupportTicket', NULL, 25, '{\"ids\":[29,28,27,26,25,24,23]}', '25', 'jonasbucina@rpsw.cz'),
(90, '2026-08-26 12:54:23', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: sdfsd', 'WebRawRequestCommission', 231, 25, '{\"thema\":\"sdfsd\",\"contact_email\":\"dgfd@dfg.z\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdfdsf\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(91, '2026-08-26 12:54:34', '127.0.0.1', 'create', 'WebRawRequestCommission', 'Vytvořen požadavek na provizi: asmnd', 'WebRawRequestCommission', 232, 25, '{\"thema\":\"asmnd\",\"contact_email\":\"asd.asd@sdf.dsf\",\"contact_phone\":null,\"status\":\"Nov\\u011b zadan\\u00e9\",\"priority\":\"N\\u00edzk\\u00e1\",\"order_description\":\"sdfsdfs\",\"note\":null,\"attachments\":[]}', '25', 'jonasbucina@rpsw.cz'),
(92, '2026-08-26 12:54:42', '127.0.0.1', 'soft_delete_bulk', 'WebRawRequestCommission', 'Hromadné smazání 2 požadavků (požadováno 2, ID: 232,231).', 'WebRawRequestCommission', NULL, 25, '{\"ids\":[232,231]}', '25', 'jonasbucina@rpsw.cz'),
(93, '2026-08-26 12:54:48', '127.0.0.1', 'force_delete_all', 'WebRawRequestCommission', 'Hromadné smazání koše provizí. Počet: 2', NULL, NULL, 25, '[]', '25', 'jonasbucina@rpsw.cz');

-- --------------------------------------------------------

--
-- Table structure for table `web_news`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_raw_request_commissions`
--

CREATE TABLE `web_raw_request_commissions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `thema` varchar(255) NOT NULL,
  `contact_email` varchar(255) NOT NULL,
  `contact_phone` varchar(255) DEFAULT NULL,
  `order_description` text NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'Nově zadané',
  `priority` varchar(255) NOT NULL DEFAULT 'Neutrální',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `note` text DEFAULT NULL,
  `lang` varchar(5) NOT NULL DEFAULT 'cz'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `web_sales_leads`
--

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
  `priority` varchar(255) DEFAULT 'Neutrální',
  `status` varchar(255) DEFAULT 'Nové',
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

-- --------------------------------------------------------

--
-- Table structure for table `web_sales_orders`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_site_settings`
--

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

--
-- Dumping data for table `web_site_settings`
--

INSERT INTO `web_site_settings` (`id`, `is_web_active`, `web_maintenance_message`, `created_at`, `updated_at`, `raw_request_email_title_i18n`, `raw_request_email_intro_i18n`, `raw_request_email_outro_i18n`, `raw_request_email_labels_i18n`, `raw_request_email_subject_i18n`) VALUES
(1, 1, 'Omlouváme se, web je momentálně v údržbě.', '2026-06-12 11:42:21', '2026-08-21 22:06:58', '{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Your request has been accepted\"}', '{\"cz\":\"d\\u011bkujeme za Va\\u0161i popt\\u00e1vku. Byla \\u00fasp\\u011b\\u0161n\\u011b p\\u0159ijate a n\\u00e1\\u0161 t\\u00fdm se j\\u00ed bude v nejbli\\u017e\\u0161\\u00ed dob\\u011b v\\u011bnovat.\",\"en\":\"thank you for order we will take look at it.\"}', '{\"cz\":\"V p\\u0159\\u00edpad\\u011b dotaz\\u016f n\\u00e1s nev\\u00e1hejte kontaktovat.\",\"en\":\"If you have questing contact us\"}', '{\"cz\":[],\"en\":{\"greeting\":\"Hello,\",\"summary_header\":\"Recapitulation\",\"label_thema\":\"Thema\",\"label_email\":\"Contact Email\",\"label_phone\":\"Telephone\",\"label_description\":\"Description\",\"label_attachments\":\"Accessments\",\"label_date\":\"Date\"}}', '{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Order information\"}');

-- --------------------------------------------------------

--
-- Table structure for table `web_support_tickets`
--

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

--
-- Dumping data for table `web_support_tickets`
--

INSERT INTO `web_support_tickets` (`id`, `user_id`, `user_name_plain`, `user_plain`, `category`, `priority`, `state`, `subject`, `description`, `attachment_path`, `attachment_original_name`, `created_at`, `updated_at`, `deleted_at`) VALUES
(23, 25, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'it', 'low', 'new', 'test', 'asdsdsf', NULL, NULL, '2026-08-23 13:56:05', '2026-08-26 10:47:14', '2026-08-26 10:47:14'),
(24, 25, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'obchod', 'medium', 'new', 's.sfs,dfm.sd', 'sdssdf', NULL, NULL, '2026-08-23 13:56:19', '2026-08-26 10:47:14', '2026-08-26 10:47:14'),
(25, NULL, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'obchod', 'medium', 'new', 's.sfs,dfm.sd', 'sdssdf', NULL, NULL, '2026-08-23 13:57:03', '2026-08-26 10:47:14', '2026-08-26 10:47:14'),
(26, NULL, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'it', 'low', 'new', 'test', 'asdsdsf', NULL, NULL, '2026-08-23 13:57:03', '2026-08-26 10:47:14', '2026-08-26 10:47:14'),
(27, NULL, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'it', 'low', 'new', 'test', 'asdsdsf', NULL, NULL, '2026-08-23 17:53:05', '2026-08-26 10:47:14', '2026-08-26 10:47:14'),
(28, NULL, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'obchod', 'medium', 'new', 's.sfs,dfm.sd', 'sdssdf', NULL, NULL, '2026-08-23 17:53:05', '2026-08-26 10:47:14', '2026-08-26 10:47:14'),
(29, NULL, 'Jonáš Bučina', 'jonasbucina@rpsw.cz', 'obchod', 'medium', 'new', 's.sfs,dfm.sd', 'sdssdf', NULL, NULL, '2026-08-23 17:53:05', '2026-08-26 10:47:14', '2026-08-26 10:47:14');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `account_activation_tokens`
--
ALTER TABLE `account_activation_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_activation_tokens_token_hash_unique` (`token_hash`),
  ADD KEY `account_activation_tokens_user_id_index` (`user_id`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `core_email_access_rules`
--
ALTER TABLE `core_email_access_rules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `core_email_access_rules_type_value_unique` (`type`,`value`);

--
-- Indexes for table `core_import_batches`
--
ALTER TABLE `core_import_batches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_import_batches_resource` (`resource`),
  ADD KEY `idx_import_batches_status` (`status`),
  ADD KEY `fk_import_batches_user_id` (`user_id`);

--
-- Indexes for table `core_logs`
--
ALTER TABLE `core_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_core_logs_user_id` (`user_id`);

--
-- Indexes for table `core_permissions`
--
ALTER TABLE `core_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_permission_key` (`permission_key`);

--
-- Indexes for table `core_roles`
--
ALTER TABLE `core_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `core_role_permissions`
--
ALTER TABLE `core_role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `fk_crp_permission_id` (`permission_id`);

--
-- Indexes for table `core_security_events`
--
ALTER TABLE `core_security_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_security_event_fingerprint` (`fingerprint`),
  ADD KEY `fk_security_events_user_id` (`user_id`),
  ADD KEY `idx_security_events_event_type` (`event_type`),
  ADD KEY `idx_security_events_last_seen_at` (`last_seen_at`);

--
-- Indexes for table `core_security_settings`
--
ALTER TABLE `core_security_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `document_sections`
--
ALTER TABLE `document_sections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_document_type` (`document_type_id`);

--
-- Indexes for table `document_types`
--
ALTER TABLE `document_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `legal_site_settings`
--
ALTER TABLE `legal_site_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `legal_social_links`
--
ALTER TABLE `legal_social_links`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `password_reset_tokens_token_hash_unique` (`token_hash`),
  ADD KEY `password_reset_tokens_user_id_used_at_index` (`user_id`,`used_at`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_unique` (`token`),
  ADD KEY `tokenable_index` (`tokenable_type`,`tokenable_id`);

--
-- Indexes for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token_unique` (`token`),
  ADD KEY `fk_refresh_user_id` (`user_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `shop_categories`
--
ALTER TABLE `shop_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_slug_per_level` (`slug`,`parent_id`),
  ADD KEY `idx_shop_categories_parent` (`parent_id`),
  ADD KEY `idx_shop_categories_active_sort` (`is_active`,`sort_order`);

--
-- Indexes for table `shop_coupons`
--
ALTER TABLE `shop_coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `shop_customers`
--
ALTER TABLE `shop_customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `fk_shop_customers_user` (`user_id`);

--
-- Indexes for table `shop_logs`
--
ALTER TABLE `shop_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_logs_user_id` (`user_id`);

--
-- Indexes for table `shop_orders`
--
ALTER TABLE `shop_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `fk_shop_orders_customer` (`customer_id`),
  ADD KEY `fk_shop_orders_coupon` (`coupon_id`),
  ADD KEY `fk_shop_orders_payment` (`payment_method_id`),
  ADD KEY `fk_shop_orders_shipping` (`shipping_method_id`);

--
-- Indexes for table `shop_order_items`
--
ALTER TABLE `shop_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_order_items_order` (`order_id`),
  ADD KEY `fk_shop_order_items_product` (`product_id`),
  ADD KEY `fk_shop_order_items_variant` (`product_variant_id`);

--
-- Indexes for table `shop_payments`
--
ALTER TABLE `shop_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_payment_order` (`order_id`);

--
-- Indexes for table `shop_payment_logs`
--
ALTER TABLE `shop_payment_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_payment_log_payment` (`payment_id`);

--
-- Indexes for table `shop_payment_methods`
--
ALTER TABLE `shop_payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `shop_products`
--
ALTER TABLE `shop_products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `fk_shop_products_category` (`category_id`),
  ADD KEY `fk_shop_products_supplier` (`supplier_id`);

--
-- Indexes for table `shop_product_categories`
--
ALTER TABLE `shop_product_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_product_category` (`product_id`,`category_id`),
  ADD KEY `idx_spc_product_id` (`product_id`),
  ADD KEY `idx_spc_category_id` (`category_id`);

--
-- Indexes for table `shop_product_images`
--
ALTER TABLE `shop_product_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_product_images_product` (`product_id`),
  ADD KEY `fk_shop_product_images_variant` (`variant_id`);

--
-- Indexes for table `shop_product_prices`
--
ALTER TABLE `shop_product_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_prices_product_id` (`product_id`),
  ADD KEY `fk_prices_variant_id` (`variant_id`);

--
-- Indexes for table `shop_product_variants`
--
ALTER TABLE `shop_product_variants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku_variant` (`sku_variant`),
  ADD KEY `fk_shop_product_variants_product` (`product_id`);

--
-- Indexes for table `shop_reviews`
--
ALTER TABLE `shop_reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_shop_reviews_product` (`product_id`),
  ADD KEY `fk_shop_reviews_customer` (`customer_id`);

--
-- Indexes for table `shop_shipping_methods`
--
ALTER TABLE `shop_shipping_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `shop_site_settings`
--
ALTER TABLE `shop_site_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shop_suppliers`
--
ALTER TABLE `shop_suppliers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ico` (`ico`);

--
-- Indexes for table `two_factor_codes`
--
ALTER TABLE `two_factor_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_2fa_login_token_hash` (`login_token_hash`),
  ADD KEY `fk_2fa_user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_email` (`user_email`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `fk_ur_role_id` (`role_id`);

--
-- Indexes for table `web_attachments`
--
ALTER TABLE `web_attachments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `web_attachments_attachable_index` (`attachable_type`,`attachable_id`);

--
-- Indexes for table `web_external_links`
--
ALTER TABLE `web_external_links`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_external_links_user_id` (`user_id`);

--
-- Indexes for table `web_job_applications`
--
ALTER TABLE `web_job_applications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `web_logs`
--
ALTER TABLE `web_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_logs_user_id` (`user_id`);

--
-- Indexes for table `web_news`
--
ALTER TABLE `web_news`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `web_raw_request_commissions`
--
ALTER TABLE `web_raw_request_commissions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_web_sales_leads_public_token` (`public_token`),
  ADD KEY `fk_web_sales_leads_user_id` (`user_id`);

--
-- Indexes for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_sales_orders_lead_id` (`lead_id`);

--
-- Indexes for table `web_site_settings`
--
ALTER TABLE `web_site_settings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_support_user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `account_activation_tokens`
--
ALTER TABLE `account_activation_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `core_email_access_rules`
--
ALTER TABLE `core_email_access_rules`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `core_import_batches`
--
ALTER TABLE `core_import_batches`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `core_logs`
--
ALTER TABLE `core_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=224;

--
-- AUTO_INCREMENT for table `core_permissions`
--
ALTER TABLE `core_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=86;

--
-- AUTO_INCREMENT for table `core_roles`
--
ALTER TABLE `core_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `core_security_events`
--
ALTER TABLE `core_security_events`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=80;

--
-- AUTO_INCREMENT for table `core_security_settings`
--
ALTER TABLE `core_security_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `document_sections`
--
ALTER TABLE `document_sections`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=88;

--
-- AUTO_INCREMENT for table `document_types`
--
ALTER TABLE `document_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `legal_site_settings`
--
ALTER TABLE `legal_site_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `legal_social_links`
--
ALTER TABLE `legal_social_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=914;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=913;

--
-- AUTO_INCREMENT for table `shop_categories`
--
ALTER TABLE `shop_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=59;

--
-- AUTO_INCREMENT for table `shop_coupons`
--
ALTER TABLE `shop_coupons`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `shop_customers`
--
ALTER TABLE `shop_customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `shop_logs`
--
ALTER TABLE `shop_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `shop_orders`
--
ALTER TABLE `shop_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `shop_order_items`
--
ALTER TABLE `shop_order_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `shop_payments`
--
ALTER TABLE `shop_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shop_payment_logs`
--
ALTER TABLE `shop_payment_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shop_payment_methods`
--
ALTER TABLE `shop_payment_methods`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `shop_products`
--
ALTER TABLE `shop_products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `shop_product_categories`
--
ALTER TABLE `shop_product_categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `shop_product_images`
--
ALTER TABLE `shop_product_images`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `shop_product_prices`
--
ALTER TABLE `shop_product_prices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `shop_product_variants`
--
ALTER TABLE `shop_product_variants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `shop_reviews`
--
ALTER TABLE `shop_reviews`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shop_shipping_methods`
--
ALTER TABLE `shop_shipping_methods`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `shop_site_settings`
--
ALTER TABLE `shop_site_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `shop_suppliers`
--
ALTER TABLE `shop_suppliers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `two_factor_codes`
--
ALTER TABLE `two_factor_codes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100;

--
-- AUTO_INCREMENT for table `web_attachments`
--
ALTER TABLE `web_attachments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `web_external_links`
--
ALTER TABLE `web_external_links`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `web_job_applications`
--
ALTER TABLE `web_job_applications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `web_logs`
--
ALTER TABLE `web_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=94;

--
-- AUTO_INCREMENT for table `web_news`
--
ALTER TABLE `web_news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `web_raw_request_commissions`
--
ALTER TABLE `web_raw_request_commissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=233;

--
-- AUTO_INCREMENT for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `web_site_settings`
--
ALTER TABLE `web_site_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `account_activation_tokens`
--
ALTER TABLE `account_activation_tokens`
  ADD CONSTRAINT `account_activation_tokens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `core_import_batches`
--
ALTER TABLE `core_import_batches`
  ADD CONSTRAINT `fk_import_batches_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `core_role_permissions`
--
ALTER TABLE `core_role_permissions`
  ADD CONSTRAINT `fk_crp_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `core_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_crp_role_id` FOREIGN KEY (`role_id`) REFERENCES `core_roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `core_security_events`
--
ALTER TABLE `core_security_events`
  ADD CONSTRAINT `fk_security_events_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `document_sections`
--
ALTER TABLE `document_sections`
  ADD CONSTRAINT `fk_document_type` FOREIGN KEY (`document_type_id`) REFERENCES `document_types` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `fk_refresh_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_categories`
--
ALTER TABLE `shop_categories`
  ADD CONSTRAINT `fk_shop_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `shop_categories` (`id`);

--
-- Constraints for table `shop_customers`
--
ALTER TABLE `shop_customers`
  ADD CONSTRAINT `fk_shop_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shop_logs`
--
ALTER TABLE `shop_logs`
  ADD CONSTRAINT `fk_shop_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shop_orders`
--
ALTER TABLE `shop_orders`
  ADD CONSTRAINT `fk_shop_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `shop_coupons` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_shop_orders_payment` FOREIGN KEY (`payment_method_id`) REFERENCES `shop_payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_orders_shipping` FOREIGN KEY (`shipping_method_id`) REFERENCES `shop_shipping_methods` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shop_order_items`
--
ALTER TABLE `shop_order_items`
  ADD CONSTRAINT `fk_shop_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `shop_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_shop_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`),
  ADD CONSTRAINT `fk_shop_order_items_variant` FOREIGN KEY (`product_variant_id`) REFERENCES `shop_product_variants` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shop_payments`
--
ALTER TABLE `shop_payments`
  ADD CONSTRAINT `fk_shop_payment_order` FOREIGN KEY (`order_id`) REFERENCES `shop_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_payment_logs`
--
ALTER TABLE `shop_payment_logs`
  ADD CONSTRAINT `fk_shop_payment_log_payment` FOREIGN KEY (`payment_id`) REFERENCES `shop_payments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_products`
--
ALTER TABLE `shop_products`
  ADD CONSTRAINT `fk_shop_products_category` FOREIGN KEY (`category_id`) REFERENCES `shop_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_products_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `shop_suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shop_product_categories`
--
ALTER TABLE `shop_product_categories`
  ADD CONSTRAINT `fk_spc_category_id` FOREIGN KEY (`category_id`) REFERENCES `shop_categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_spc_product_id` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_product_images`
--
ALTER TABLE `shop_product_images`
  ADD CONSTRAINT `fk_shop_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_shop_product_images_variant` FOREIGN KEY (`variant_id`) REFERENCES `shop_product_variants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_product_prices`
--
ALTER TABLE `shop_product_prices`
  ADD CONSTRAINT `fk_prices_product_id` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_prices_variant_id` FOREIGN KEY (`variant_id`) REFERENCES `shop_product_variants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_product_variants`
--
ALTER TABLE `shop_product_variants`
  ADD CONSTRAINT `fk_shop_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `shop_reviews`
--
ALTER TABLE `shop_reviews`
  ADD CONSTRAINT `fk_shop_reviews_customer` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_shop_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `shop_products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `two_factor_codes`
--
ALTER TABLE `two_factor_codes`
  ADD CONSTRAINT `fk_2fa_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_ur_role_id` FOREIGN KEY (`role_id`) REFERENCES `core_roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `web_external_links`
--
ALTER TABLE `web_external_links`
  ADD CONSTRAINT `fk_web_external_links_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `web_logs`
--
ALTER TABLE `web_logs`
  ADD CONSTRAINT `fk_web_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  ADD CONSTRAINT `fk_web_sales_leads_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  ADD CONSTRAINT `fk_web_sales_orders_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `web_sales_leads` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  ADD CONSTRAINT `fk_web_support_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
