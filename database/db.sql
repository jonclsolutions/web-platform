-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 29, 2026 at 02:14 PM
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

--
-- Dumping data for table `account_activation_tokens`
--

INSERT INTO `account_activation_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `created_at`) VALUES
(27, 113, '3b79ed5a5f1405aeeb3a8c2d553808464f9ddbe0c298b9f2d6d4e8f43f9dece7', '2026-10-28 22:42:06', '2026-10-26 22:42:06');

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
('laravel-cache-52e087bd170e904bf91031423d2ea2a7', 'i:1;', 1793055932),
('laravel-cache-52e087bd170e904bf91031423d2ea2a7:timer', 'i:1793055932;', 1793055932),
('laravel-cache-5696cb0a09ed2d5fdc602f10842aec0e', 'i:2;', 1793090187),
('laravel-cache-5696cb0a09ed2d5fdc602f10842aec0e:timer', 'i:1793090187;', 1793090187),
('laravel-cache-862e0a123663139c2a0be726ddb86842', 'i:1;', 1793055719),
('laravel-cache-862e0a123663139c2a0be726ddb86842:timer', 'i:1793055719;', 1793055719),
('laravel-cache-945c9a20de51300bbbe41af91aef0642', 'i:1;', 1793036971),
('laravel-cache-945c9a20de51300bbbe41af91aef0642:timer', 'i:1793036971;', 1793036971),
('laravel-cache-966cb5012ec92adad49c15d701675108', 'i:1;', 1793038296),
('laravel-cache-966cb5012ec92adad49c15d701675108:timer', 'i:1793038296;', 1793038296),
('laravel-cache-9acc08d3ba080c090c542a5880e7c8ab', 'i:2;', 1793090187),
('laravel-cache-9acc08d3ba080c090c542a5880e7c8ab:timer', 'i:1793090187;', 1793090187),
('laravel-cache-b4a59fdf7d2d1739b22a5f3bc5bf95f0', 'i:1;', 1792838143),
('laravel-cache-b4a59fdf7d2d1739b22a5f3bc5bf95f0:timer', 'i:1792838143;', 1792838143),
('laravel-cache-b52e219a1e4d6df7ecb65133114523e8', 'i:1;', 1793055728),
('laravel-cache-b52e219a1e4d6df7ecb65133114523e8:timer', 'i:1793055728;', 1793055728),
('laravel-cache-f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59', 'i:4;', 1793059053),
('laravel-cache-f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59:timer', 'i:1793059053;', 1793059053),
('laravel-cache-f3d3a41e248e3f0900e943c763514db9', 'i:2;', 1793036740),
('laravel-cache-f3d3a41e248e3f0900e943c763514db9:timer', 'i:1793036740;', 1793036740),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400', 'i:1;', 1793102930),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400:timer', 'i:1793102930;', 1793102930),
('laravel-cache-login-fail:johndoe@jonclsolutions.com', 'i:1;', 1793037811),
('laravel-cache-login-fail:johndoe@jonclsolutions.com:timer', 'i:1793037811;', 1793037811),
('laravel-cache-login-fail:jonasbucina@asdasdasd.cz', 'i:1;', 1793056569),
('laravel-cache-login-fail:jonasbucina@asdasdasd.cz:timer', 'i:1793056569;', 1793056569),
('laravel-cache-login-fail:xxx@xxx.cz', 'i:1;', 1792838983),
('laravel-cache-login-fail:xxx@xxx.cz:timer', 'i:1792838983;', 1792838983),
('laravel-cache-login-verify-2fa5c785c036466adea360111aa28563bfd556b5fba', 'i:1;', 1793090203),
('laravel-cache-login-verify-2fa5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1793090203;', 1793090203),
('laravel-cache-password-change-notify:34', 'i:1;', 1792840294),
('laravel-cache-password-change-notify:34:timer', 'i:1792840294;', 1792840294),
('laravel-cache-password-confirmation:25:1325:user:34', 'b:1;', 1793054995),
('laravel-cache-password-confirmationf1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59', 'i:2;', 1793055711),
('laravel-cache-password-confirmationf1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59:timer', 'i:1793055711;', 1793055711),
('laravel-cache-password-confirmationf6e1126cedebf23e1463aee73f9df08783640400', 'i:2;', 1793055835),
('laravel-cache-password-confirmationf6e1126cedebf23e1463aee73f9df08783640400:timer', 'i:1793055835;', 1793055835),
('laravel-cache-password-forgot5c785c036466adea360111aa28563bfd556b5fba', 'i:1;', 1793037890),
('laravel-cache-password-forgot5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1793037890;', 1793037890),
('laravel-cache-password-reset-email:johndoe@jonclsolutions.com', 'i:1;', 1793037816),
('laravel-cache-password-reset-email:johndoe@jonclsolutions.com:timer', 'i:1793037816;', 1793037816),
('laravel-cache-password-reset-email:jonasbucina@jonclsolutions.com', 'i:1;', 1793037699),
('laravel-cache-password-reset-email:jonasbucina@jonclsolutions.com:timer', 'i:1793037699;', 1793037699),
('laravel-cache-password-reset-email:jonasbucina@rpsw.cz', 'i:1;', 1793038730),
('laravel-cache-password-reset-email:jonasbucina@rpsw.cz:timer', 'i:1793038730;', 1793038730),
('laravel-cache-password-reset-email:test@jonclsolutions.com', 'i:1;', 1793038424),
('laravel-cache-password-reset-email:test@jonclsolutions.com:timer', 'i:1793038424;', 1793038424),
('laravel-cache-site_setting_active_shop', 'O:31:\"App\\Models\\Shop\\ShopSiteSetting\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:18:\"shop_site_settings\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:5:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";s:10:\"updated_at\";s:19:\"2026-10-27 00:59:57\";}s:11:\"\0*\0original\";a:5:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";s:10:\"updated_at\";s:19:\"2026-10-27 00:59:57\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:1:{s:14:\"is_shop_active\";s:7:\"boolean\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:2:{i:0;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1793060332),
('laravel-cache-site_setting_active_web', 'O:29:\"App\\Models\\Web\\WebSiteSetting\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:17:\"web_site_settings\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:10:{s:2:\"id\";i:1;s:13:\"is_web_active\";i:1;s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";s:10:\"updated_at\";s:19:\"2026-08-22 00:06:58\";s:28:\"raw_request_email_title_i18n\";s:88:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Your request has been accepted\"}\";s:28:\"raw_request_email_intro_i18n\";s:240:\"{\"cz\":\"d\\u011bkujeme za Va\\u0161i popt\\u00e1vku. Byla \\u00fasp\\u011b\\u0161n\\u011b p\\u0159ijate a n\\u00e1\\u0161 t\\u00fdm se j\\u00ed bude v nejbli\\u017e\\u0161\\u00ed dob\\u011b v\\u011bnovat.\",\"en\":\"thank you for order we will take look at it.\"}\";s:28:\"raw_request_email_outro_i18n\";s:121:\"{\"cz\":\"V p\\u0159\\u00edpad\\u011b dotaz\\u016f n\\u00e1s nev\\u00e1hejte kontaktovat.\",\"en\":\"If you have questing contact us\"}\";s:29:\"raw_request_email_labels_i18n\";s:236:\"{\"cz\":[],\"en\":{\"greeting\":\"Hello,\",\"summary_header\":\"Recapitulation\",\"label_thema\":\"Thema\",\"label_email\":\"Contact Email\",\"label_phone\":\"Telephone\",\"label_description\":\"Description\",\"label_attachments\":\"Accessments\",\"label_date\":\"Date\"}}\";s:30:\"raw_request_email_subject_i18n\";s:75:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Order information\"}\";}s:11:\"\0*\0original\";a:10:{s:2:\"id\";i:1;s:13:\"is_web_active\";i:1;s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";s:10:\"updated_at\";s:19:\"2026-08-22 00:06:58\";s:28:\"raw_request_email_title_i18n\";s:88:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Your request has been accepted\"}\";s:28:\"raw_request_email_intro_i18n\";s:240:\"{\"cz\":\"d\\u011bkujeme za Va\\u0161i popt\\u00e1vku. Byla \\u00fasp\\u011b\\u0161n\\u011b p\\u0159ijate a n\\u00e1\\u0161 t\\u00fdm se j\\u00ed bude v nejbli\\u017e\\u0161\\u00ed dob\\u011b v\\u011bnovat.\",\"en\":\"thank you for order we will take look at it.\"}\";s:28:\"raw_request_email_outro_i18n\";s:121:\"{\"cz\":\"V p\\u0159\\u00edpad\\u011b dotaz\\u016f n\\u00e1s nev\\u00e1hejte kontaktovat.\",\"en\":\"If you have questing contact us\"}\";s:29:\"raw_request_email_labels_i18n\";s:236:\"{\"cz\":[],\"en\":{\"greeting\":\"Hello,\",\"summary_header\":\"Recapitulation\",\"label_thema\":\"Thema\",\"label_email\":\"Contact Email\",\"label_phone\":\"Telephone\",\"label_description\":\"Description\",\"label_attachments\":\"Accessments\",\"label_date\":\"Date\"}}\";s:30:\"raw_request_email_subject_i18n\";s:75:\"{\"cz\":\"Va\\u0161e popt\\u00e1vka byla p\\u0159ijata\",\"en\":\"Order information\"}\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:6:{s:13:\"is_web_active\";s:7:\"boolean\";s:28:\"raw_request_email_title_i18n\";s:5:\"array\";s:28:\"raw_request_email_intro_i18n\";s:5:\"array\";s:28:\"raw_request_email_outro_i18n\";s:5:\"array\";s:29:\"raw_request_email_labels_i18n\";s:5:\"array\";s:30:\"raw_request_email_subject_i18n\";s:5:\"array\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:7:{i:0;s:13:\"is_web_active\";i:1;s:23:\"web_maintenance_message\";i:2;s:28:\"raw_request_email_title_i18n\";i:3;s:28:\"raw_request_email_intro_i18n\";i:4;s:28:\"raw_request_email_outro_i18n\";i:5;s:29:\"raw_request_email_labels_i18n\";i:6;s:30:\"raw_request_email_subject_i18n\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1793103034);

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
(6, 'domain', 'jonclsolutions.com', '2026-09-26 01:45:22', '2026-09-26 01:45:22'),
(7, 'domain', 'gmail.com', '2026-10-06 00:01:46', '2026-10-06 00:01:46'),
(8, 'email', 'gamba@foneticka.cz', '2026-10-06 00:02:22', '2026-10-06 00:02:22');

-- --------------------------------------------------------

--
-- Table structure for table `core_external_links`
--

CREATE TABLE `core_external_links` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `url` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `core_external_links`
--

INSERT INTO `core_external_links` (`id`, `user_id`, `name`, `url`, `created_at`, `updated_at`, `deleted_at`) VALUES
(21, 25, 'test', 'https://analytics.google.com', '2026-09-01 15:07:43', '2026-09-05 10:35:03', '2026-09-05 10:35:03'),
(22, 25, 'test', 'https://www.google.com/?hl=cs', '2026-09-01 15:08:05', '2026-09-05 10:35:03', '2026-09-05 10:35:03'),
(23, 25, 'adasd', 'https://analytics.google.com', '2026-09-01 15:22:24', '2026-09-05 10:35:03', '2026-09-05 10:35:03'),
(24, 25, 'test', 'https://www.google.com/?hl=cs', '2026-09-01 15:24:01', '2026-09-05 10:35:03', '2026-09-05 10:35:03');

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
(25, 'shop/suppliers', 25, 'Seznam aktivních dodavatelů-vybrane-raw.csv', 'csv', 'imports/68cc6c16-5d39-4eca-8e03-bf190400c6c5.csv', 'validated', 2, 0, 2, 0, 0, '[{\"row\":2,\"errors\":{\"is_active\":[\"The is active field must be true or false.\"]}},{\"row\":3,\"errors\":{\"is_active\":[\"The is active field must be true or false.\"]}}]', '2026-08-23 20:45:23', '2026-08-23 20:45:23', NULL),
(26, 'web/raw_request_commissions', 25, 'import-sablona-web-raw_request_commissions-mock.txt', 'txt', 'imports/cff22c46-0aea-4e91-ab07-1fa1523468a2.txt', 'completed', 15, 15, 0, 15, 0, '[]', '2026-08-26 16:12:35', '2026-08-26 16:12:36', '2026-08-26 16:12:36');

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
(7, 'view-deleted', 'Zobrazit softdeleted (smazané) záznamy v koši napříč moduly', 'web', '2026-02-14 08:12:31'),
(17, 'shop-view-reports', 'Zobrazit reporty a statistiky e-shopu', 'shop', '2026-03-22 08:12:31'),
(18, 'view-web', '[doporučení: vždy zapnuto] Zobrazit záložku Web v menu administrace - bez tohoto práva se do sekce nelze dostat', 'core', '2026-03-25 11:37:06'),
(19, 'view-eshop', '[doporučení: vždy zapnuto] Zobrazit záložku Eshop v menu administrace - bez tohoto práva se do sekce nelze dostat', 'core', '2026-03-25 11:37:06'),
(20, 'shop-view-dashboard', '[doporučení: vždy zapnuto] Zobrazit úvodní nástěnku e-shop sekce (výchozí stránka po vstupu do menu Eshop)', 'core', '2026-03-25 11:42:21'),
(21, 'shop-view-logs', 'Zobrazit historii logů (auditní záznam akcí) e-shopu', 'core', '2026-03-26 22:39:15'),
(26, 'shop-set-maintenance-mode', 'Přepnout e-shop do režimu údržby (nepřístupný pro zákazníky)', 'shop', '2026-06-12 13:09:55'),
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
(79, 'core-security-delete', 'Ručně smazat bezpečnostní záznam nebo spustit okamžitý purge starých záznamů', 'core', '2026-08-22 11:34:11'),
(86, 'web-projects-view', 'Zobrazit seznam a detail zákaznických projektů', 'web', '2026-08-27 22:30:13'),
(87, 'web-projects-create', 'Vytvořit nový zákaznický projekt (samostatně nebo z realizace)', 'web', '2026-08-27 22:30:13'),
(88, 'web-projects-update', 'Upravit projekt, checkpointy, přístupové heslo a odpovídat na požadavky zákazníků', 'web', '2026-08-27 22:30:13'),
(89, 'web-projects-delete', 'Smazat (i hromadně) zákaznický projekt', 'web', '2026-08-27 22:30:13'),
(90, 'shop-products-view', 'Zobrazit produkty e-shopu', 'shop', '2026-09-05 14:28:53'),
(91, 'shop-products-create', 'Vytvořit nový produkt e-shopu', 'shop', '2026-09-05 14:28:53'),
(92, 'shop-products-update', 'Upravit produkt e-shopu (včetně variant a obrázků)', 'shop', '2026-09-05 14:28:53'),
(93, 'shop-products-delete', 'Smazat / obnovit produkt e-shopu z koše', 'shop', '2026-09-05 14:28:53'),
(94, 'shop-categories-view', 'Zobrazit kategorie produktů e-shopu', 'shop', '2026-09-05 14:28:53'),
(95, 'shop-categories-create', 'Vytvořit kategorii produktů e-shopu', 'shop', '2026-09-05 14:28:53'),
(96, 'shop-categories-update', 'Upravit kategorii produktů e-shopu', 'shop', '2026-09-05 14:28:53'),
(97, 'shop-categories-delete', 'Smazat kategorii produktů e-shopu', 'shop', '2026-09-05 14:28:53'),
(98, 'shop-customers-view', 'Zobrazit zákazníky e-shopu', 'shop', '2026-09-05 14:28:53'),
(99, 'shop-customers-create', 'Vytvořit nového zákazníka e-shopu', 'shop', '2026-09-05 14:28:53'),
(100, 'shop-customers-update', 'Upravit zákazníka e-shopu', 'shop', '2026-09-05 14:28:53'),
(101, 'shop-customers-delete', 'Smazat / obnovit zákazníka e-shopu z koše', 'shop', '2026-09-05 14:28:53'),
(102, 'shop-orders-view', 'Zobrazit objednávky e-shopu', 'shop', '2026-09-05 14:28:53'),
(103, 'shop-orders-create', 'Vytvořit objednávku e-shopu ručně (interně administrátorem)', 'shop', '2026-09-05 14:28:53'),
(104, 'shop-orders-update', 'Upravit objednávku e-shopu', 'shop', '2026-09-05 14:28:53'),
(105, 'shop-orders-delete', 'Smazat / obnovit objednávku e-shopu z koše', 'shop', '2026-09-05 14:28:53'),
(106, 'shop-suppliers-view', 'Zobrazit dodavatele e-shopu', 'shop', '2026-09-05 14:28:53'),
(107, 'shop-suppliers-create', 'Vytvořit dodavatele e-shopu', 'shop', '2026-09-05 14:28:53'),
(108, 'shop-suppliers-update', 'Upravit dodavatele e-shopu', 'shop', '2026-09-05 14:28:53'),
(109, 'shop-suppliers-delete', 'Smazat / obnovit dodavatele e-shopu z koše', 'shop', '2026-09-05 14:28:53'),
(110, 'shop-shipping-methods-view', 'Zobrazit metody dopravy e-shopu', 'shop', '2026-09-05 14:28:53'),
(111, 'shop-shipping-methods-create', 'Vytvořit metodu dopravy e-shopu', 'shop', '2026-09-05 14:28:53'),
(112, 'shop-shipping-methods-update', 'Upravit metodu dopravy e-shopu', 'shop', '2026-09-05 14:28:53'),
(113, 'shop-shipping-methods-delete', 'Smazat / obnovit metodu dopravy e-shopu z koše', 'shop', '2026-09-05 14:28:53'),
(114, 'shop-payment-methods-view', 'Zobrazit způsoby platby e-shopu', 'shop', '2026-09-05 14:28:53'),
(115, 'shop-payment-methods-update', 'Upravit způsob platby e-shopu', 'shop', '2026-09-05 14:28:53'),
(116, 'shop-coupons-view', 'Zobrazit slevové kupóny e-shopu', 'shop', '2026-09-05 14:28:53'),
(117, 'shop-coupons-create', 'Vytvořit slevový kupón e-shopu', 'shop', '2026-09-05 14:28:53'),
(118, 'shop-coupons-update', 'Upravit slevový kupón e-shopu', 'shop', '2026-09-05 14:28:53'),
(119, 'shop-coupons-delete', 'Smazat / obnovit slevový kupón e-shopu z koše', 'shop', '2026-09-05 14:28:53'),
(120, 'web-edit-website-view', 'Zobrazit stránku správy veřejných textů webu', 'web', '2026-09-05 15:52:19'),
(121, 'web-edit-website-update', 'Upravit veřejné texty webu (překlady, jazyky)', 'web', '2026-09-05 15:52:19'),
(122, 'shop-edit-eshop-view', 'Zobrazit stránku správy veřejných textů e-shopu', 'shop', '2026-09-05 15:52:19'),
(123, 'shop-edit-eshop-update', 'Upravit veřejné texty e-shopu (překlady, jazyky)', 'shop', '2026-09-05 15:52:19'),
(124, 'web-welcome-page-view', 'Zobrazí welcome page u web sekce.', 'web', '2026-09-07 09:03:22'),
(125, 'shop-welcome-page-view', 'Zobrazí welcome page u shop sekce.', 'shop', '2026-09-07 09:03:22');

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
(1, 'sysadmin', '', 0, '2026-02-14 08:12:31', '2026-09-06 22:08:57', NULL),
(20, 'testing_role', 'Temp role used only for testing.', 0, '2026-10-05 07:20:15', '2026-10-05 07:20:15', NULL),
(21, 'low_permissions_role', NULL, 1, '2026-10-05 22:22:30', '2026-10-09 13:44:49', NULL);

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
(1, 7),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 26),
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
(1, 86),
(1, 87),
(1, 88),
(1, 89),
(1, 90),
(1, 91),
(1, 92),
(1, 93),
(1, 94),
(1, 95),
(1, 96),
(1, 97),
(1, 98),
(1, 99),
(1, 100),
(1, 101),
(1, 102),
(1, 103),
(1, 104),
(1, 105),
(1, 106),
(1, 107),
(1, 108),
(1, 109),
(1, 110),
(1, 111),
(1, 112),
(1, 113),
(1, 114),
(1, 115),
(1, 116),
(1, 117),
(1, 118),
(1, 119),
(1, 120),
(1, 121),
(1, 122),
(1, 123),
(1, 124),
(1, 125),
(20, 17),
(20, 18),
(20, 19),
(20, 20),
(20, 21),
(20, 26),
(20, 32),
(20, 55),
(20, 56),
(20, 57),
(20, 58),
(20, 59),
(20, 60),
(20, 61),
(20, 62),
(20, 63),
(20, 64),
(20, 65),
(20, 66),
(20, 67),
(20, 68),
(20, 69),
(20, 70),
(20, 77),
(20, 78),
(20, 79),
(20, 90),
(20, 91),
(20, 92),
(20, 93),
(20, 94),
(20, 95),
(20, 96),
(20, 97),
(20, 98),
(20, 99),
(20, 100),
(20, 101),
(20, 102),
(20, 103),
(20, 104),
(20, 105),
(20, 106),
(20, 107),
(20, 108),
(20, 109),
(20, 110),
(20, 111),
(20, 112),
(20, 113),
(20, 114),
(20, 115),
(20, 116),
(20, 117),
(20, 118),
(20, 119),
(20, 122),
(20, 123),
(20, 125),
(21, 55),
(21, 56),
(21, 57),
(21, 58);

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
(78, '44502d4ec120e6ef3305e1f70fff43ef5c8c42d8a8d630a7b33a974ee7447d82', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_leads', 'GET', NULL, 2, '2026-08-26 11:54:50', '2026-08-26 11:54:50', 'new', NULL, '{\"route\":\"api\\/web\\/sales_leads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-26 11:54:50', '2026-08-26 11:54:50'),
(80, '54af37ebb0a034bd82f3a46e4e7015a622b8d215a85619d924d27aec44395341', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 1, '2026-08-26 23:30:36', '2026-08-26 23:30:36', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-26 23:30:36', '2026-08-26 23:30:36'),
(81, '5164187ad89f5576d360f19142408f734e3559e2b20fa9ada19e31e18f6eeb9a', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 2, '2026-08-27 00:49:49', '2026-08-27 00:49:49', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-27 00:49:49', '2026-08-27 00:49:49'),
(83, 'b4857454460123ec02fd02fde061ad9b0af9d5e00dce7c6cb0baa7b468a4bc80', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 2, '2026-08-27 01:50:07', '2026-08-27 01:50:07', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-27 01:50:07', '2026-08-27 01:50:07'),
(85, '07ddf2046688ddfc746f3cbdbba0eb7b449faf619a260bd313cebf3d0e48105d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 2, '2026-08-27 10:04:06', '2026-08-27 10:04:06', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-27 10:04:06', '2026-08-27 10:04:06'),
(87, '3f3f8abbf3da03bf4d79fe316675027485b816cea2c83b21a7b09ae8df869bc7', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects', 'POST', NULL, 1, '2026-08-28 08:49:50', '2026-08-28 08:49:50', 'new', NULL, '{\"route\":\"api\\/web\\/projects\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 08:49:50', '2026-08-28 08:49:50'),
(88, '413e9e9478b7faf4f9e4758df7501d49b153f13317ae2a6a809d0b87d1a65bfc', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects', 'POST', NULL, 1, '2026-08-28 11:19:32', '2026-08-28 11:19:32', 'new', NULL, '{\"route\":\"api\\/web\\/projects\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 11:19:32', '2026-08-28 11:19:32'),
(89, '93659706f5a4e0b0c4da67f91d0105b781d4704623c84290641fd2ba204fb6b3', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd', 'GET', NULL, 2, '2026-08-28 11:29:09', '2026-08-28 11:29:21', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":26}', '2026-08-28 11:29:09', '2026-08-28 11:29:21'),
(91, '8902fb8824a33de8b0ab09b3d5476c6b8c63cebe3a7948b8224293162b449c5c', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd', 'GET', NULL, 1, '2026-08-28 11:34:45', '2026-08-28 11:34:45', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":26}', '2026-08-28 11:34:45', '2026-08-28 11:34:45'),
(92, '3f51488e109921155a4846b617d5465d9e3ad0c306f5adc6f31529e950afa89d', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd', 'GET', NULL, 2, '2026-08-28 11:35:05', '2026-08-28 11:35:15', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":26}', '2026-08-28 11:35:05', '2026-08-28 11:35:15'),
(94, 'cc1af1e409c28205193fbd147a72a4e688db992045df64dfe1c27e14d666adea', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd', 'GET', NULL, 2, '2026-08-28 11:53:19', '2026-08-28 11:53:26', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":26}', '2026-08-28 11:53:19', '2026-08-28 11:53:26'),
(96, '6253f6f1553c73aa5cc30a5435f9e0ade88e834dba8287a003a6ab2948171e38', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd', 'GET', NULL, 1, '2026-08-28 11:56:04', '2026-08-28 11:56:04', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/dhX13TlgE0jpYGaUgBHQkMRQo6K3D5Fw4RnGiLBd\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":26}', '2026-08-28 11:56:04', '2026-08-28 11:56:04'),
(97, '92d3bb411dc55d97310390e1f558908a16f4603029b06f348b33a463b853d395', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects/bulk-delete', 'POST', NULL, 1, '2026-08-28 12:55:35', '2026-08-28 12:55:35', 'new', NULL, '{\"route\":\"api\\/web\\/projects\\/bulk-delete\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 12:55:35', '2026-08-28 12:55:35'),
(98, '890213f15f6c145d1db5f61a8f9725eed6277479243dcc02b45ab286c76ff796', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1/threads', 'GET', NULL, 2, '2026-08-28 13:20:29', '2026-08-28 13:20:57', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1\\/threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":5}', '2026-08-28 13:20:29', '2026-08-28 13:20:57'),
(99, '0e6203a2180cfa419c9b4434a62495e3ef1238ae8a128135d3548dfad81199ad', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1', 'GET', NULL, 1, '2026-08-28 13:20:35', '2026-08-28 13:20:35', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":5}', '2026-08-28 13:20:35', '2026-08-28 13:20:35'),
(101, 'b34f24b25c6761bd90e2efdcb001fef767b7ddb67d012fc71ff6b187f04bb41e', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects', 'GET', NULL, 2, '2026-08-28 14:48:50', '2026-08-28 14:48:50', 'new', NULL, '{\"route\":\"api\\/web\\/projects\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 14:48:50', '2026-08-28 14:48:50'),
(103, '384d5a6a8179abaa9a8b9a6428aae64bcd7957579333854764a88ea0142268c1', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_orders', 'GET', NULL, 1, '2026-08-28 14:48:50', '2026-08-28 14:48:50', 'new', NULL, '{\"route\":\"api\\/web\\/sales_orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 14:48:50', '2026-08-28 14:48:50'),
(104, 'bf73c0c531cb44c3579588e6f9afe8add76a16259148583f78a0e2f8ab54039b', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1', 'GET', NULL, 1, '2026-08-28 14:49:47', '2026-08-28 14:49:47', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":5}', '2026-08-28 14:49:47', '2026-08-28 14:49:47'),
(105, '4a4633c1397a9171b70856ddfbd9e28c931e18e8f972fde794bc1a9baf24a898', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1/threads', 'GET', NULL, 1, '2026-08-28 14:50:43', '2026-08-28 14:50:43', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1\\/threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":5}', '2026-08-28 14:50:43', '2026-08-28 14:50:43'),
(106, 'f71f602a540b19af8d1ee47d4de9c2907815257217b542c92f1e47153bf0c628', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1', 'GET', NULL, 1, '2026-08-28 14:50:54', '2026-08-28 14:50:54', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":5}', '2026-08-28 14:50:54', '2026-08-28 14:50:54'),
(107, '620d8c2dcd2f57cdda1683fdd64292d7d62abe9183d22a0abf41b7d5f118966f', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects/5', 'GET', NULL, 1, '2026-08-28 16:27:53', '2026-08-28 16:27:53', 'new', NULL, '{\"route\":\"api\\/web\\/projects\\/5\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 16:27:53', '2026-08-28 16:27:53'),
(108, '5feb77ecf2832c957d77be09d9980e15d67e0b03a553102cddb78f98e7e58792', 'project_session_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1', 'GET', NULL, 1, '2026-08-28 17:28:40', '2026-08-28 17:28:40', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/TZ9QVJYXcEvO8Q8VeL04wMjW6YPTj6UPHLcmAvZEa1eZY1I1\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-08-28 17:28:40', '2026-08-28 17:28:40'),
(109, 'a30e26e7d12913441e01299832e887f15919827bf5fb921c2953e482f76dc9d8', 'project_session_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu/threads/2', 'GET', NULL, 1, '2026-08-28 17:39:25', '2026-08-28 17:39:25', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\\/threads\\/2\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-08-28 17:39:25', '2026-08-28 17:39:25'),
(110, 'a39ffca829fef7c047cd34b28b0027e7211b97c03af9505d5ff0c73ea8fbeb87', 'project_session_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu/threads/2/messages', 'POST', NULL, 3, '2026-08-28 17:39:31', '2026-08-28 17:39:38', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\\/threads\\/2\\/messages\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-08-28 17:39:31', '2026-08-28 17:39:38'),
(113, 'c43471173ce2751fe2ed98c5fb0167a2c88da2d5b6efbddc9ece821ead78403d', 'project_session_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu', 'GET', NULL, 1, '2026-08-28 17:39:40', '2026-08-28 17:39:40', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-08-28 17:39:40', '2026-08-28 17:39:40'),
(114, '016d0ff4187bdec9b3b7d02edfb522c9bc143cbf8343264aa5e4dfdc9a39ce95', 'project_login_invalid_token', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu/login', 'POST', NULL, 1, '2026-08-28 17:39:52', '2026-08-28 17:39:52', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-08-28 17:39:52', '2026-08-28 17:39:52'),
(115, '345caa76bad86280521f153550af37c6f51e8e492dbdde170ffa180bc6422dfc', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects', 'GET', NULL, 2, '2026-08-28 23:32:16', '2026-08-28 23:32:16', 'new', NULL, '{\"route\":\"api\\/web\\/projects\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-28 23:32:16', '2026-08-28 23:32:16'),
(117, 'f635c126e4c3be1d16a77da66017d3c520fbc690c5987d9cdc38d3e30ce2625c', 'project_login_invalid_token', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu/login', 'POST', NULL, 1, '2026-08-28 23:33:01', '2026-08-28 23:33:01', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-08-28 23:33:01', '2026-08-28 23:33:01'),
(118, '7cdb05530573f5edff0529831ef04b6cd238087ae5dc1e0cd30f9a8784b45cc5', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/project-threads', 'GET', NULL, 3, '2026-08-29 09:17:13', '2026-08-29 09:17:14', 'new', NULL, '{\"route\":\"api\\/web\\/project-threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-29 09:17:13', '2026-08-29 09:17:14'),
(120, '32ccaa385561ade48e36971cdb3d82490037124ea0b30ba6f6c9eb5ab1392f30', 'refresh_token_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/refresh', 'POST', NULL, 1, '2026-08-29 09:17:14', '2026-08-29 09:17:14', 'new', NULL, '{\"route\":\"api\\/refresh\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-29 09:17:14', '2026-08-29 09:17:14'),
(122, '377b55324af60c939768989921b1433f550f46f23084154da1395fc35eba3b9e', 'refresh_token_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/refresh', 'POST', NULL, 1, '2026-08-29 09:29:42', '2026-08-29 09:29:42', 'new', NULL, '{\"route\":\"api\\/refresh\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-29 09:29:42', '2026-08-29 09:29:42'),
(123, '12e8b65d7760abdeeea20d2d7658a05b0123555979113bdbb1e16f2f87844270', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-08-31 10:36:38', '2026-08-31 10:36:38', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 10:36:38', '2026-08-31 10:36:38'),
(124, '9748cc3668d5f274a7b398c67e11f9066f6136821f28c50cf0ab480981b056f5', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/external_links', 'GET', NULL, 2, '2026-08-31 14:40:56', '2026-08-31 14:40:56', 'new', NULL, '{\"route\":\"api\\/core\\/external_links\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 14:40:56', '2026-08-31 14:40:56'),
(126, 'eb3455a8bb300f9d04a401c0b57bca385cdcfcb9242969a78dcef715244deeac', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/orders', 'GET', NULL, 3, '2026-08-31 18:27:20', '2026-08-31 18:27:21', 'new', NULL, '{\"route\":\"api\\/shop\\/orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 18:27:20', '2026-08-31 18:27:21'),
(128, '190fb77654b4218366ad0387d50831040479ecd85408214f4c361dfeb1c5e2c1', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/customers', 'GET', NULL, 1, '2026-08-31 18:27:21', '2026-08-31 18:27:21', 'new', NULL, '{\"route\":\"api\\/shop\\/customers\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 18:27:21', '2026-08-31 18:27:21'),
(129, 'cb5546ad2d809ec22afd1e3984a2daf06ea1fa86f9a1ac7f9c556d81c99587a7', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/products', 'GET', NULL, 2, '2026-08-31 18:27:21', '2026-08-31 18:27:21', 'new', NULL, '{\"route\":\"api\\/shop\\/products\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 18:27:21', '2026-08-31 18:27:21'),
(131, 'a58362f3da96e25f8420eeeff5dd1b091a5c90082187194e2fdaf5ec085a6e7e', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/coupons', 'GET', NULL, 1, '2026-08-31 18:27:21', '2026-08-31 18:27:21', 'new', NULL, '{\"route\":\"api\\/shop\\/coupons\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 18:27:21', '2026-08-31 18:27:21'),
(133, 'e7bba542a600bd7fdd9e6ea839cb3893b214fce3aedd23d44f178f53dbbe1b3f', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/settings', 'GET', NULL, 1, '2026-08-31 18:27:22', '2026-08-31 18:27:22', 'new', NULL, '{\"route\":\"api\\/shop\\/settings\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 18:27:22', '2026-08-31 18:27:22'),
(134, '1152e8efb3588544b2942acca53396c027140abf8a9a8809f0a9dcfd94e6229d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/support_tickets', 'GET', NULL, 2, '2026-08-31 21:42:52', '2026-08-31 21:42:52', 'new', NULL, '{\"route\":\"api\\/web\\/support_tickets\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 21:42:52', '2026-08-31 21:42:52'),
(136, '1fac64baaf08ecf3c245e073f693860550f233650ed6e59b23b5734c11df198e', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects', 'GET', NULL, 2, '2026-08-31 22:50:15', '2026-08-31 22:50:15', 'new', NULL, '{\"route\":\"api\\/web\\/projects\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 22:50:15', '2026-08-31 22:50:15'),
(138, '4ae8f32ea2ad1a9a7c788e4aa8ea76c663d637b545b9914384010679eaf00e53', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/project-threads', 'GET', NULL, 1, '2026-08-31 22:50:15', '2026-08-31 22:50:15', 'new', NULL, '{\"route\":\"api\\/web\\/project-threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-08-31 22:50:15', '2026-08-31 22:50:15'),
(139, 'f7d57391a9074b2402a146a96d9e765311927ebb5d5413cff8490554b2123f2f', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-09-01 15:20:21', '2026-09-01 15:20:21', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-01 15:20:21', '2026-09-01 15:20:21'),
(140, 'a9bf1fa24c16942a2af918ed057fbddf0f5256c37a5eda63ebe7b4d4f1cc7983', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/external_links', 'GET', NULL, 2, '2026-09-01 23:40:00', '2026-09-01 23:40:01', 'new', NULL, '{\"route\":\"api\\/core\\/external_links\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-01 23:40:00', '2026-09-01 23:40:01'),
(142, '5772e26ffb94df10b8329d4967a0a6d68c2120452b55243b5a15ef3f46f65a20', 'scan_probe', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/view-file/web/raw_request_commissions/tOWDg2jjPiOCz4KHxql1sAiQpO9N0mwDtvZ8rJZS.txt', 'GET', NULL, 1, '2026-09-02 14:46:54', '2026-09-02 14:46:54', 'new', NULL, '{\"route\":\"api\\/view-file\\/web\\/raw_request_commissions\\/tOWDg2jjPiOCz4KHxql1sAiQpO9N0mwDtvZ8rJZS.txt\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-02 14:46:54', '2026-09-02 14:46:54'),
(143, '1ce17c3a4be63656bbeccb3238b59bfe81cf1a9d704e5e74040f28633a44628f', 'scan_probe', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/download-file/web/raw_request_commissions/tOWDg2jjPiOCz4KHxql1sAiQpO9N0mwDtvZ8rJZS.txt', 'GET', NULL, 2, '2026-09-02 14:52:04', '2026-09-02 14:53:24', 'new', NULL, '{\"route\":\"api\\/download-file\\/web\\/raw_request_commissions\\/tOWDg2jjPiOCz4KHxql1sAiQpO9N0mwDtvZ8rJZS.txt\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-02 14:52:04', '2026-09-02 14:53:24'),
(145, '8eaa648a1fedb705252811337a703b30423c7478bd992e281e4bfed65d006579', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/gVp6Zb6REnxXTBNxJZ5eScSQVe6oEShmv3avcUmr', 'GET', NULL, 2, '2026-09-02 16:47:49', '2026-09-02 16:48:20', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/gVp6Zb6REnxXTBNxJZ5eScSQVe6oEShmv3avcUmr\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":28}', '2026-09-02 16:47:49', '2026-09-02 16:48:20'),
(147, '8cf96ff12e7cfe06d35e407d670b4341b3d9c4b5eb8a19a0753860a2e3d45eaf', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/gVp6Zb6REnxXTBNxJZ5eScSQVe6oEShmv3avcUmr', 'GET', NULL, 2, '2026-09-02 16:55:17', '2026-09-02 16:56:03', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/gVp6Zb6REnxXTBNxJZ5eScSQVe6oEShmv3avcUmr\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":28}', '2026-09-02 16:55:17', '2026-09-02 16:56:03'),
(149, 'e5c3e1e853174601bd5bd7965793b0c59df2637f06a135df5bd70851a270d6b0', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-09-05 12:34:50', '2026-09-05 12:34:50', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-05 12:34:50', '2026-09-05 12:34:50'),
(150, 'd998ac70b7f335307cd221718b4d66f44ed408408564316a2192ca6942651a1b', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/permissions', 'GET', NULL, 1, '2026-09-05 16:01:31', '2026-09-05 16:01:31', 'new', NULL, '{\"route\":\"api\\/core\\/permissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-05 16:01:31', '2026-09-05 16:01:31'),
(151, '2b4ab7e87b2b679157f76333d920b7c2c2e369da3c1758dbdba788b7fae98e7b', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-09-05 17:58:05', '2026-09-05 17:58:05', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-05 17:58:05', '2026-09-05 17:58:05'),
(152, 'a294644efc369ca8a8a76409eb1af9394bab352079bb3a7dcf1f2a69307698c3', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/logout', 'POST', NULL, 1, '2026-09-05 22:47:26', '2026-09-05 22:47:26', 'new', NULL, '{\"route\":\"api\\/logout\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-05 22:47:26', '2026-09-05 22:47:26'),
(153, 'bd7def41d11d658cf25fb7a3dbdb5f1d5861d689b626bb8c648a41e7e921955d', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 2, '2026-09-05 22:51:10', '2026-09-05 22:51:14', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"lindicka@mazliva.cz\"}', '2026-09-05 22:51:10', '2026-09-05 22:51:14'),
(155, '8848cd73541c35ce163da837d6efdaf34f38f9cb88520935aa26bb601bea695d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-09-06 15:00:45', '2026-09-06 15:00:45', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 15:00:45', '2026-09-06 15:00:45'),
(156, '867393ad4886cc6f64c8169e4654f49bb4e20a679f71d15c7443f391e5242929', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-09-06 18:36:30', '2026-09-06 18:36:30', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:30', '2026-09-06 18:36:30');
INSERT INTO `core_security_events` (`id`, `fingerprint`, `event_type`, `severity`, `ip_address`, `user_agent`, `route`, `method`, `user_id`, `occurrences`, `first_seen_at`, `last_seen_at`, `status`, `notes`, `context_data`, `created_at`, `updated_at`) VALUES
(157, '026d1b2ef433aaadc0a6411b9f72933a6ddf8278309700eb248e639ebb5758ba', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/support_tickets', 'GET', NULL, 1, '2026-09-06 18:36:30', '2026-09-06 18:36:30', 'new', NULL, '{\"route\":\"api\\/web\\/support_tickets\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:30', '2026-09-06 18:36:30'),
(158, 'a8de5743cffe4fda4ed719934dc986964f4da80f01f49d57365d8f48451a9370', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/job_applications', 'GET', NULL, 1, '2026-09-06 18:36:31', '2026-09-06 18:36:31', 'new', NULL, '{\"route\":\"api\\/web\\/job_applications\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:31', '2026-09-06 18:36:31'),
(159, '21ceb07936e6cfcbf86998bad7b808f218a06c6b31e108982d8d78c50d6f8cac', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_leads', 'GET', NULL, 1, '2026-09-06 18:36:31', '2026-09-06 18:36:31', 'new', NULL, '{\"route\":\"api\\/web\\/sales_leads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:31', '2026-09-06 18:36:31'),
(160, '63b77fae41d49efc3421c02c16e2a26447440d32c2804ad6150f46e52ec8a46d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_orders', 'GET', NULL, 1, '2026-09-06 18:36:31', '2026-09-06 18:36:31', 'new', NULL, '{\"route\":\"api\\/web\\/sales_orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:31', '2026-09-06 18:36:31'),
(161, '4633bd00bedb9bfdc3e28aa6011ba408bd6d0f8174c7f09c46a17d15085f20a1', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 1, '2026-09-06 18:36:31', '2026-09-06 18:36:31', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:31', '2026-09-06 18:36:31'),
(162, '097bbfb461e6951aa6c86175fb0cc6de4b6746838e76446da4049bf345a67947', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/logs', 'GET', NULL, 2, '2026-09-06 18:36:31', '2026-09-06 18:36:31', 'new', NULL, '{\"route\":\"api\\/web\\/logs\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:31', '2026-09-06 18:36:31'),
(164, 'ac45067c98d40d1a685690539c2cdb0e88abeb5a1f3560e331f5e0fde821003d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/settings', 'GET', NULL, 1, '2026-09-06 18:36:32', '2026-09-06 18:36:32', 'new', NULL, '{\"route\":\"api\\/web\\/settings\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-06 18:36:32', '2026-09-06 18:36:32'),
(165, '4e5c49248bd678b75fe6f1a7bdcb8c6cd770c5b08badc904b4d059f025e538a0', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-09-07 00:07:35', '2026-09-07 00:07:35', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 00:07:35', '2026-09-07 00:07:35'),
(166, '6b487fc88c11a472e01033157ebb5fa53c9de1af49af0a2c3b5cfdeadc21577f', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 2, '2026-09-07 01:12:03', '2026-09-07 01:12:03', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 01:12:03', '2026-09-07 01:12:03'),
(168, '239be71442c10e9cc9f2d7ece0df80b8167ae745f00c53930aec0c9aa37ef306', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 2, '2026-09-07 10:12:35', '2026-09-07 10:12:36', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 10:12:35', '2026-09-07 10:12:36'),
(170, 'f79855ef4aa76ab49a8e329f1e88b73cee510a80a5662d028f32bc62f6842934', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-09-07 16:02:34', '2026-09-07 16:02:34', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:34', '2026-09-07 16:02:34'),
(171, 'fcb383ed4121127f7e1657d75753994f77209c4526fbe769fdcb4f4b355b35c6', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/support_tickets', 'GET', NULL, 1, '2026-09-07 16:02:34', '2026-09-07 16:02:34', 'new', NULL, '{\"route\":\"api\\/web\\/support_tickets\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:34', '2026-09-07 16:02:34'),
(172, '7b6ab055d582b4f511c6463de380a82b742bd2e180ad6b6d6bedb98a24d2251d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/job_applications', 'GET', NULL, 1, '2026-09-07 16:02:34', '2026-09-07 16:02:34', 'new', NULL, '{\"route\":\"api\\/web\\/job_applications\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:34', '2026-09-07 16:02:34'),
(173, 'be8f5e80da460e0359579dd624ab596453503536d54aba5f028cc202f722b5fd', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_leads', 'GET', NULL, 1, '2026-09-07 16:02:34', '2026-09-07 16:02:34', 'new', NULL, '{\"route\":\"api\\/web\\/sales_leads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:34', '2026-09-07 16:02:34'),
(174, '73f87556ac8c3fa16d8f6289a99025884e3528189d5c0cfd051d20ed72832ec7', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_orders', 'GET', NULL, 1, '2026-09-07 16:02:35', '2026-09-07 16:02:35', 'new', NULL, '{\"route\":\"api\\/web\\/sales_orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:35', '2026-09-07 16:02:35'),
(175, 'ab34db111a38e42b46d7fa23ff4714d1aa2165151fcfec929571ce3af49580cc', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 1, '2026-09-07 16:02:35', '2026-09-07 16:02:35', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:35', '2026-09-07 16:02:35'),
(176, 'dadd8c09851bcfb3706df83c9d7d8506e4fb64095e7847c7a4810c7e0d40962d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/logs', 'GET', NULL, 2, '2026-09-07 16:02:35', '2026-09-07 16:02:35', 'new', NULL, '{\"route\":\"api\\/web\\/logs\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:35', '2026-09-07 16:02:35'),
(178, '1c5b6d72758b60e3091d294216988acd4cd2472b4e443e6e3f56c1dc13614e32', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/settings', 'GET', NULL, 1, '2026-09-07 16:02:35', '2026-09-07 16:02:35', 'new', NULL, '{\"route\":\"api\\/web\\/settings\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 16:02:35', '2026-09-07 16:02:35'),
(179, '660e44b7efdfd25b7748bc82fec25f423d7aae7b8811b2810cc0e2cf6d35edec', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(180, '4024cac996e53b39b7f4243fe759f08317c22f79c70dff03010ccdaea65daa9e', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/support_tickets', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/support_tickets\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(181, '8020072a59648486eeea28f6f024594e974eb8ffd11362979232e8641ec44a5d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/job_applications', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/job_applications\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(182, '8c22533730b6509cafb514c99d40984328b13a920439567e4343fb5f9235613f', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_leads', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/sales_leads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(183, '08f7fbfb132c597b18fa40f66563c852fd71491ea90fb2fcc7b9a40f27002b7e', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_orders', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/sales_orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(184, '82f14ff342100b6e3e3b35ed4b6dd1416afef4902ac2aec49874e1965a6015a0', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(185, 'c18a2932ae33509661cdfd1e7df9dc142d38084a23661c61d07140cf03da7cef', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/logs', 'GET', NULL, 2, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/logs\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(187, '080acb5a90a376037d9c362185e99690098af5d4a10177dac12df8f7d38fd8cd', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/settings', 'GET', NULL, 1, '2026-09-07 22:26:52', '2026-09-07 22:26:52', 'new', NULL, '{\"route\":\"api\\/web\\/settings\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-07 22:26:52', '2026-09-07 22:26:52'),
(188, '65ed6adb3adc3c84de7466d079d1956925be2aeedbe8ffc01b51da1adbd759dc', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_orders', 'GET', NULL, 2, '2026-09-08 12:17:49', '2026-09-08 12:17:50', 'new', NULL, '{\"route\":\"api\\/web\\/sales_orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-08 12:17:49', '2026-09-08 12:17:50'),
(190, 'bcffa9298d2d095e8ad44cbfd8c437f5f8de8dc96fee9eae14800461e7dc55ce', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/permissions', 'GET', NULL, 1, '2026-09-09 00:15:38', '2026-09-09 00:15:38', 'new', NULL, '{\"route\":\"api\\/core\\/permissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-09 00:15:38', '2026-09-09 00:15:38'),
(191, 'ff6b7b695d60d4c6ff771073df20bff880e13699c498bcb4f26ecfe9300e42fa', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/logs', 'GET', NULL, 2, '2026-09-09 10:06:10', '2026-09-09 10:06:10', 'new', NULL, '{\"route\":\"api\\/web\\/logs\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-09 10:06:10', '2026-09-09 10:06:10'),
(193, 'b1417b3baa0be5a2efa91fe226039512eda6efd1c901e6b219fb4f3e48f10db9', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/customers', 'GET', NULL, 2, '2026-09-10 16:09:17', '2026-09-10 16:09:17', 'new', NULL, '{\"route\":\"api\\/shop\\/customers\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-10 16:09:17', '2026-09-10 16:09:17'),
(195, '8cc702d253a60d5844feae47c02ed727e0909261f29b7c9d12ef623c9aa9428c', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-09-11 16:11:25', '2026-09-11 16:11:25', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-11 16:11:25', '2026-09-11 16:11:25'),
(196, '6b297f1bbb0a9cd535818eaeb1c32e26d619c7c59d10ed48a0dc39019fd444dd', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu', 'GET', NULL, 1, '2026-09-11 16:12:08', '2026-09-11 16:12:08', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":6}', '2026-09-11 16:12:08', '2026-09-11 16:12:08'),
(197, 'bbc7e80a00f884e891a7485322672bc57c5f3fd51f86e0c4a573c036c3846ca1', 'sales_lead_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/public/sales-leads/gVp6Zb6REnxXTBNxJZ5eScSQVe6oEShmv3avcUmr', 'GET', NULL, 1, '2026-09-11 16:59:51', '2026-09-11 16:59:51', 'new', NULL, '{\"route\":\"api\\/public\\/sales-leads\\/gVp6Zb6REnxXTBNxJZ5eScSQVe6oEShmv3avcUmr\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"already_used\",\"lead_id\":28}', '2026-09-11 16:59:51', '2026-09-11 16:59:51'),
(198, '46a8b9980c79bc5cb6b336b2a83716b61d4f42a588d9d27a86e6b751f5fa2b16', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/projects', 'GET', NULL, 2, '2026-09-11 23:57:34', '2026-09-11 23:57:35', 'new', NULL, '{\"route\":\"api\\/web\\/projects\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-11 23:57:34', '2026-09-11 23:57:35'),
(200, 'a12c43c1c6b61b1fb9159298a8a9fcd9605911cda46b438d7c7458a77c143891', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/project-threads', 'GET', NULL, 1, '2026-09-11 23:57:35', '2026-09-11 23:57:35', 'new', NULL, '{\"route\":\"api\\/web\\/project-threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-11 23:57:35', '2026-09-11 23:57:35'),
(201, 'bd0c270335d78f70a4ec360c08049a16854d50222d94490ff8a2ff1fdc9180da', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/project-threads/4', 'GET', NULL, 1, '2026-09-12 08:44:15', '2026-09-12 08:44:15', 'new', NULL, '{\"route\":\"api\\/web\\/project-threads\\/4\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-12 08:44:15', '2026-09-12 08:44:15'),
(202, 'c384c2ae43a3e9a6da28b76333aeb0d8e7df61c32381fe8c6d4ce26215e134f5', 'project_session_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu', 'GET', NULL, 1, '2026-09-12 10:24:55', '2026-09-12 10:24:55', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/NwutpbQX1kb2nOxAjuXXySNvkcQ5nd6idseHKW8eoeigc7Hu\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"project_unavailable\"}', '2026-09-12 10:24:55', '2026-09-12 10:24:55'),
(203, 'da39649bd3ae2d5c05e587a94b10ecc0e6deb72681ec7331064ea07c945620c3', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/project-threads', 'GET', NULL, 1, '2026-09-12 12:23:36', '2026-09-12 12:23:36', 'new', NULL, '{\"route\":\"api\\/web\\/project-threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-12 12:23:36', '2026-09-12 12:23:36'),
(204, '62b1f9ab94998f242ed64983dd086d5dd0b88d5a4f31a7bc85d181202cb0274c', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/pPE1Uled6dKvHegiQBoip68tOVvpk8LMQFufwvjOmo9bMbhm', 'GET', NULL, 1, '2026-09-13 18:25:30', '2026-09-13 18:25:30', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/pPE1Uled6dKvHegiQBoip68tOVvpk8LMQFufwvjOmo9bMbhm\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":7}', '2026-09-13 18:25:30', '2026-09-13 18:25:30'),
(205, '0c120a5d86d523fff0989921b3f0d020d59067f92e37b723e175172207c34ef9', 'project_session_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/projects/public/pPE1Uled6dKvHegiQBoip68tOVvpk8LMQFufwvjOmo9bMbhm/threads', 'GET', NULL, 1, '2026-09-15 08:37:01', '2026-09-15 08:37:01', 'new', NULL, '{\"route\":\"api\\/projects\\/public\\/pPE1Uled6dKvHegiQBoip68tOVvpk8LMQFufwvjOmo9bMbhm\\/threads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"session_mismatch_or_expired\",\"project_id\":7}', '2026-09-15 08:37:01', '2026-09-15 08:37:01'),
(206, '640a0c714d723d7868a2d87e5b7eeeffe712d7829456eb533450f8940f96ac03', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-09-16 01:51:16', '2026-09-16 01:51:16', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:16'),
(207, 'd9de97455ba7ed2bc7ff7731c0a715aa4051a7606417151d2638bb3fa5283552', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/support_tickets', 'GET', NULL, 1, '2026-09-16 01:51:16', '2026-09-16 01:51:16', 'new', NULL, '{\"route\":\"api\\/web\\/support_tickets\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:16'),
(208, '20e460455e8c7c224888c79d06bc7e671e37cd1aef932f4b34a714d1fac90c82', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/job_applications', 'GET', NULL, 1, '2026-09-16 01:51:16', '2026-09-16 01:51:16', 'new', NULL, '{\"route\":\"api\\/web\\/job_applications\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:16'),
(209, '9f1d9ece6098c3ea56e7ae7ebefc9eae829374ef3d181ffe92eab9cc5bf2cd98', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_leads', 'GET', NULL, 1, '2026-09-16 01:51:16', '2026-09-16 01:51:16', 'new', NULL, '{\"route\":\"api\\/web\\/sales_leads\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:16'),
(210, '26b39d9cd9823cbc25f3b76fdaaff00e65217088869377ca324370d723903102', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/sales_orders', 'GET', NULL, 1, '2026-09-16 01:51:16', '2026-09-16 01:51:16', 'new', NULL, '{\"route\":\"api\\/web\\/sales_orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:16'),
(211, 'c335749af43f3411b64264f5e11a0dd22ec0a77f2bbd626f1aff4a8b9189331f', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 1, '2026-09-16 01:51:16', '2026-09-16 01:51:16', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:16'),
(212, 'c456a5fc779bdb993c17cb7bff4ae372da34e43f2bf5d735ae855357ac757f6a', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/logs', 'GET', NULL, 2, '2026-09-16 01:51:16', '2026-09-16 01:51:17', 'new', NULL, '{\"route\":\"api\\/web\\/logs\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:16', '2026-09-16 01:51:17'),
(214, '12326f27cf39cf0f4fc4af4e04824f5dd9d1ad491ede1d0d137c6a20e5a551e4', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/settings', 'GET', NULL, 1, '2026-09-16 01:51:17', '2026-09-16 01:51:17', 'new', NULL, '{\"route\":\"api\\/web\\/settings\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 01:51:17', '2026-09-16 01:51:17'),
(215, '9714f89e4ca7aaac2c5f835b6c2a5da061371a75f4b3b5528c069a4f3064e947', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/orders', 'GET', NULL, 4, '2026-09-16 10:16:55', '2026-09-16 10:16:56', 'new', NULL, '{\"route\":\"api\\/shop\\/orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 10:16:55', '2026-09-16 10:16:56'),
(217, '5a07cf8593e4dec3ecd9d299260ec30e46b711b79f390721f7a26f9eab01335c', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/products', 'GET', NULL, 2, '2026-09-16 10:16:55', '2026-09-16 10:16:56', 'new', NULL, '{\"route\":\"api\\/shop\\/products\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 10:16:55', '2026-09-16 10:16:56'),
(218, 'c8b8e6c09fd083756323cfe09f2a49b3715a003b65c256daef1f15236b275ced', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/payment_methods', 'GET', NULL, 1, '2026-09-16 10:16:55', '2026-09-16 10:16:55', 'new', NULL, '{\"route\":\"api\\/shop\\/payment_methods\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 10:16:55', '2026-09-16 10:16:55'),
(219, 'e7637fd78c787e32acae2bc5c5c12e743b93c65d2d13d56a5f19893b96d70c27', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/shipping_methods', 'GET', NULL, 1, '2026-09-16 10:16:55', '2026-09-16 10:16:55', 'new', NULL, '{\"route\":\"api\\/shop\\/shipping_methods\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 10:16:55', '2026-09-16 10:16:55'),
(220, '9baacf0f15bc9ed5b5bb52f9e114fcd582fd000af336f67775aeb2363b3184e1', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/shop/coupons', 'GET', NULL, 1, '2026-09-16 10:16:55', '2026-09-16 10:16:55', 'new', NULL, '{\"route\":\"api\\/shop\\/coupons\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 10:16:55', '2026-09-16 10:16:55'),
(224, '52ec8d3665877256c5579467e072fa892bb0a4f4926e3d6b82824efb10cc78ec', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/external_links', 'GET', NULL, 2, '2026-09-16 22:57:32', '2026-09-16 22:57:32', 'new', NULL, '{\"route\":\"api\\/core\\/external_links\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-16 22:57:32', '2026-09-16 22:57:32'),
(226, '6259d32e023f01ec0a1a78811eb9aa55c901bbac0d59f4eef89a0922c19bff9c', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-09-16 23:18:18', '2026-09-16 23:18:18', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-09-16 23:18:18', '2026-09-16 23:18:18'),
(227, 'c500e4084a586f9a045f4a56805f6a57ded3a4313f4b96bf3c1ff8733823a3b8', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/logout', 'POST', NULL, 1, '2026-09-17 14:24:17', '2026-09-17 14:24:17', 'new', NULL, '{\"route\":\"api\\/logout\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-17 14:24:17', '2026-09-17 14:24:17'),
(228, '3183ea025500024817067f8bc04caf799396ad9fcd95815cb26ee7364a5c3e1d', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/legal/config', 'GET', NULL, 2, '2026-09-18 16:35:00', '2026-09-18 16:35:00', 'new', NULL, '{\"route\":\"api\\/legal\\/config\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-18 16:35:00', '2026-09-18 16:35:00'),
(230, '3f8d8174cbe048ef1b83e7d3703c4d9cca6a41b4a8ad0712b59122ddcd292089', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36', 'api/login', 'POST', NULL, 2, '2026-09-18 21:44:20', '2026-09-18 21:44:24', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (Linux; Android 15; Pixel 9) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Mobile Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-09-18 21:44:20', '2026-09-18 21:44:24'),
(232, 'ca68abbafce8b14658a016b00c1db8692a6594ff492407a2d01d4700fafd2e0c', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-09-21 22:10:24', '2026-09-21 22:10:24', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (Linux; Android 15; Pixel 9) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Mobile Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-09-21 22:10:24', '2026-09-21 22:10:24'),
(233, '50346897fcb0eb9ab26221cc675202144ac9fbcae5f4cba58978d8ea79b7c732', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/logout', 'POST', NULL, 1, '2026-09-25 09:14:46', '2026-09-25 09:14:46', 'new', NULL, '{\"route\":\"api\\/logout\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-25 09:14:46', '2026-09-25 09:14:46'),
(234, '98343704e3430c703a969e8aa358956d9d104f86349de48cc19273136fd9fdba', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/web/raw_request_commissions', 'GET', NULL, 1, '2026-09-25 09:14:47', '2026-09-25 09:14:47', 'new', NULL, '{\"route\":\"api\\/web\\/raw_request_commissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-25 09:14:47', '2026-09-25 09:14:47'),
(235, '98538101c91d89b0e0ae800e075de5040e4c1694856c73f3f0694e592278f1a5', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', 25, 1, '2026-09-26 01:45:05', '2026-09-26 01:45:05', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":25,\"attempted_email\":\"johndoe@jonclsolutions.com\",\"attempted_domain\":\"jonclsolutions.com\"}', '2026-09-26 01:45:05', '2026-09-26 01:45:05'),
(236, 'bc523435a85745ba5ce61f0f925a615a77da04204ca942b3df3423328b6fcfe5', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/save_translations/web', 'POST', NULL, 1, '2026-09-29 23:18:21', '2026-09-29 23:18:21', 'new', NULL, '{\"route\":\"api\\/save_translations\\/web\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-29 23:18:21', '2026-09-29 23:18:21'),
(237, '60a23ea48c444794d821f6ff5ced779ef0ac72f4d8f7d4e1dc3ff4423c8bd750', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/permissions', 'GET', NULL, 1, '2026-09-30 16:02:24', '2026-09-30 16:02:24', 'new', NULL, '{\"route\":\"api\\/core\\/permissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-30 16:02:24', '2026-09-30 16:02:24'),
(238, '5923fec865dfea0d5e55356e413bf78628f7f466c0611adf3c9a31363f3ad9f8', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'GET', NULL, 1, '2026-09-30 18:43:18', '2026-09-30 18:43:18', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-30 18:43:18', '2026-09-30 18:43:18'),
(239, '9ac55114d1910516be44727dc1c02740fd1dff091bb83936e78d56049c8e56b6', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/legal/document-sections', 'GET', NULL, 1, '2026-09-30 18:43:18', '2026-09-30 18:43:18', 'new', NULL, '{\"route\":\"api\\/legal\\/document-sections\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-30 18:43:18', '2026-09-30 18:43:18'),
(240, '86c05427df9341942c8b67ad58e61099d75fca9fc56cc6236fd4a6d9e3aca47c', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/external_links', 'GET', NULL, 1, '2026-09-30 18:43:18', '2026-09-30 18:43:18', 'new', NULL, '{\"route\":\"api\\/core\\/external_links\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-30 18:43:18', '2026-09-30 18:43:18'),
(241, 'ebb82c212d6889cb51ca8807b0a014330acfd1cd71937d8bdd6ba2dfcd4e8376', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/logs', 'GET', NULL, 2, '2026-09-30 18:43:18', '2026-09-30 18:43:18', 'new', NULL, '{\"route\":\"api\\/core\\/logs\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-09-30 18:43:18', '2026-09-30 18:43:18'),
(243, '31da47f8019b3fd7126e09876d9ef57dfcfb6ec2bc0e891431df421f8ee9c70a', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/25', 'GET', NULL, 1, '2026-10-03 12:59:02', '2026-10-03 12:59:02', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/25\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-03 12:59:02', '2026-10-03 12:59:02'),
(244, '965cb0464a8c10318ded50b5c87aa32bfff7127b7aa48651b899bcbbd5fe8bfd', 'refresh_token_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/refresh', 'POST', NULL, 1, '2026-10-03 13:54:02', '2026-10-03 13:54:02', 'new', NULL, '{\"route\":\"api\\/refresh\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-03 13:54:02', '2026-10-03 13:54:02'),
(245, '1fb16ec5333c85895406593fb65b979e6e7b2225ae36b34f7e1b39cbe33acc88', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-05 10:10:52', '2026-10-05 10:10:52', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"johndoe@jonclsolutions.com\"}', '2026-10-05 10:10:52', '2026-10-05 10:10:52'),
(246, 'f62e18855d9d35d86e108692ca7d979cceef1c09d3f28a842f30821c31641db2', 'permission_denied', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'GET', NULL, 8, '2026-10-05 10:11:27', '2026-10-05 10:14:13', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 10:11:27', '2026-10-05 10:14:13'),
(254, '67d1bb4c74a6c7caf99122b094c7a08a9396eaf4c5ca519de6064bc6ce65f6f4', 'permission_denied', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'GET', NULL, 6, '2026-10-05 10:20:28', '2026-10-05 10:20:35', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 10:20:28', '2026-10-05 10:20:35'),
(260, '253a760271c809d4beb3a63ca131043f5144ad72b189b02ac5c3c7acd1650d3b', 'permission_denied', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/core/users', 'GET', NULL, 2, '2026-10-05 12:41:33', '2026-10-05 12:43:21', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 12:41:33', '2026-10-05 12:43:21'),
(262, '04f90702c6469e034c18e99488a66e3971e07b17ac21df20195b8533097f2d92', 'permission_denied', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/core/users', 'GET', NULL, 2, '2026-10-05 12:56:28', '2026-10-05 12:56:28', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 12:56:28', '2026-10-05 12:56:28'),
(263, 'ac78569155f1e6e38618e2a86791ae7f0f2b50c9c1b7857513560f1bf1343988', 'permission_denied', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/core/users/34', 'GET', NULL, 4, '2026-10-05 12:56:28', '2026-10-05 12:56:29', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/34\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 12:56:28', '2026-10-05 12:56:29'),
(268, '0b2de211d620070312e3b6748e8a01a4f9c6b8e33444fb8a8fd1fcdf5b95520a', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'curl/8.11.1', 'api/core/users', 'GET', NULL, 1, '2026-10-05 12:59:31', '2026-10-05 12:59:31', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-10-05 12:59:31', '2026-10-05 12:59:31'),
(269, '391684ae6da9c0a9bb2fd68d9d0ae909fe208028275e40e4b0293733f280e823', 'permission_denied', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/core/users', 'GET', NULL, 2, '2026-10-05 13:00:01', '2026-10-05 13:00:02', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 13:00:01', '2026-10-05 13:00:02'),
(270, 'ca8870226795ee201196c9f009769a93c34ceb03a8fabbc87eb276b977eeb33d', 'permission_denied', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/core/users/34', 'GET', NULL, 4, '2026-10-05 13:00:01', '2026-10-05 13:00:02', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/34\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":100,\"required_permission\":\"core-administrators-view\"}', '2026-10-05 13:00:01', '2026-10-05 13:00:02'),
(275, '47fdf9475b9da90be0f354094483828521314b584df22564fe6fd13831a55bb1', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'curl/8.11.1', 'api/core/users', 'GET', NULL, 3, '2026-10-05 13:35:02', '2026-10-05 13:35:02', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null}', '2026-10-05 13:35:02', '2026-10-05 13:35:02'),
(278, 'a6170836348d25ec63c46c234b85a680e2e977bd08e9434c7a424cf5bee4aae8', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', NULL, 1, '2026-10-05 15:38:23', '2026-10-05 15:38:23', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":100,\"attempted_email\":\"joner@rpsw.com\",\"attempted_domain\":\"rpsw.com\"}', '2026-10-05 15:38:23', '2026-10-05 15:38:23'),
(279, '4b887b9c37fda1ca85e623806b910fc776718534f65d0e820c640a98d70dfdb1', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-05 23:54:01', '2026-10-05 23:54:01', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"john@jonclsolutions.com\"}', '2026-10-05 23:54:01', '2026-10-05 23:54:01'),
(280, '61353983951bd41df9f46fc786d3c2ff83b210752102bc6660c4270057cd20b4', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', NULL, 1, '2026-10-06 00:00:46', '2026-10-06 00:00:46', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":100,\"attempted_email\":\"asd@pombar.cz\",\"attempted_domain\":\"pombar.cz\"}', '2026-10-06 00:00:46', '2026-10-06 00:00:46'),
(281, '4aa0593631e8adcec0cea39a00444205663a52357c9e57d595e23d24fffc29bb', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', NULL, 1, '2026-10-06 13:25:50', '2026-10-06 13:25:50', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":100,\"attempted_email\":\"joneadasdadar@rpsw.cz\",\"attempted_domain\":\"rpsw.cz\"}', '2026-10-06 13:25:50', '2026-10-06 13:25:50');
INSERT INTO `core_security_events` (`id`, `fingerprint`, `event_type`, `severity`, `ip_address`, `user_agent`, `route`, `method`, `user_id`, `occurrences`, `first_seen_at`, `last_seen_at`, `status`, `notes`, `context_data`, `created_at`, `updated_at`) VALUES
(282, '50fdc09753b983d99761893fefb337aa09a537c34b2fba012f5412da2937d316', 'user_create_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'POST', NULL, 1, '2026-10-07 00:58:14', '2026-10-07 00:58:14', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":100,\"attempted_email\":\"asdasdkaslkd@jonclsolutions.cz\",\"attempted_domain\":\"jonclsolutions.cz\"}', '2026-10-07 00:58:14', '2026-10-07 00:58:14'),
(283, 'bec7b6ef2ffb35774684d0f3ffd913817cf1bd4c0fb856df8249f2b9a510c55e', 'login_failed', 'warning', '127.0.0.1', 'curl/8.11.1', 'api/login', 'POST', NULL, 1, '2026-10-09 09:47:31', '2026-10-09 09:47:31', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":null,\"email\":\"lindicka@mazliva.cz\"}', '2026-10-09 09:47:31', '2026-10-09 09:47:31'),
(284, '7270eb529c076b07c30876d8b2dd44ad011e2ebcd060c065912b47d018b4da1d', 'refresh_token_invalid', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/refresh', 'POST', NULL, 1, '2026-10-09 11:57:46', '2026-10-09 11:57:46', 'new', NULL, '{\"route\":\"api\\/refresh\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 11:57:46', '2026-10-09 11:57:46'),
(285, 'c697ae2287f28f3ea983b3e398cdc21b0e9a1b746418767c312306826abcfbe3', 'login_email_not_allowed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 2, '2026-10-09 12:32:52', '2026-10-09 12:33:20', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":102,\"email\":\"test@hovniklad.cz\"}', '2026-10-09 12:32:52', '2026-10-09 12:33:20'),
(286, 'f6ced88fa6dbc5668bb00ed365d3c326a0140dc568019bdadab48e9ae564b0e8', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 2, '2026-10-09 12:32:59', '2026-10-09 12:33:16', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"test@hovniklad.cz\"}', '2026-10-09 12:32:59', '2026-10-09 12:33:16'),
(289, '16f36e9e76b5a4a6c4c5a480e9be297fc6ddf80bc5f4d24fd1a4a4841ebd8508', 'user_update_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/102', 'PUT', 25, 1, '2026-10-09 12:34:58', '2026-10-09 12:34:58', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/102\",\"method\":\"PUT\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":25,\"attempted_email\":\"test@jonclsolutions.cz\",\"attempted_domain\":\"jonclsolutions.cz\"}', '2026-10-09 12:34:58', '2026-10-09 12:34:58'),
(290, '43acbd95ef4b350e5008b87d015a97930eb651d21f447fda83a3faca74aa2877', 'user_update_domain_not_whitelisted', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/102', 'PUT', 25, 1, '2026-10-09 12:35:23', '2026-10-09 12:35:23', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/102\",\"method\":\"PUT\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":25,\"attempted_email\":\"test@gamber.com\",\"attempted_domain\":\"gamber.com\"}', '2026-10-09 12:35:23', '2026-10-09 12:35:23'),
(291, 'a59de7a72848a2488a3e9a0db82e2d2b37de6b89e0189f0e2f2f0f47a6b32558', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users/100', 'PUT', NULL, 1, '2026-10-09 14:13:11', '2026-10-09 14:13:11', 'new', NULL, '{\"route\":\"api\\/core\\/users\\/100\",\"method\":\"PUT\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 14:13:11', '2026-10-09 14:13:11'),
(292, '4d6fff1fbf51e5be1f25d04bf79cd174247ab9ed5533f785a47e21251c9a6434', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'GET', NULL, 2, '2026-10-09 15:45:19', '2026-10-09 15:45:19', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 15:45:19', '2026-10-09 15:45:19'),
(294, '65ee3bc900e68f15c8aec1f6961132ecc0fda3524661352b59ecf9a23577bf9c', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/roles', 'GET', NULL, 2, '2026-10-09 15:45:19', '2026-10-09 15:45:19', 'new', NULL, '{\"route\":\"api\\/core\\/roles\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 15:45:19', '2026-10-09 15:45:19'),
(295, 'c57dc68b6274cbcd8252cc99b9d6336f7ff45639aa06e7a0223423bc4fd5b0e0', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/permissions', 'GET', NULL, 1, '2026-10-09 15:45:19', '2026-10-09 15:45:19', 'new', NULL, '{\"route\":\"api\\/core\\/permissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 15:45:19', '2026-10-09 15:45:19'),
(297, 'b6ed72e8b4652930122fc84176c5730b87b4f6cff1eccb8512aa66a87846f079', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/mL6ACvy7Bn3yt7EihPdYs50dtLeBwfCySS5BpUUTRTob4NcyMpihwsuP8hSXk6gb', 'GET', NULL, 1, '2026-10-09 16:37:30', '2026-10-09 16:37:30', 'new', NULL, '{\"route\":\"api\\/account-activation\\/mL6ACvy7Bn3yt7EihPdYs50dtLeBwfCySS5BpUUTRTob4NcyMpihwsuP8hSXk6gb\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"expired\"}', '2026-10-09 16:37:30', '2026-10-09 16:37:30'),
(298, '54db63b6cc6abab4b78b9609a7e5f9ca5d385ea3ac587879bcb79682750a2cbf', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/mL6ACvy7Bn3yt7EihPdYs50dtLeBwfCySS5BpUUTRTob4NcyMpihwsuP8hSXk6gb', 'GET', NULL, 2, '2026-10-09 16:42:54', '2026-10-09 16:43:01', 'new', NULL, '{\"route\":\"api\\/account-activation\\/mL6ACvy7Bn3yt7EihPdYs50dtLeBwfCySS5BpUUTRTob4NcyMpihwsuP8hSXk6gb\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"expired\"}', '2026-10-09 16:42:54', '2026-10-09 16:43:01'),
(300, 'ace419cbf80101b7b1ebe3f0ef335db728d2368f14d617bc17dcf5475b77c22e', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/mL6ACvy7Bn3yt7EihPdYs50dtLeBwfCySS5BpUUTRTob4NcyMpihwsuP8hSXk6gb', 'GET', NULL, 4, '2026-10-09 16:45:28', '2026-10-09 16:46:52', 'new', NULL, '{\"route\":\"api\\/account-activation\\/mL6ACvy7Bn3yt7EihPdYs50dtLeBwfCySS5BpUUTRTob4NcyMpihwsuP8hSXk6gb\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"expired\"}', '2026-10-09 16:45:28', '2026-10-09 16:46:52'),
(304, '29d9bc864c953ca61953ae877c65e7b4e81ccfc66a94e848052e686d2addd3a1', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/WnKKJZKjEhaVCAL6PGSPAMSHhuO8aJ7hzgG0rsBZ0nizLk9era98mPOBPtFgWRFO', 'GET', NULL, 1, '2026-10-09 16:48:26', '2026-10-09 16:48:26', 'new', NULL, '{\"route\":\"api\\/account-activation\\/WnKKJZKjEhaVCAL6PGSPAMSHhuO8aJ7hzgG0rsBZ0nizLk9era98mPOBPtFgWRFO\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-10-09 16:48:26', '2026-10-09 16:48:26'),
(305, 'ca7255cc7fef7ec622bf01e1f8b681d8999b539f3973bcc256b451b8cbbd6694', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/WnKKJZKjE_CHANGE_THIS_TOKEN_URL_haVCAL6PGSPAMSHhuO8aJ7hzgG0rsBZ0nizLk9era98mPOBPtFgWRFO', 'GET', NULL, 1, '2026-10-09 16:49:48', '2026-10-09 16:49:48', 'new', NULL, '{\"route\":\"api\\/account-activation\\/WnKKJZKjE_CHANGE_THIS_TOKEN_URL_haVCAL6PGSPAMSHhuO8aJ7hzgG0rsBZ0nizLk9era98mPOBPtFgWRFO\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-10-09 16:49:48', '2026-10-09 16:49:48'),
(306, 'd29a79ccbe9cb237a311ac8f6751f76cffbdca1ea52f924bccd65404108481cc', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg', 'POST', NULL, 1, '2026-10-09 16:56:59', '2026-10-09 16:56:59', 'new', NULL, '{\"route\":\"api\\/account-activation\\/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"expired\"}', '2026-10-09 16:56:59', '2026-10-09 16:56:59'),
(307, '61053b80261ecc7fb3677709578e2031fc601387e48d22648ef07b95d0660c67', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg', 'GET', NULL, 1, '2026-10-09 17:10:01', '2026-10-09 17:10:01', 'new', NULL, '{\"route\":\"api\\/account-activation\\/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"expired\"}', '2026-10-09 17:10:01', '2026-10-09 17:10:01'),
(308, '76d4104f7e10e22a09c0f69f5d8bc54efa573a6e025c401ee805d2b0a5174b79', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg', 'GET', NULL, 6, '2026-10-09 17:17:55', '2026-10-09 17:19:59', 'new', NULL, '{\"route\":\"api\\/account-activation\\/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-10-09 17:17:55', '2026-10-09 17:19:59'),
(314, 'f7659d2dc143a5c57447aa68be152d82ad4fa566645bc6349705d600ccd98237', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg', 'GET', NULL, 1, '2026-10-09 17:21:04', '2026-10-09 17:21:04', 'new', NULL, '{\"route\":\"api\\/account-activation\\/3De4oYUY2L2c4sgKK6zkT3NtHag02GD3qjRhEUgHcXIpBNVKG7Ym3TeA8OK8wjIg\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-10-09 17:21:04', '2026-10-09 17:21:04'),
(315, '8e5be8e5b7d4d8adcdcffa32ca6c066ad010ee1410ad014799d2e002fccc650c', 'account_activation_token_invalid', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/account-activation/7RedzigjsWpcvZHwnh1h7rmP0D5ZFLhqU84Lz1RZDfIG7d3WR7ww8kIkgR7DQ3R0', 'GET', NULL, 1, '2026-10-09 17:31:20', '2026-10-09 17:31:20', 'new', NULL, '{\"route\":\"api\\/account-activation\\/7RedzigjsWpcvZHwnh1h7rmP0D5ZFLhqU84Lz1RZDfIG7d3WR7ww8kIkgR7DQ3R0\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null,\"reason\":\"not_found\"}', '2026-10-09 17:31:20', '2026-10-09 17:31:20'),
(316, '48b19b738c004bd2e279cdee77ef88783d5d54ce6fbc09f6fb9c23ade7dbda27', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/users', 'GET', NULL, 2, '2026-10-09 21:53:12', '2026-10-09 21:53:12', 'new', NULL, '{\"route\":\"api\\/core\\/users\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 21:53:12', '2026-10-09 21:53:12'),
(318, 'a3bf863585c9e129f3b9f309b47ba7bb8e1409aeb0cf22fc3ad59f429a3cd7e5', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/roles', 'GET', NULL, 2, '2026-10-09 21:53:12', '2026-10-09 21:53:12', 'new', NULL, '{\"route\":\"api\\/core\\/roles\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 21:53:12', '2026-10-09 21:53:12'),
(319, 'd7d40f5583bf66cdba1cd10d00cd47fdb5c4ac1a8846286694f1924e38258310', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', 'api/core/permissions', 'GET', NULL, 1, '2026-10-09 21:53:12', '2026-10-09 21:53:12', 'new', NULL, '{\"route\":\"api\\/core\\/permissions\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/151.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-09 21:53:12', '2026-10-09 21:53:12'),
(321, '0442fc300716348bf486d0381031520d6f98cfaedafd2d49117700fbb6f4f0f6', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 2, '2026-10-21 00:57:10', '2026-10-21 00:57:27', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-21 00:57:10', '2026-10-21 00:57:27'),
(323, 'ea0a4534e938148f4893e0beadf8628b4e24384f73d587334be5ba8afd61f96b', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-21 09:49:33', '2026-10-21 09:49:33', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-21 09:49:33', '2026-10-21 09:49:33'),
(324, 'f940889d4028c6d7d16b2603d1e67dd0fa8bf72b95648fd14d7d75967f7405b7', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-10-22 16:24:57', '2026-10-22 16:24:57', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-22 16:24:57', '2026-10-22 16:24:57'),
(325, '25acdba9b7556bc247616e76c020547df465dfe0742a9246a012493be3b5e502', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/shop/orders', 'GET', NULL, 2, '2026-10-22 16:24:57', '2026-10-22 16:24:57', 'new', NULL, '{\"route\":\"api\\/shop\\/orders\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-22 16:24:57', '2026-10-22 16:24:57'),
(327, '97b1049f73d87ac7360fe14cea68ca89f8787c5342a60670ce766099f46896f3', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/shop/categories', 'GET', NULL, 1, '2026-10-22 16:24:57', '2026-10-22 16:24:57', 'new', NULL, '{\"route\":\"api\\/shop\\/categories\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-22 16:24:57', '2026-10-22 16:24:57'),
(328, 'b4ad012432e560b93e2bd9503bcf1fec6e0365a7efb6cb26f842adbb60c324c6', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/shop/suppliers', 'GET', NULL, 1, '2026-10-22 16:24:57', '2026-10-22 16:24:57', 'new', NULL, '{\"route\":\"api\\/shop\\/suppliers\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-22 16:24:57', '2026-10-22 16:24:57'),
(329, 'b35e429bd06364ffec9d58e58ef989a53fd65dfd1769e7a4c40b67408d1a13aa', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-10-22 22:36:52', '2026-10-22 22:36:52', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-22 22:36:52', '2026-10-22 22:36:52'),
(330, '0ec52724709de0a152c26dece8a53d91fee34f258169591f3aa1f26a9f3256e7', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-10-22 23:36:04', '2026-10-22 23:36:04', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-22 23:36:04', '2026-10-22 23:36:04'),
(331, '2eba279378cd4810033b6542ea8f5587c970ff290c12f0005f2be2cea4d9cbb9', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-10-23 11:19:38', '2026-10-23 11:19:38', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-23 11:19:38', '2026-10-23 11:19:38'),
(332, 'fd63d2ec8d27aa1cbfb06b0b59c558e9175dd645a8a5a308d39eff2e88940350', 'unauthenticated_access_attempt', 'info', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 'api/web/news', 'GET', NULL, 1, '2026-10-23 16:50:42', '2026-10-23 16:50:42', 'new', NULL, '{\"route\":\"api\\/web\\/news\",\"method\":\"GET\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) HeadlessChrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null}', '2026-10-23 16:50:42', '2026-10-23 16:50:42'),
(333, '30d560d3ebd7252b1fb3c9d157d26a127dc793f110cbe4a1c29494a893edd3d6', 'login_email_not_allowed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', 34, 1, '2026-10-24 12:11:52', '2026-10-24 12:11:52', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":34,\"email\":\"lindicka@mazliva.cz\"}', '2026-10-24 12:11:52', '2026-10-24 12:11:52'),
(334, 'fda8780112275321a87cbed117bc5fb915e751bbee6a845fc2857610405d189a', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-24 12:34:43', '2026-10-24 12:34:43', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"xxx@xxx.cz\"}', '2026-10-24 12:34:43', '2026-10-24 12:34:43'),
(335, '191a14ff54bb140b5435635f0f4019a273f3f633a77777d5e982b9c406297c11', 'login_email_not_allowed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', 25, 2, '2026-10-26 18:43:37', '2026-10-26 18:44:40', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":25,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-26 18:43:37', '2026-10-26 18:44:40'),
(337, '34bf7ef8ff0f4fbcb5018b1669db593618f0ec8071636691e9343775fed65fbb', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 5, '2026-10-26 18:45:10', '2026-10-26 18:48:31', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-26 18:45:10', '2026-10-26 18:48:31'),
(338, '2519534845050a095a1ec7df34db25892855fc4a6f182c965c27fc13e62e05cf', 'login_email_not_allowed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', 25, 1, '2026-10-26 18:45:24', '2026-10-26 18:45:24', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":25,\"email\":\"jonasbucina@jonclsolutions.cz\"}', '2026-10-26 18:45:24', '2026-10-26 18:45:24'),
(342, 'ca005155432640bf672b4defc978ea14b264ddd78f37aa7584bf0524c0201d8a', 'login_brute_force_suspected', 'critical', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-26 18:48:00', '2026-10-26 18:48:00', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@jonclsolutions.com\"}', '2026-10-26 18:48:00', '2026-10-26 18:48:00'),
(344, 'a67a72820ce74a02a1751d8c3abea22b3033cf887bfc32b6da14f6b3ce7dfcc7', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 2, '2026-10-26 18:54:50', '2026-10-26 18:54:54', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-26 18:54:50', '2026-10-26 18:54:54'),
(346, 'c0e89fb75c7ad2948b4ace280f6f7a113bfb722e4d8d543eb6f6a531af6be1b4', 'login_brute_force_suspected', 'critical', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-26 18:54:54', '2026-10-26 18:54:54', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-26 18:54:54', '2026-10-26 18:54:54'),
(347, '8394601ae95ece9f8e7771d387172421abc486c5e71e859a2fe5a71e81d79e30', 'login_captcha_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 4, '2026-10-26 18:55:15', '2026-10-26 18:58:14', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\",\"reason\":\"empty_token\"}', '2026-10-26 18:55:15', '2026-10-26 18:58:14'),
(348, 'f01de73ade17c33714f58683e9ae4c313fd38b4efff4b9f11c56f779d479d392', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 3, '2026-10-26 18:55:24', '2026-10-26 18:56:55', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-26 18:55:24', '2026-10-26 18:56:55'),
(354, 'ac14fe8819f4c091339b662e2654998ff42083e1142d524e3e22af5783a36c08', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-26 19:05:06', '2026-10-26 19:05:06', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-26 19:05:06', '2026-10-26 19:05:06'),
(355, 'e4cd9b31552245fa8f3e7ebd11a840ebecb4e3b3f3bbe8a5c22832306fc0c01e', 'login_email_not_allowed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', 34, 1, '2026-10-26 19:10:36', '2026-10-26 19:10:36', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":34,\"email\":\"lindicka@mazliva.cz\"}', '2026-10-26 19:10:36', '2026-10-26 19:10:36'),
(356, '30769a61eb3a6aba687c435e7af684d7662f1bdfc993a3f1010ec494bc77ca89', 'password_confirmation_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/confirm-password', 'POST', 25, 1, '2026-10-26 23:39:29', '2026-10-26 23:39:29', 'new', NULL, '{\"route\":\"api\\/confirm-password\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":25,\"scope\":\"user:34\"}', '2026-10-26 23:39:29', '2026-10-26 23:39:29'),
(357, '4d6592cf72bdd8de5bd051d595605fb33bac77ad69046981d23f901994b2bdfd', 'login_email_not_allowed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', 25, 1, '2026-10-27 00:00:59', '2026-10-27 00:00:59', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":25,\"email\":\"jonasbucina@rpsw.cz\"}', '2026-10-27 00:00:59', '2026-10-27 00:00:59'),
(358, '6fe5e87d3f88a760f14b719baf02aea888505d832ec49c33755a7d1320a6c4db', 'login_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/login', 'POST', NULL, 1, '2026-10-27 00:01:09', '2026-10-27 00:01:09', 'new', NULL, '{\"route\":\"api\\/login\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":null,\"email\":\"jonasbucina@asdasdasd.cz\"}', '2026-10-27 00:01:09', '2026-10-27 00:01:09'),
(359, '7d2bbf03fc640a18deec9c299eaf6b2ff9a6f97ef44833b752d438b70f8b3f44', 'password_confirmation_failed', 'warning', '127.0.0.1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', 'api/confirm-password', 'POST', 25, 1, '2026-10-27 00:02:55', '2026-10-27 00:02:55', 'new', NULL, '{\"route\":\"api\\/confirm-password\",\"method\":\"POST\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64) AppleWebKit\\/537.36 (KHTML, like Gecko) Chrome\\/155.0.0.0 Safari\\/537.36\",\"user_id\":25,\"scope\":\"user:34\"}', '2026-10-27 00:02:55', '2026-10-27 00:02:55');

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
(1, 365, 'jonclsolutions.com', '2026-08-22 13:34:11', '2026-10-06 00:05:29');

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
(1, 'gdpr', 'GDPR', '2026-06-12 19:15:23', '2026-09-06 09:25:04'),
(2, 'tos', 'TOS', '2026-06-12 19:15:23', '2026-09-06 09:25:04'),
(3, 'cookies', 'Cookies', '2026-07-31 21:50:49', '2026-09-06 09:25:04');

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
-- Table structure for table `legal_page_titles`
--

CREATE TABLE `legal_page_titles` (
  `id` int(10) UNSIGNED NOT NULL,
  `area` enum('web','shop','admin') NOT NULL COMMENT 'web = public website, shop = e-shop, admin = administration',
  `page_key` varchar(64) NOT NULL COMMENT 'Stable page identifier, matches Angular route title "area.page_key"',
  `route_path` varchar(255) NOT NULL COMMENT 'Informative URL shown in admin (not used for routing)',
  `title_i18n` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Tab title per language code' CHECK (json_valid(`title_i18n`)),
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `legal_page_titles`
--

INSERT INTO `legal_page_titles` (`id`, `area`, `page_key`, `route_path`, `title_i18n`, `sort_order`, `updated_at`) VALUES
(1, 'web', 'home', '/', '{\"cz\":\"JonclSolutions | Vývoj softwaru na míru\",\"en\":\"JonclSolutions | Custom software development\"}', 10, '2026-09-30 10:24:56'),
(2, 'web', 'services', '/services', '{\"cz\":\"Služby | JonclSolutions\",\"en\":\"Services | JonclSolutions\"}', 20, '2026-09-30 10:24:56'),
(3, 'web', 'references', '/references', '{\"cz\":\"Realizované projekty | JonclSolutions\",\"en\":\"Projects | JonclSolutions\"}', 30, '2026-09-30 10:24:56'),
(4, 'web', 'about-us', '/about-us', '{\"cz\":\"O nás | JonclSolutions\",\"en\":\"About us | JonclSolutions\"}', 40, '2026-09-30 10:24:56'),
(5, 'web', 'contact', '/contact', '{\"cz\":\"Kontakt | JonclSolutions\",\"en\":\"Contact | JonclSolutions\"}', 50, '2026-09-30 13:14:03'),
(6, 'web', 'faq', '/faq', '{\"cz\":\"Často kladené otázky | JonclSolutions\",\"en\":\"FAQ | JonclSolutions\"}', 60, '2026-09-30 10:24:56'),
(7, 'web', 'knowledge-base', '/knowledge-base', '{\"cz\":\"Centrum nápovědy | JonclSolutions\",\"en\":\"Help center | JonclSolutions\"}', 70, '2026-09-30 10:24:56'),
(8, 'web', 'jobs', '/jobs', '{\"cz\":\"Kariéra | JonclSolutions\",\"en\":\"Careers | JonclSolutions\"}', 80, '2026-09-30 10:24:56'),
(9, 'web', 'job-detail', '/jobs/:id', '{\"cz\":\"Volná pozice | JonclSolutions\",\"en\":\"Job opening | JonclSolutions\"}', 90, '2026-09-30 10:24:56'),
(10, 'web', 'order-form', '/order_form/:token', '{\"cz\":\"Objednávkový formulář | JonclSolutions\",\"en\":\"Order form | JonclSolutions\"}', 100, '2026-09-30 10:24:56'),
(11, 'web', 'privacy-policy', '/privacy-policy', '{\"cz\":\"Ochrana osobních údajů | JonclSolutions\",\"en\":\"Privacy policy | JonclSolutions\"}', 110, '2026-09-30 10:24:56'),
(12, 'web', 'tos', '/tos', '{\"cz\":\"Obchodní podmínky | JonclSolutions\",\"en\":\"Terms of service | JonclSolutions\"}', 120, '2026-09-30 10:24:56'),
(13, 'web', 'cookies-policy', '/cookies-policy', '{\"cz\":\"Zásady cookies | JonclSolutions\",\"en\":\"Cookie policy | JonclSolutions\"}', 130, '2026-09-30 10:24:56'),
(14, 'web', 'web-maintenance', '/web-maintenance', '{\"cz\":\"Probíhá údržba | JonclSolutions\",\"en\":\"Under maintenance | JonclSolutions\"}', 140, '2026-09-30 10:24:56'),
(15, 'web', 'not-found', '/404', '{\"cz\":\"Stránka nenalezena | JonclSolutions\",\"en\":\"Page not found | JonclSolutions\"}', 150, '2026-09-30 10:24:56'),
(16, 'shop', 'catalog', '/shop/catalog', '{\"cz\":\"E-shop | JonclSolutions\",\"en\":\"Shop | JonclSolutions\"}', 10, '2026-09-30 10:24:56'),
(17, 'shop', 'product-detail', '/shop/products/:slugOrId', '{\"cz\":\"Produkt | JonclSolutions\",\"en\":\"Product | JonclSolutions\"}', 20, '2026-09-30 10:24:56'),
(18, 'shop', 'cart', '/shop/cart', '{\"cz\":\"Košík | JonclSolutions\",\"en\":\"Cart | JonclSolutions\"}', 30, '2026-09-30 10:24:56'),
(19, 'shop', 'checkout', '/shop/checkout', '{\"cz\":\"Pokladna | JonclSolutions\",\"en\":\"Checkout | JonclSolutions\"}', 40, '2026-09-30 10:24:56'),
(20, 'shop', 'shop-maintenance', '/shop-maintenance', '{\"cz\":\"E-shop – údržba | JonclSolutions\",\"en\":\"Shop – maintenance | JonclSolutions\"}', 50, '2026-09-30 10:24:56'),
(21, 'web', 'project-portal', '/projects/:token', '{\"cz\":\"Projektový portál | JonclSolutions\",\"en\":\"Project portal | JonclSolutions\"}', 160, '2026-09-30 10:39:52'),
(42, 'admin', 'panel', '/admin', '{\"cz\":\"Administrace | JonclSolutions\",\"en\":\"Administration | JonclSolutions\"}', 10, '2026-09-30 13:22:55'),
(43, 'shop', 'not-found', '/shop/<unknown address>', '{\"cz\":\"Stránka nenalezena\",\"en\":\"Page not found\"}', 900, '2026-10-26 23:50:41');

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
(1, 'Joncletika, s.r.o.', '25133161', 'CZ25133161', 'G-TEST123456', 'Tvoříme digitální produkty, na které jste hrdí. - TEST', '{\"cz\":\"Tvo\\u0159\\u00edme digit\\u00e1ln\\u00ed produkty, na kter\\u00e9 jste hrd\\u00ed. - TEST\",\"en\":\"Creating digital products you can be proud of.\"}', '© 2026 RegioPartner, s.r.o. | Vytvořeno & Spravováno RPSW', '{\"cz\":\"\\u00a9 2026 RegioPartner, s.r.o. | Vytvo\\u0159eno & Spravov\\u00e1no RPSW\",\"en\":\"\\u00a9 2026 RegioPartner, s.r.o. | Created & Powered by RPSW\"}', 'jonasbucina@jonclsolutions.com', '733 188 328', 'Kytlická 862/6, 190 00 Praha', '©2026 RegioPartner, s.r.o., Všechna práva vyhrazena.', 'site-logos/aSECckNwRzMgCxVzSSAQgAl00JF86eVeFlHJN9kt.png', '2026-09-24 21:48:17');

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
(2, 'Instagram', 'https://www.instagram.com/rpsw.cz', 'social-icons/EqJdhL4hXthHqtVw4tlDlQgz6JDoJ3rQjDTVPesV.png', 1, '2026-06-13 09:24:35', '2026-06-13 11:44:13'),
(9, 'Tiktok', 'https://www.instagram.com/rpsw.cz', 'social-icons/nVy8QyyM7g5Dggded8oXurDeHfJFS9EkWvmEKCiG.png', 2, '2026-09-17 14:12:17', '2026-09-18 20:33:49');

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
(16, 34, 'b47ae1e61042a48609d36fa7cfc90c966c93cc8e2866ae7e111b9542c261589d', '2026-09-05 20:52:13', '2026-09-05 20:52:13', '2026-09-05 20:51:19'),
(20, 25, '895df7f775f7565465c8991dca2d56e381c22b0a792c47545b4ae7f344806da4', '2026-10-20 22:58:26', '2026-10-20 22:58:26', '2026-10-20 22:58:09');

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
(695, 'App\\Models\\User', 86, 'access-token', 'c01dd389ec650634ad228e9a6534e6391de2ed139c2a50bae4be0e9f48265c71', '[\"*\"]', '2026-08-11 12:34:19', '2026-08-11 13:34:19', '2026-08-11 12:34:19', '2026-08-11 12:34:19'),
(1271, 'App\\Models\\User', 111, 'access-token', '92a039b1f23dbbcfbf4b2e404a4648b615cf5999cc16b1513110b6f4194e8dd1', '[\"*\"]', '2026-10-09 15:28:48', '2026-10-09 16:28:46', '2026-10-09 15:28:46', '2026-10-09 15:28:48'),
(1289, 'App\\Models\\User', 100, 'access-token', 'c924b93d6aead078a754c7e967a24229ffb8de2ed508977c4824ab9e9ee34cbb', '[\"*\"]', '2026-10-09 22:40:22', '2026-10-09 23:33:32', '2026-10-09 22:33:32', '2026-10-09 22:40:22'),
(1331, 'App\\Models\\User', 34, 'access-token', '3d785cf4363ea590188efe042f59ec324791975aee1ed749671ad4a0810a50e9', '[\"*\"]', '2026-10-26 23:56:33', '2026-10-27 00:45:42', '2026-10-26 23:45:42', '2026-10-26 23:56:33'),
(1347, 'App\\Models\\User', 25, 'access-token', 'ca544762f3d6326aee9748cb212503cfa0aeb675c936ad84ca0ee85040ecd2af', '[\"*\"]', NULL, '2026-10-27 14:45:35', '2026-10-27 13:45:35', '2026-10-27 13:45:35');

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
(1330, 34, 'e959ae57bb2666cb1c527fafc0061a22bd4ad6d8f7f1ae680b9541933f7b64b1', '2026-11-02 23:45:42', '2026-10-26 23:45:42', '2026-10-26 23:45:42'),
(1346, 25, 'b247c014245b2d00c40cfc8e0ce6926bf0e9ea5c18550f3c699320edbe8ec65d', '2026-11-03 13:45:35', '2026-10-27 13:45:35', '2026-10-27 13:45:35');

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

-- --------------------------------------------------------

--
-- Table structure for table `shop_orders`
--

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
  `vat_rate` decimal(5,2) NOT NULL DEFAULT 21.00 COMMENT 'VAT rate in % at the time of the sale',
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
(1, 1, 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.', '2026-06-12 11:42:21', '2026-10-26 23:59:57');

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
(25, 'jonasbucina@jonclsolutions.com', 'Jonáš Bučina', 0, 1, 0, '2026-08-24 09:42:32', 0, NULL, '$2y$12$0sS2v./GHLkEksgo.z3L2uBtDvWnx50zAX7zppQMZb5d3KswLFkRW', NULL, '2026-10-27 09:35:43', '2026-02-14 08:12:31', '2026-10-27 09:35:43', NULL, 0),
(34, 'lindicka@jonclsolutions.com', 'Lindička Trýbíčková Mazliva', 0, 1, 0, '2026-08-24 09:30:24', 0, NULL, '$2y$12$Qfz5KjXi5qbFv/ZS5JmCzOzqbCR5/l0x4c3n3HRfO6ME6qzFDIOiK', NULL, '2026-10-27 00:04:39', '2026-02-14 08:12:31', '2026-10-27 00:04:39', NULL, 0),
(113, 'joner@jonclsolutions.com', 'TestASDASD', 0, 1, 0, NULL, 0, NULL, NULL, NULL, NULL, '2026-10-26 23:42:06', '2026-10-26 23:57:28', NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `user_permissions`
--

CREATE TABLE `user_permissions` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `permission_id` int(10) UNSIGNED NOT NULL,
  `granted_by` int(10) UNSIGNED DEFAULT NULL COMMENT 'user_id of the admin who granted this explicit permission - audit trail.',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(34, 20),
(113, 1);

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
  `state` varchar(50) NOT NULL DEFAULT 'new',
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
-- Table structure for table `web_projects`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_project_checkpoints`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_project_sessions`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_project_threads`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `web_project_thread_messages`
--

CREATE TABLE `web_project_thread_messages` (
  `id` int(10) UNSIGNED NOT NULL,
  `thread_id` int(10) UNSIGNED NOT NULL,
  `author_type` enum('customer','admin') NOT NULL,
  `author_label` varchar(255) DEFAULT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `status` varchar(255) NOT NULL DEFAULT 'new',
  `priority` varchar(255) NOT NULL DEFAULT 'neutral',
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
-- Indexes for table `core_external_links`
--
ALTER TABLE `core_external_links`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_external_links_user_id` (`user_id`);

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
-- Indexes for table `legal_page_titles`
--
ALTER TABLE `legal_page_titles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_legal_page_titles_area_key` (`area`,`page_key`);

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
-- Indexes for table `user_permissions`
--
ALTER TABLE `user_permissions`
  ADD PRIMARY KEY (`user_id`,`permission_id`),
  ADD KEY `fk_up_permission_id` (`permission_id`),
  ADD KEY `fk_up_granted_by` (`granted_by`);

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
-- Indexes for table `web_projects`
--
ALTER TABLE `web_projects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_web_projects_access_token` (`access_token`),
  ADD UNIQUE KEY `uq_web_projects_order_id` (`order_id`),
  ADD KEY `fk_web_projects_lead_id` (`lead_id`),
  ADD KEY `fk_web_projects_order_id` (`order_id`),
  ADD KEY `idx_web_projects_visibility` (`visibility`);

--
-- Indexes for table `web_project_checkpoints`
--
ALTER TABLE `web_project_checkpoints`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_project_checkpoints_project_id` (`project_id`),
  ADD KEY `idx_web_project_checkpoints_sort` (`project_id`,`sort_order`);

--
-- Indexes for table `web_project_sessions`
--
ALTER TABLE `web_project_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_web_project_sessions_token_hash` (`session_token_hash`),
  ADD KEY `fk_web_project_sessions_project_id` (`project_id`),
  ADD KEY `idx_web_project_sessions_expires_at` (`expires_at`);

--
-- Indexes for table `web_project_threads`
--
ALTER TABLE `web_project_threads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_project_threads_project_id` (`project_id`),
  ADD KEY `idx_web_project_threads_last_message_at` (`project_id`,`last_message_at`);

--
-- Indexes for table `web_project_thread_messages`
--
ALTER TABLE `web_project_thread_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_project_thread_messages_thread_id` (`thread_id`);

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `core_email_access_rules`
--
ALTER TABLE `core_email_access_rules`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `core_external_links`
--
ALTER TABLE `core_external_links`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `core_import_batches`
--
ALTER TABLE `core_import_batches`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `core_logs`
--
ALTER TABLE `core_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `core_permissions`
--
ALTER TABLE `core_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=126;

--
-- AUTO_INCREMENT for table `core_roles`
--
ALTER TABLE `core_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `core_security_events`
--
ALTER TABLE `core_security_events`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=361;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=63;

--
-- AUTO_INCREMENT for table `legal_page_titles`
--
ALTER TABLE `legal_page_titles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `legal_site_settings`
--
ALTER TABLE `legal_site_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `legal_social_links`
--
ALTER TABLE `legal_social_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1348;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1347;

--
-- AUTO_INCREMENT for table `shop_categories`
--
ALTER TABLE `shop_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=109;

--
-- AUTO_INCREMENT for table `shop_coupons`
--
ALTER TABLE `shop_coupons`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `shop_customers`
--
ALTER TABLE `shop_customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `shop_logs`
--
ALTER TABLE `shop_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shop_orders`
--
ALTER TABLE `shop_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `shop_order_items`
--
ALTER TABLE `shop_order_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `shop_product_categories`
--
ALTER TABLE `shop_product_categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT for table `shop_product_images`
--
ALTER TABLE `shop_product_images`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `shop_product_prices`
--
ALTER TABLE `shop_product_prices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `shop_product_variants`
--
ALTER TABLE `shop_product_variants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=97;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=114;

--
-- AUTO_INCREMENT for table `web_attachments`
--
ALTER TABLE `web_attachments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=49;

--
-- AUTO_INCREMENT for table `web_job_applications`
--
ALTER TABLE `web_job_applications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=96;

--
-- AUTO_INCREMENT for table `web_logs`
--
ALTER TABLE `web_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `web_news`
--
ALTER TABLE `web_news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `web_projects`
--
ALTER TABLE `web_projects`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `web_project_checkpoints`
--
ALTER TABLE `web_project_checkpoints`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `web_project_sessions`
--
ALTER TABLE `web_project_sessions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `web_project_threads`
--
ALTER TABLE `web_project_threads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `web_project_thread_messages`
--
ALTER TABLE `web_project_thread_messages`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT for table `web_raw_request_commissions`
--
ALTER TABLE `web_raw_request_commissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=276;

--
-- AUTO_INCREMENT for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=279;

--
-- AUTO_INCREMENT for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT for table `web_site_settings`
--
ALTER TABLE `web_site_settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=183;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `account_activation_tokens`
--
ALTER TABLE `account_activation_tokens`
  ADD CONSTRAINT `account_activation_tokens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `core_external_links`
--
ALTER TABLE `core_external_links`
  ADD CONSTRAINT `fk_web_external_links_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

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
  ADD CONSTRAINT `fk_shop_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `shop_customers` (`id`),
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
-- Constraints for table `user_permissions`
--
ALTER TABLE `user_permissions`
  ADD CONSTRAINT `fk_up_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_up_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `core_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_up_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_ur_role_id` FOREIGN KEY (`role_id`) REFERENCES `core_roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `web_logs`
--
ALTER TABLE `web_logs`
  ADD CONSTRAINT `fk_web_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `web_projects`
--
ALTER TABLE `web_projects`
  ADD CONSTRAINT `fk_web_projects_lead_id` FOREIGN KEY (`lead_id`) REFERENCES `web_sales_leads` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_web_projects_order_id` FOREIGN KEY (`order_id`) REFERENCES `web_sales_orders` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `web_project_checkpoints`
--
ALTER TABLE `web_project_checkpoints`
  ADD CONSTRAINT `fk_web_project_checkpoints_project_id` FOREIGN KEY (`project_id`) REFERENCES `web_projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `web_project_sessions`
--
ALTER TABLE `web_project_sessions`
  ADD CONSTRAINT `fk_web_project_sessions_project_id` FOREIGN KEY (`project_id`) REFERENCES `web_projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `web_project_threads`
--
ALTER TABLE `web_project_threads`
  ADD CONSTRAINT `fk_web_project_threads_project_id` FOREIGN KEY (`project_id`) REFERENCES `web_projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `web_project_thread_messages`
--
ALTER TABLE `web_project_thread_messages`
  ADD CONSTRAINT `fk_web_project_thread_messages_thread_id` FOREIGN KEY (`thread_id`) REFERENCES `web_project_threads` (`id`) ON DELETE CASCADE;

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
