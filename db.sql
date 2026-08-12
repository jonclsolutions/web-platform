-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Aug 12, 2026 at 01:38 PM
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
('laravel-cache-1352246e33277e9d3c9090a434fa72cfa6536ae2', 'i:11;', 1785059249),
('laravel-cache-1352246e33277e9d3c9090a434fa72cfa6536ae2:timer', 'i:1785059249;', 1785059249),
('laravel-cache-3c26dffc8a2e8804dfe2c8a1195cfaa5ef6d0014', 'i:1;', 1786451719),
('laravel-cache-3c26dffc8a2e8804dfe2c8a1195cfaa5ef6d0014:timer', 'i:1786451719;', 1786451719),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba', 'i:1;', 1786489962),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1786489962;', 1786489962),
('laravel-cache-f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59', 'i:4;', 1786402588),
('laravel-cache-f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59:timer', 'i:1786402588;', 1786402588),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400', 'i:14;', 1786534634),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400:timer', 'i:1786534634;', 1786534634),
('laravel-cache-password-change-notify:25', 'i:2;', 1786408499),
('laravel-cache-password-change-notify:25:timer', 'i:1786408499;', 1786408499),
('laravel-cache-password-change-notify:86', 'i:1;', 1786453081),
('laravel-cache-password-change-notify:86:timer', 'i:1786453081;', 1786453081),
('laravel-cache-site_setting_active_web', 'O:31:\"App\\Models\\Core\\CoreSiteSetting\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:18:\"core_site_settings\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:7:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:0;s:13:\"is_web_active\";i:0;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"updated_at\";s:19:\"2026-08-12 01:11:57\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";}s:11:\"\0*\0original\";a:7:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:0;s:13:\"is_web_active\";i:0;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"updated_at\";s:19:\"2026-08-12 01:11:57\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:1:{s:14:\"is_shop_active\";s:7:\"boolean\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:2:{i:0;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1786490616);

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
(1, '2026-07-26 11:06:27', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 25)', 'Auth', NULL, NULL, '{\"email_requested\":\"jonasbucina@rpsw.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":25}', NULL, 'system'),
(2, '2026-07-26 11:14:01', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 25)', 'Auth', NULL, NULL, '{\"email_requested\":\"jonasbucina@rpsw.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"curl\\/8.11.1\",\"user_id\":25}', NULL, 'system'),
(3, '2026-07-26 11:25:57', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 25)', 'Auth', NULL, NULL, '{\"email_requested\":\"jonasbucina@rpsw.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":25}', NULL, 'system'),
(4, '2026-07-26 11:36:32', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 25)', 'Auth', NULL, NULL, '{\"email_requested\":\"jonasbucina@rpsw.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":25}', NULL, 'system'),
(5, '2026-07-26 11:45:25', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 85)', 'Auth', NULL, NULL, '{\"email_requested\":\"testing@test.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":85}', NULL, 'system'),
(6, '2026-07-26 11:45:53', '127.0.0.1', 'password_reset_completed', 'auth', 'Pokus o reset hesla (user_id: 85)', 'Auth', NULL, NULL, '{\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":85}', NULL, 'system'),
(7, '2026-07-26 21:26:52', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 34)', 'Auth', NULL, NULL, '{\"email_requested\":\"lindicka@mazliva.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":34}', NULL, 'system'),
(8, '2026-07-26 21:26:55', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 34)', 'Auth', NULL, NULL, '{\"email_requested\":\"lindicka@mazliva.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":34}', NULL, 'system'),
(9, '2026-07-26 21:27:03', '127.0.0.1', 'password_reset_requested', 'auth', 'Pokus o reset hesla (user_id: 34)', 'Auth', NULL, NULL, '{\"email_requested\":\"lindicka@mazliva.cz\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":34}', NULL, 'system'),
(10, '2026-07-26 21:27:46', '127.0.0.1', 'password_reset_failed', 'auth', 'Pokus o reset hesla (user_id: neznámý)', 'Auth', NULL, NULL, '{\"reason\":\"invalid_token\",\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":null}', NULL, 'system'),
(11, '2026-07-26 21:28:05', '127.0.0.1', 'password_reset_completed', 'auth', 'Pokus o reset hesla (user_id: 34)', 'Auth', NULL, NULL, '{\"ip\":\"127.0.0.1\",\"user_agent\":\"Mozilla\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\/20100101 Firefox\\/145.0\",\"user_id\":34}', NULL, 'system'),
(16, '2026-08-10 19:28:15', '127.0.0.1', 'update', 'Legal', 'Updated section: 1. Úvodní ustanovení - test (cz)', 'DocumentSection', 24, 25, '{\"id\":24,\"document_type_id\":1,\"position\":1,\"heading\":\"1. Úvodní ustanovení - test\",\"content\":\"Tyto Zásady zpracování osobních údajů (dále jen „Zásady“) popisují, jak společnost RegioPartner, s.r.o., se sídlem Kytlická 862\\/6, 190 00 Praha, IČO: 25133161, DIČ: CZ25133161, zapsaná v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 52029 (dále jen „my“ nebo „Správce“), shromažďuje, používá a chrání osobní údaje, které nám poskytujete v souvislosti s používáním našich webových stránek a našich služeb, zejména inzerce digitálních produktů a služeb. Zavazujeme se chránit vaše soukromí a zpracováváme osobní údaje v souladu s Nařízením Evropského parlamentu a Rady (EU) 2016\\/679 (dále jen „GDPR“) a platnými právními předpisy České republiky, zejména zákonem č. 110\\/2019 Sb., o zpracování osobních údajů, ve znění pozdějších předpisů. Pokud s těmito Zásadami nesouhlasíte, prosíme, nepoužívejte naše webové stránky ani služby.\",\"lang\":\"cz\"}', '25', 'jonasbucina@rpsw.cz'),
(17, '2026-08-10 19:34:30', '127.0.0.1', 'update', 'Legal', 'Updated section: 1. Úvodní ustanovení (cz)', 'DocumentSection', 24, 25, '{\"id\":24,\"document_type_id\":1,\"position\":1,\"heading\":\"1. \\u00davodn\\u00ed ustanoven\\u00ed\",\"content\":\"Tyto Z\\u00e1sady zpracov\\u00e1n\\u00ed osobn\\u00edch \\u00fadaj\\u016f (d\\u00e1le jen \\u201eZ\\u00e1sady\\u201c) popisuj\\u00ed, jak spole\\u010dnost RegioPartner, s.r.o., se s\\u00eddlem Kytlick\\u00e1 862\\/6, 190 00 Praha, I\\u010cO: 25133161, DI\\u010c: CZ25133161, zapsan\\u00e1 v obchodn\\u00edm rejst\\u0159\\u00edku veden\\u00e9m M\\u011bstsk\\u00fdm soudem v Praze, odd\\u00edl C, vlo\\u017eka 52029 (d\\u00e1le jen \\u201emy\\u201c nebo \\u201eSpr\\u00e1vce\\u201c), shroma\\u017e\\u010fuje, pou\\u017e\\u00edv\\u00e1 a chr\\u00e1n\\u00ed osobn\\u00ed \\u00fadaje, kter\\u00e9 n\\u00e1m poskytujete v souvislosti s pou\\u017e\\u00edv\\u00e1n\\u00edm na\\u0161ich webov\\u00fdch str\\u00e1nek a na\\u0161ich slu\\u017eeb, zejm\\u00e9na inzerce digit\\u00e1ln\\u00edch produkt\\u016f a slu\\u017eeb. Zavazujeme se chr\\u00e1nit va\\u0161e soukrom\\u00ed a zpracov\\u00e1v\\u00e1me osobn\\u00ed \\u00fadaje v souladu s Na\\u0159\\u00edzen\\u00edm Evropsk\\u00e9ho parlamentu a Rady (EU) 2016\\/679 (d\\u00e1le jen \\u201eGDPR\\u201c) a platn\\u00fdmi pr\\u00e1vn\\u00edmi p\\u0159edpisy \\u010cesk\\u00e9 republiky, zejm\\u00e9na z\\u00e1konem \\u010d. 110\\/2019 Sb., o zpracov\\u00e1n\\u00ed osobn\\u00edch \\u00fadaj\\u016f, ve zn\\u011bn\\u00ed pozd\\u011bj\\u0161\\u00edch p\\u0159edpis\\u016f. Pokud s t\\u011bmito Z\\u00e1sadami nesouhlas\\u00edte, pros\\u00edme, nepou\\u017e\\u00edvejte na\\u0161e webov\\u00e9 str\\u00e1nky ani slu\\u017eby.\",\"lang\":\"cz\"}', '25', 'jonasbucina@rpsw.cz'),
(18, '2026-08-10 20:19:58', '127.0.0.1', 'update', 'Legal', 'Updated company details: brand_tagline, brand_tagline_i18n', 'SiteConfiguration', 1, 25, '{\"company_name\":\"Joncletika, s.r.o.\",\"brand_tagline_i18n\":{\"cz\":\"Tvo\\u0159\\u00edme digit\\u00e1ln\\u00ed produkty, na kter\\u00e9 jste hrd\\u00ed. - TEST\",\"en\":\"Creating digital products you can be proud of.\"},\"copyright_text_i18n\":{\"cz\":\"\\u00a9 2026 RegioPartner, s.r.o. | Vytvo\\u0159eno & Spravov\\u00e1no RPSW\",\"en\":\"\\u00a9 2026 RegioPartner, s.r.o. | Created & Powered by RPSW\"},\"ico\":\"25133161\",\"dic\":\"CZ25133161\",\"google_analytics_id\":\"G-TEST123456\",\"contact_email\":\"gamber@rpsw.cz\",\"contact_phone\":\"733 188 328\",\"address\":\"Kytlick\\u00e1 862\\/6, 190 00 Praha\",\"footer_text\":\"\\u00a92026 RegioPartner, s.r.o., V\\u0161echna pr\\u00e1va vyhrazena.\"}', '25', 'jonasbucina@rpsw.cz'),
(19, '2026-08-10 20:20:01', '127.0.0.1', 'delete', 'Legal', 'Deleted social network: test', 'SocialLink', 7, 25, '[]', '25', 'jonasbucina@rpsw.cz');

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
(1, 'web-manage-administrators', 'Správa administrátorských účtů', 'web', '2026-02-14 08:12:31'),
(2, 'web-view-web-logs', 'Prohlížení web logů', 'web', '2026-02-14 08:12:31'),
(3, 'web-view-personal-info', 'Zobrazení osobních údajů', 'web', '2026-02-14 08:12:31'),
(4, 'web-view-user-requests', 'Zobrazení uživatelských požadavků', 'web', '2026-02-14 08:12:31'),
(5, 'web-view-dashboard', 'Přístup k nástěnce', 'web', '2026-02-14 08:12:31'),
(6, 'web-view-edit-website', 'Možnost editovat web', 'web', '2026-02-14 08:12:31'),
(7, 'view-deleted', 'Zobrazit softdeleted záznamy', 'web', '2026-02-14 08:12:31'),
(8, 'web-view-sales-leads', 'Zobrazit Sales Leads', 'web', '2026-02-14 08:12:31'),
(9, 'web-view-news', 'Může vidět a editovat News', 'web', '2026-02-14 08:12:31'),
(10, 'web-view-sales-orders', 'Vidí poptávkové listy od klientů', 'web', '2026-02-14 08:12:31'),
(11, 'web-view-support-tickets', 'Může zobrazit tikety zaslané na podporu', 'web', '2026-02-14 08:12:31'),
(12, 'web-view-job-applications', 'Může zobrazit seznam uchazečů', 'web', '2026-02-14 08:12:31'),
(13, 'shop-manage-products', 'Správa produktů v e-shopu', 'shop', '2026-03-22 08:12:31'),
(14, 'shop-manage-categories', 'Správa kategorií produktů', 'shop', '2026-03-22 08:12:31'),
(15, 'shop-view-orders', 'Prohlížení objednávek e-shopu', 'shop', '2026-03-22 08:12:31'),
(16, 'shop-manage-customers', 'Správa zákazníků e-shopu', 'shop', '2026-03-22 08:12:31'),
(17, 'shop-view-reports', 'Prohlížení reportů e-shopu', 'shop', '2026-03-22 08:12:31'),
(18, 'view-web', 'Zobrazit Web sekci Administrace.', 'core', '2026-03-25 11:37:06'),
(19, 'view-eshop', 'Zobrazit Eshop sekci Administrace.', 'core', '2026-03-25 11:37:06'),
(20, 'shop-view-dashboard', 'Zobrazit dashboard Eshop sekce administrace.', 'core', '2026-03-25 11:42:21'),
(21, 'shop-view-logs', 'Může zobrazit logy eshopu.', 'core', '2026-03-26 22:39:15'),
(22, 'shop-manage-shipping-methods', 'Zobrazit metody dopravy.', 'core', '2026-03-27 14:41:13'),
(23, 'shop-manage-suppliers', 'Zobrazit dodavatele.', 'core', '2026-03-27 14:41:13'),
(24, 'shop-manage-payment-methods', 'Zobrazit způsoby plateb.', 'core', '2026-03-27 14:49:37'),
(26, 'shop-set-maitanance-mode', 'Může přepnout eshop do stavu údržby.', 'shop', '2026-06-12 13:09:55'),
(27, 'web-edit-legal', 'Editovat GDPR a TOS.', 'core', '2026-06-12 19:24:15'),
(28, 'web-view-web-settings', 'Může editovat nastavení webu.', 'core', '2026-06-13 08:40:51'),
(29, 'shop-view-edit-eshop', 'Možnost Editovat shop texty.', 'core', '2026-06-30 10:01:32'),
(30, 'core-view-welcome-page', 'Zobrazit uvítací stránku po přihlášení.', 'web', '2026-07-26 20:08:46'),
(31, 'web-manage-external-links', 'Spravovat externí linky cookies associated etc.', 'core', '2026-08-01 11:01:56'),
(32, 'view-core', 'Zobrazit Core / System založku v administraci.', 'core', '2026-08-07 07:23:39'),
(33, 'web-set-maintenance-mode', 'Může přepnout web do stavu údržby.', 'web', '2026-08-11 22:30:26');

-- --------------------------------------------------------

--
-- Table structure for table `core_roles`
--

CREATE TABLE `core_roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `core_roles`
--

INSERT INTO `core_roles` (`id`, `role_name`, `description`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'sysadmin', 'Systémový administrátor - má vše', '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(2, 'admin', 'Administrátor - správa webu', '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(12, 'test', 'test', '2026-08-10 22:56:00', '2026-08-10 22:56:00', NULL);

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
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
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
(1, 27),
(1, 28),
(1, 29),
(1, 30),
(1, 31),
(1, 32),
(1, 33),
(2, 3),
(2, 4),
(2, 5),
(2, 7),
(2, 8),
(2, 9),
(2, 10),
(2, 11),
(2, 12),
(2, 13),
(2, 14),
(2, 15),
(2, 16),
(2, 18),
(2, 19),
(2, 20),
(2, 21),
(2, 30),
(12, 1),
(12, 2),
(12, 3),
(12, 4),
(12, 5),
(12, 6),
(12, 7),
(12, 8),
(12, 9),
(12, 10),
(12, 11),
(12, 12),
(12, 30);

-- --------------------------------------------------------

--
-- Table structure for table `core_site_settings`
--

CREATE TABLE `core_site_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `is_shop_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_web_active` tinyint(1) NOT NULL DEFAULT 1,
  `maintenance_message` varchar(255) DEFAULT NULL,
  `web_maintenance_message` varchar(500) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `core_site_settings`
--

INSERT INTO `core_site_settings` (`id`, `is_shop_active`, `is_web_active`, `maintenance_message`, `web_maintenance_message`, `updated_at`, `created_at`) VALUES
(1, 0, 0, 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.', 'Omlouváme se, web je momentálně v údržbě.', '2026-08-11 23:11:57', '2026-06-12 11:42:21');

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
(1, 'e95c8af1-1fdc-44f0-a995-0f07f46b8b37', 'database', 'default', '{\"uuid\":\"e95c8af1-1fdc-44f0-a995-0f07f46b8b37\",\"displayName\":\"App\\\\Mail\\\\Web\\\\WebSalesOrderReceived\",\"job\":\"Illuminate\\\\Queue\\\\CallQueuedHandler@call\",\"maxTries\":null,\"maxExceptions\":null,\"failOnTimeout\":false,\"backoff\":null,\"timeout\":null,\"retryUntil\":null,\"data\":{\"commandName\":\"Illuminate\\\\Mail\\\\SendQueuedMailable\",\"command\":\"O:34:\\\"Illuminate\\\\Mail\\\\SendQueuedMailable\\\":15:{s:8:\\\"mailable\\\";O:34:\\\"App\\\\Mail\\\\Web\\\\WebSalesOrderReceived\\\":3:{s:5:\\\"order\\\";O:45:\\\"Illuminate\\\\Contracts\\\\Database\\\\ModelIdentifier\\\":5:{s:5:\\\"class\\\";s:28:\\\"App\\\\Models\\\\Web\\\\WebSalesOrder\\\";s:2:\\\"id\\\";i:6;s:9:\\\"relations\\\";a:0:{}s:10:\\\"connection\\\";s:5:\\\"mysql\\\";s:15:\\\"collectionClass\\\";N;}s:2:\\\"to\\\";a:1:{i:0;a:2:{s:4:\\\"name\\\";N;s:7:\\\"address\\\";s:15:\\\"sdfsssdf@sdf.cz\\\";}}s:6:\\\"mailer\\\";s:4:\\\"smtp\\\";}s:5:\\\"tries\\\";N;s:7:\\\"timeout\\\";N;s:13:\\\"maxExceptions\\\";N;s:17:\\\"shouldBeEncrypted\\\";b:0;s:10:\\\"connection\\\";N;s:5:\\\"queue\\\";N;s:5:\\\"delay\\\";N;s:11:\\\"afterCommit\\\";N;s:10:\\\"middleware\\\";a:0:{}s:7:\\\"chained\\\";a:0:{}s:15:\\\"chainConnection\\\";N;s:10:\\\"chainQueue\\\";N;s:19:\\\"chainCatchCallbacks\\\";N;s:3:\\\"job\\\";N;}\"},\"createdAt\":1786310243,\"delay\":null}', 'Symfony\\Component\\Mailer\\Exception\\TransportException: Connection could not be established with host \"127.0.0.1:1025\": stream_socket_client(): Unable to connect to 127.0.0.1:1025 (Connection refused) in /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/mailer/Transport/Smtp/Stream/SocketStream.php:154\nStack trace:\n#0 [internal function]: Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream->{closure:Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream::initialize():153}()\n#1 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/mailer/Transport/Smtp/Stream/SocketStream.php(157): stream_socket_client()\n#2 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(279): Symfony\\Component\\Mailer\\Transport\\Smtp\\Stream\\SocketStream->initialize()\n#3 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(211): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->start()\n#4 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/mailer/Transport/AbstractTransport.php(69): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->doSend()\n#5 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/mailer/Transport/Smtp/SmtpTransport.php(138): Symfony\\Component\\Mailer\\Transport\\AbstractTransport->send()\n#6 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Mail/Mailer.php(584): Symfony\\Component\\Mailer\\Transport\\Smtp\\SmtpTransport->send()\n#7 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Mail/Mailer.php(331): Illuminate\\Mail\\Mailer->sendSymfonyMessage()\n#8 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Mail/Mailable.php(207): Illuminate\\Mail\\Mailer->send()\n#9 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Support/Traits/Localizable.php(19): Illuminate\\Mail\\Mailable->{closure:Illuminate\\Mail\\Mailable::send():200}()\n#10 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Mail/Mailable.php(200): Illuminate\\Mail\\Mailable->withLocale()\n#11 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Mail/SendQueuedMailable.php(82): Illuminate\\Mail\\Mailable->send()\n#12 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Mail\\SendQueuedMailable->handle()\n#13 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#14 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure()\n#15 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod()\n#16 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Container.php(754): Illuminate\\Container\\BoundMethod::call()\n#17 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Bus/Dispatcher.php(132): Illuminate\\Container\\Container->call()\n#18 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(169): Illuminate\\Bus\\Dispatcher->{closure:Illuminate\\Bus\\Dispatcher::dispatchNow():129}()\n#19 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(126): Illuminate\\Pipeline\\Pipeline->{closure:Illuminate\\Pipeline\\Pipeline::prepareDestination():167}()\n#20 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Bus/Dispatcher.php(136): Illuminate\\Pipeline\\Pipeline->then()\n#21 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(125): Illuminate\\Bus\\Dispatcher->dispatchNow()\n#22 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(169): Illuminate\\Queue\\CallQueuedHandler->{closure:Illuminate\\Queue\\CallQueuedHandler::dispatchThroughMiddleware():120}()\n#23 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(126): Illuminate\\Pipeline\\Pipeline->{closure:Illuminate\\Pipeline\\Pipeline::prepareDestination():167}()\n#24 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(120): Illuminate\\Pipeline\\Pipeline->then()\n#25 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(68): Illuminate\\Queue\\CallQueuedHandler->dispatchThroughMiddleware()\n#26 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Jobs/Job.php(102): Illuminate\\Queue\\CallQueuedHandler->call()\n#27 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(444): Illuminate\\Queue\\Jobs\\Job->fire()\n#28 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(394): Illuminate\\Queue\\Worker->process()\n#29 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Worker.php(180): Illuminate\\Queue\\Worker->runJob()\n#30 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(148): Illuminate\\Queue\\Worker->daemon()\n#31 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php(131): Illuminate\\Queue\\Console\\WorkCommand->runWorker()\n#32 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(36): Illuminate\\Queue\\Console\\WorkCommand->handle()\n#33 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Util.php(43): Illuminate\\Container\\BoundMethod::{closure:Illuminate\\Container\\BoundMethod::call():35}()\n#34 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(96): Illuminate\\Container\\Util::unwrapIfClosure()\n#35 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/BoundMethod.php(35): Illuminate\\Container\\BoundMethod::callBoundMethod()\n#36 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Container/Container.php(754): Illuminate\\Container\\BoundMethod::call()\n#37 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Console/Command.php(211): Illuminate\\Container\\Container->call()\n#38 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Command/Command.php(318): Illuminate\\Console\\Command->execute()\n#39 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Console/Command.php(180): Symfony\\Component\\Console\\Command\\Command->run()\n#40 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(1092): Illuminate\\Console\\Command->run()\n#41 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(341): Symfony\\Component\\Console\\Application->doRunCommand()\n#42 /home/joncl/prg/Typescript/rp_website/api/vendor/symfony/console/Application.php(192): Symfony\\Component\\Console\\Application->doRun()\n#43 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Foundation/Console/Kernel.php(197): Symfony\\Component\\Console\\Application->run()\n#44 /home/joncl/prg/Typescript/rp_website/api/vendor/laravel/framework/src/Illuminate/Foundation/Application.php(1234): Illuminate\\Foundation\\Console\\Kernel->handle()\n#45 /home/joncl/prg/Typescript/rp_website/api/artisan(16): Illuminate\\Foundation\\Application->handleCommand()\n#46 {main}', '2026-08-09 21:17:23');

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
(4, 25, 'b09b5f673bb4c9dc44a99ebd2a987b44b9e1b59cdbe7772a2551599a816231fe', '2026-07-26 09:51:32', NULL, '2026-07-26 09:36:32'),
(8, 34, '3332713ea59d425c9776eb4830344e203c5801f67323798ab47a53d95323b869', '2026-07-26 19:28:05', '2026-07-26 19:28:05', '2026-07-26 19:27:03');

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
(701, 'App\\Models\\User', 25, 'access-token', 'd926bd32532fc9998eee89dc97d22f34a6684d9905871c5d1d1b07c9cb80b5ed', '[\"*\"]', '2026-08-12 11:36:45', '2026-08-12 12:35:04', '2026-08-12 11:35:04', '2026-08-12 11:36:45');

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
(700, 25, '3a73385e85d9d110a4c8e435187ed0825d71e95ae349be94741af5da610d4316', '2026-08-19 11:35:04', '2026-08-12 11:35:04', '2026-08-12 11:35:04');

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
(1, '2026-08-06 15:56:12', '127.0.0.1', 'create', 'Legal', 'Added social network: test', 'SiteConfiguration', 7, 25, '\"{\\\"name\\\":\\\"test\\\",\\\"url\\\":\\\"https:\\\\\\/\\\\\\/www.instagram.com\\\\\\/rpsw.cz\\\",\\\"position\\\":\\\"2\\\"}\"', '25', 'Jonáš Bučina');

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
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `dpp_hours_spent` int(5) NOT NULL DEFAULT 0,
  `enable_2fa` tinyint(1) NOT NULL DEFAULT 0,
  `internal_note` text DEFAULT NULL,
  `user_password_hash` varchar(255) NOT NULL,
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

INSERT INTO `users` (`id`, `user_email`, `full_name`, `dpp_hours_spent`, `enable_2fa`, `internal_note`, `user_password_hash`, `user_password_salt`, `last_login_at`, `created_at`, `updated_at`, `deleted_at`, `is_deleted`) VALUES
(25, 'jonasbucina@rpsw.cz', 'Jonáš Bučina', 0, 1, NULL, '$2y$12$PSt4jxIj8qs47185wr149uoVtxUmdWI0srk4Mq.WHSeHlmNoFPvNS', NULL, '2026-08-12 01:11:43', '2026-02-14 08:12:31', '2026-08-12 01:11:43', NULL, 0),
(34, 'lindicka@mazliva.cz', 'Lindička Trýbíčková Mazliva', 0, 1, NULL, '$2y$12$Xni0XZTdDsb22F686yDryefjAJKvlDDnh9G646kl90dDjwGLvSqtS', NULL, '2026-08-11 00:55:27', '2026-02-14 08:12:31', '2026-08-11 00:55:27', NULL, 0);

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

--
-- Dumping data for table `web_external_links`
--

INSERT INTO `web_external_links` (`id`, `user_id`, `name`, `url`, `position`, `is_active`, `created_at`, `updated_at`, `deleted_at`) VALUES
(2, 25, 'test', 'https://www.google.com/?hl=cs', 1, 1, '2026-08-10 18:36:56', '2026-08-12 11:36:14', '2026-08-12 11:36:14');

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
  `state` varchar(50) DEFAULT 'Nový',
  `internal_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `web_job_applications`
--

INSERT INTO `web_job_applications` (`id`, `first_name`, `last_name`, `email`, `phone`, `position_name`, `message`, `cv_path`, `state`, `internal_note`, `created_at`, `updated_at`, `deleted_at`) VALUES
(4, 'test', 'test', 'asda@sd.cz', NULL, 'UI/UX Designer', 'msfsmd.,fsmd.,fms.fmsd', 'cv_files/VtyC0R40UdnY2M6Df88vxwqPLUBsqAPrsoEvBoxg.txt', 'Zamítnut', NULL, '2026-08-06 22:42:28', '2026-08-09 22:16:40', '2026-08-09 22:16:40'),
(5, '786', '87678', 'sdf@sdf.cj', 'ůlůsakfůlsdk', 'UI/UX Designer', NULL, 'cv_files/BtHqYbUKaMpybvwTuCHAcXCoNcOk8kYOK5Hup5tw.txt', 'Nový', NULL, '2026-08-06 23:02:16', '2026-08-09 22:16:37', '2026-08-09 22:16:37'),
(6, 'joans', 'foner', 'foner@asdas.dcz', '876687678', 'UI/UX Designer', 'jhsfdjk', 'cv_files/JRImHhgQQtnA5fSTBiFjQt4CbJ39B4SwiiWRdu25.txt', 'Nový', NULL, '2026-08-06 23:09:39', '2026-08-09 22:16:35', '2026-08-09 22:16:35');

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
(1, '2026-08-06 15:55:36', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(2, '2026-08-06 15:57:02', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(3, '2026-08-06 18:02:52', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(4, '2026-08-06 23:50:17', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: asdasda', 'User', NULL, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '0', 'asdasda'),
(5, '2026-08-07 00:42:28', '127.0.0.1', 'create', 'WebJobApplication', 'Nová reakce na pozici: UI/UX Designer (test test)', 'WebJobApplication', 4, NULL, '\"{\\\"first_name\\\":\\\"test\\\",\\\"last_name\\\":\\\"test\\\",\\\"email\\\":\\\"asda@sd.cz\\\",\\\"phone\\\":null,\\\"message\\\":\\\"msfsmd.,fsmd.,fms.fmsd\\\",\\\"dataProcessingAgreement\\\":\\\"1\\\",\\\"position_name\\\":\\\"UI\\\\\\/UX Designer\\\"}\"', '0', 'Veřejný web (Uchazeč)'),
(6, '2026-08-07 00:43:04', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(7, '2026-08-07 00:43:23', '127.0.0.1', 'update', 'WebJobApplication', 'Aktualizace uchazeče ID: 4. Stav: Zamítnut', 'WebJobApplication', 4, 25, '\"{\\\"id\\\":4,\\\"first_name\\\":\\\"test\\\",\\\"last_name\\\":\\\"test\\\",\\\"full_name\\\":\\\"test test\\\",\\\"email\\\":\\\"asda@sd.cz\\\",\\\"phone\\\":null,\\\"position_name\\\":\\\"UI\\\\\\/UX Designer\\\",\\\"message\\\":\\\"msfsmd.,fsmd.,fms.fmsd\\\",\\\"cv_path\\\":\\\"cv_files\\\\\\/VtyC0R40UdnY2M6Df88vxwqPLUBsqAPrsoEvBoxg.txt\\\",\\\"cv_url\\\":\\\"http:\\\\\\/\\\\\\/127.0.0.1:8000\\\\\\/storage\\\\\\/cv_files\\\\\\/VtyC0R40UdnY2M6Df88vxwqPLUBsqAPrsoEvBoxg.txt\\\",\\\"state\\\":\\\"Zam\\u00edtnut\\\",\\\"internal_note\\\":null,\\\"created_at\\\":\\\"2026-08-07 00:42:28\\\",\\\"updated_at\\\":\\\"2026-08-07 00:42:28\\\",\\\"deleted_at\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(8, '2026-08-07 00:43:29', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(9, '2026-08-07 01:02:16', '127.0.0.1', 'create', 'WebJobApplication', 'Nová reakce na pozici: UI/UX Designer (786 87678)', 'WebJobApplication', 5, NULL, '\"{\\\"first_name\\\":\\\"786\\\",\\\"last_name\\\":\\\"87678\\\",\\\"email\\\":\\\"sdf@sdf.cj\\\",\\\"phone\\\":\\\"\\u016fl\\u016fsakf\\u016flsdk\\\",\\\"message\\\":null,\\\"dataProcessingAgreement\\\":\\\"1\\\",\\\"position_name\\\":\\\"UI\\\\\\/UX Designer\\\"}\"', '0', 'Veřejný web (Uchazeč)'),
(10, '2026-08-07 01:09:39', '127.0.0.1', 'create', 'WebJobApplication', 'Nová reakce na pozici: UI/UX Designer (joans foner)', 'WebJobApplication', 6, NULL, '\"{\\\"first_name\\\":\\\"joans\\\",\\\"last_name\\\":\\\"foner\\\",\\\"email\\\":\\\"foner@asdas.dcz\\\",\\\"phone\\\":\\\"876687678\\\",\\\"message\\\":\\\"jhsfdjk\\\",\\\"dataProcessingAgreement\\\":\\\"1\\\",\\\"position_name\\\":\\\"UI\\\\\\/UX Designer\\\"}\"', '0', 'Veřejný web (Uchazeč)'),
(11, '2026-08-07 08:43:00', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(12, '2026-08-07 09:20:55', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(13, '2026-08-07 09:31:16', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(14, '2026-08-07 09:32:23', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(15, '2026-08-07 09:32:31', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(16, '2026-08-07 09:35:49', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(17, '2026-08-07 09:35:52', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(18, '2026-08-09 21:32:59', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(19, '2026-08-09 21:33:02', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(20, '2026-08-09 21:35:45', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(21, '2026-08-09 21:35:49', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(22, '2026-08-09 21:37:44', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(23, '2026-08-09 21:37:47', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(24, '2026-08-09 22:29:31', '127.0.0.1', 'create', 'WebSalesLead', 'Vytvořen nový lead: Test', 'WebSalesLead', 7, 25, '\"{\\\"subject_name\\\":\\\"Test\\\",\\\"user_id\\\":null,\\\"salesman_name\\\":null,\\\"contact_other\\\":null,\\\"source_url\\\":null,\\\"first_contact_date\\\":null,\\\"contact_person\\\":null,\\\"contact_email\\\":null,\\\"contact_phone\\\":null,\\\"location\\\":null,\\\"source_channel\\\":\\\"LinkedIn - Direct Message\\\",\\\"status\\\":\\\"Nov\\u00e9\\\",\\\"priority\\\":\\\"N\\u00edzk\\u00e1\\\",\\\"last_contact_date\\\":null,\\\"next_step\\\":null,\\\"description\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(25, '2026-08-09 22:31:44', '127.0.0.1', 'generate_link', 'WebSalesLead', 'Vygenerován odkaz na objednávkový formulář pro lead ID: 7', 'WebSalesLead', 7, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(26, '2026-08-09 22:33:41', '127.0.0.1', 'generate_link', 'WebSalesLead', 'Vygenerován odkaz na objednávkový formulář pro lead ID: 7', 'WebSalesLead', 7, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(27, '2026-08-09 22:34:30', '127.0.0.1', 'create', 'WebSalesOrder', 'Vytvořena realizace pro: Test', 'WebSalesOrder', 3, NULL, '\"{\\\"client_name\\\":\\\"Test\\\",\\\"ico\\\":\\\"76876\\\",\\\"client_address\\\":null,\\\"client_phone\\\":null,\\\"client_email\\\":\\\"asd@sf.cz\\\",\\\"order_description\\\":\\\"d\\u016fsdfsdfdsf\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"BeMKIXWYrPOCLDiIK98Ygddz5hMbnRwHc9gLU0cW\\\"}\"', '0', 'system/public'),
(28, '2026-08-09 22:34:30', '127.0.0.1', 'error', 'WebSalesOrder', 'Nepodařilo se odeslat potvrzovací e-mail: Connection could not be established with host \"127.0.0.1:1025\": stream_socket_client(): Unable to connect to 127.0.0.1:1025 (Connection refused)', 'WebSalesOrder', 3, NULL, '\"{\\\"client_name\\\":\\\"Test\\\",\\\"ico\\\":\\\"76876\\\",\\\"client_address\\\":null,\\\"client_phone\\\":null,\\\"client_email\\\":\\\"asd@sf.cz\\\",\\\"order_description\\\":\\\"d\\u016fsdfsdfdsf\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"BeMKIXWYrPOCLDiIK98Ygddz5hMbnRwHc9gLU0cW\\\"}\"', '0', 'system/public'),
(29, '2026-08-09 22:35:01', '127.0.0.1', 'create', 'WebSalesOrder', 'Vytvořena realizace pro: Test', 'WebSalesOrder', 4, NULL, '\"{\\\"client_name\\\":\\\"Test\\\",\\\"ico\\\":\\\"768789\\\",\\\"client_address\\\":\\\"jsdjknfsldnfl\\\",\\\"client_phone\\\":\\\"86789897\\\",\\\"client_email\\\":\\\"jsdlkfjsdlkfds@dsf.cz\\\",\\\"order_description\\\":\\\"jashdkjashdk\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"BeMKIXWYrPOCLDiIK98Ygddz5hMbnRwHc9gLU0cW\\\"}\"', '0', 'system/public'),
(30, '2026-08-09 22:35:01', '127.0.0.1', 'error', 'WebSalesOrder', 'Nepodařilo se odeslat potvrzovací e-mail: Connection could not be established with host \"127.0.0.1:1025\": stream_socket_client(): Unable to connect to 127.0.0.1:1025 (Connection refused)', 'WebSalesOrder', 4, NULL, '\"{\\\"client_name\\\":\\\"Test\\\",\\\"ico\\\":\\\"768789\\\",\\\"client_address\\\":\\\"jsdjknfsldnfl\\\",\\\"client_phone\\\":\\\"86789897\\\",\\\"client_email\\\":\\\"jsdlkfjsdlkfds@dsf.cz\\\",\\\"order_description\\\":\\\"jashdkjashdk\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"BeMKIXWYrPOCLDiIK98Ygddz5hMbnRwHc9gLU0cW\\\"}\"', '0', 'system/public'),
(31, '2026-08-09 22:55:04', '127.0.0.1', 'DATA_EXPORT', 'web/logs', 'User exported 30 records from table: Seznam událostí systému.', 'collection', NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(32, '2026-08-09 23:02:35', '127.0.0.1', 'create', 'WebSalesLead', 'Vytvořen nový lead: TESTING FESTING', 'WebSalesLead', 8, 25, '\"{\\\"subject_name\\\":\\\"TESTING FESTING\\\",\\\"user_id\\\":null,\\\"salesman_name\\\":null,\\\"contact_other\\\":null,\\\"source_url\\\":null,\\\"first_contact_date\\\":null,\\\"contact_person\\\":null,\\\"contact_email\\\":null,\\\"contact_phone\\\":null,\\\"location\\\":null,\\\"source_channel\\\":\\\"LinkedIn - Direct Message\\\",\\\"status\\\":\\\"Nov\\u00e9\\\",\\\"priority\\\":\\\"N\\u00edzk\\u00e1\\\",\\\"last_contact_date\\\":null,\\\"next_step\\\":null,\\\"description\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(33, '2026-08-09 23:02:38', '127.0.0.1', 'generate_link', 'WebSalesLead', 'Vygenerován odkaz na objednávkový formulář pro lead ID: 8', 'WebSalesLead', 8, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(34, '2026-08-09 23:03:07', '127.0.0.1', 'create', 'WebSalesOrder', 'Vytvořena realizace pro: TESTING FESTING', 'WebSalesOrder', 5, NULL, '\"{\\\"client_name\\\":\\\"TESTING FESTING\\\",\\\"ico\\\":\\\"678678678\\\",\\\"client_address\\\":null,\\\"client_phone\\\":null,\\\"client_email\\\":\\\"jonas.bucina@seznam.cz\\\",\\\"order_description\\\":\\\"djgdkfhgjd\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"TLOqtoSc3dcylJIBjkeYrJHvJxPpCpgJy7NDeKxG\\\"}\"', '0', 'system/public'),
(35, '2026-08-09 23:03:07', '127.0.0.1', 'error', 'WebSalesOrder', 'Nepodařilo se odeslat potvrzovací e-mail: Connection could not be established with host \"127.0.0.1:1025\": stream_socket_client(): Unable to connect to 127.0.0.1:1025 (Connection refused)', 'WebSalesOrder', 5, NULL, '\"{\\\"client_name\\\":\\\"TESTING FESTING\\\",\\\"ico\\\":\\\"678678678\\\",\\\"client_address\\\":null,\\\"client_phone\\\":null,\\\"client_email\\\":\\\"jonas.bucina@seznam.cz\\\",\\\"order_description\\\":\\\"djgdkfhgjd\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"TLOqtoSc3dcylJIBjkeYrJHvJxPpCpgJy7NDeKxG\\\"}\"', '0', 'system/public'),
(36, '2026-08-09 23:17:05', '127.0.0.1', 'create', 'WebSalesLead', 'Vytvořen nový lead: fonetia', 'WebSalesLead', 9, 25, '\"{\\\"subject_name\\\":\\\"fonetia\\\",\\\"user_id\\\":null,\\\"salesman_name\\\":null,\\\"contact_other\\\":null,\\\"source_url\\\":null,\\\"first_contact_date\\\":null,\\\"contact_person\\\":null,\\\"contact_email\\\":null,\\\"contact_phone\\\":null,\\\"location\\\":null,\\\"source_channel\\\":\\\"LinkedIn - Direct Message\\\",\\\"status\\\":\\\"Nov\\u00e9\\\",\\\"priority\\\":\\\"Vysok\\u00e1\\\",\\\"last_contact_date\\\":null,\\\"next_step\\\":null,\\\"description\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(37, '2026-08-09 23:17:07', '127.0.0.1', 'generate_link', 'WebSalesLead', 'Vygenerován odkaz na objednávkový formulář pro lead ID: 9', 'WebSalesLead', 9, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(38, '2026-08-09 23:17:23', '127.0.0.1', 'create', 'WebSalesOrder', 'Vytvořena realizace pro: fonetia', 'WebSalesOrder', 6, NULL, '\"{\\\"client_name\\\":\\\"fonetia\\\",\\\"ico\\\":\\\"6876786\\\",\\\"client_address\\\":null,\\\"client_phone\\\":null,\\\"client_email\\\":\\\"sdfsssdf@sdf.cz\\\",\\\"order_description\\\":\\\"sdfsdf\\\",\\\"dataProcessingAgreement\\\":\\\"true\\\",\\\"tosAgreement\\\":\\\"true\\\",\\\"lead_token\\\":\\\"wp8811YTlAwe47T6vpm3j6jkq90GALtZnP7YpGck\\\"}\"', '0', 'system/public'),
(39, '2026-08-09 23:41:28', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(40, '2026-08-09 23:41:37', '127.0.0.1', 'update', 'Translation:web', 'Update en.json', 'Translation', NULL, 25, '\"{\\\"lg\\\":\\\"en\\\",\\\"df\\\":\\\"NEW:faq([Array]) | NEW:common([Array]) | NEW:navigation([Array]) | NEW:projects([Array]) | NEW:footer([Array]) | NEW:legal([Array]) | NEW:form([Array]) | NEW:privacy_policy([Array]) | NEW:services(...\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(41, '2026-08-09 23:41:43', '127.0.0.1', 'update', 'Translation:web', 'Update en.json', 'Translation', NULL, 25, '\"{\\\"lg\\\":\\\"en\\\",\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(42, '2026-08-09 23:41:56', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(43, '2026-08-09 23:43:48', '127.0.0.1', 'update', 'Translation:web', 'Update en.json', 'Translation', NULL, 25, '\"{\\\"lg\\\":\\\"en\\\",\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(44, '2026-08-09 23:44:00', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(45, '2026-08-09 23:44:02', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(46, '2026-08-09 23:44:03', '127.0.0.1', 'update', 'Translation:web', 'Update en.json', 'Translation', NULL, 25, '\"{\\\"lg\\\":\\\"en\\\",\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(47, '2026-08-09 23:49:40', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(48, '2026-08-09 23:49:42', '127.0.0.1', 'update', 'Translation:web', 'Update en.json', 'Translation', NULL, 25, '\"{\\\"lg\\\":\\\"en\\\",\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(49, '2026-08-09 23:55:33', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(50, '2026-08-09 23:55:35', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(51, '2026-08-09 23:56:46', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(52, '2026-08-09 23:56:48', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(53, '2026-08-09 23:57:12', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(54, '2026-08-09 23:57:14', '127.0.0.1', 'update', 'Translation:web', 'Update en.json', 'Translation', NULL, 25, '\"{\\\"lg\\\":\\\"en\\\",\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(55, '2026-08-09 23:57:42', '127.0.0.1', 'update', 'Languages:web', 'Aktualizace seznamu jazyků a metadat', 'Translation', NULL, 25, '\"{\\\"lg\\\":null,\\\"df\\\":\\\"no_val_change\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(56, '2026-08-09 23:59:50', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: test', 'WebNews', 4, 25, '\"{\\\"title\\\":\\\"test\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"assdf\\\",\\\"message\\\":\\\"ssdfsdf\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(57, '2026-08-10 00:11:03', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: test', 'WebNews', 4, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(58, '2026-08-10 00:11:07', '127.0.0.1', 'force_delete_all', 'WebNews', 'Hromadné smazání koše novinek. Počet: 1', 'WebNews', NULL, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(59, '2026-08-10 00:14:31', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: asdasd', 'WebNews', 5, 25, '\"{\\\"title\\\":\\\"asdasd\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"asdadsad\\\",\\\"message\\\":\\\"as\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(60, '2026-08-10 00:15:26', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: asdasd', 'WebNews', 5, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(61, '2026-08-10 00:15:32', '127.0.0.1', 'hard_delete', 'WebNews', 'Smazání novinky: asdasd', 'WebNews', 5, 25, '\"{\\\"force_delete\\\":\\\"true\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(62, '2026-08-10 00:15:46', '127.0.0.1', 'soft_delete', 'WebSalesLead', 'Smazání leadu ID: 9', 'WebSalesLead', 9, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(63, '2026-08-10 00:15:48', '127.0.0.1', 'soft_delete', 'WebSalesLead', 'Smazání leadu ID: 8', 'WebSalesLead', 8, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(64, '2026-08-10 00:15:51', '127.0.0.1', 'soft_delete', 'WebSalesLead', 'Smazání leadu ID: 7', 'WebSalesLead', 7, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(65, '2026-08-10 00:15:55', '127.0.0.1', 'force_delete_all', 'WebSalesLead', 'Hromadné smazání koše leadů. Počet: 3', 'WebSalesLead', NULL, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(66, '2026-08-10 00:16:08', '127.0.0.1', 'soft_delete', 'WebSalesOrder', 'Smazání realizace ID: 6', 'WebSalesOrder', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(67, '2026-08-10 00:16:11', '127.0.0.1', 'soft_delete', 'WebSalesOrder', 'Smazání realizace ID: 5', 'WebSalesOrder', 5, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(68, '2026-08-10 00:16:14', '127.0.0.1', 'soft_delete', 'WebSalesOrder', 'Smazání realizace ID: 4', 'WebSalesOrder', 4, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(69, '2026-08-10 00:16:17', '127.0.0.1', 'soft_delete', 'WebSalesOrder', 'Smazání realizace ID: 3', 'WebSalesOrder', 3, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(70, '2026-08-10 00:16:22', '127.0.0.1', 'force_delete_all', 'WebSalesOrder', 'Hromadné smazání koše realizací. Počet: 4', 'WebSalesOrder', NULL, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(71, '2026-08-10 00:16:35', '127.0.0.1', 'soft_delete', 'WebJobApplication', 'Smazání uchazeče ID: 6', 'WebJobApplication', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(72, '2026-08-10 00:16:37', '127.0.0.1', 'soft_delete', 'WebJobApplication', 'Smazání uchazeče ID: 5', 'WebJobApplication', 5, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(73, '2026-08-10 00:16:40', '127.0.0.1', 'soft_delete', 'WebJobApplication', 'Smazání uchazeče ID: 4', 'WebJobApplication', 4, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(74, '2026-08-10 20:08:41', '127.0.0.1', 'export_json', 'web/logs', 'User exported 15 records (JSON) from table: Seznam událostí systému.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(75, '2026-08-10 20:08:58', '127.0.0.1', 'export_txt', 'web/logs', 'User exported 15 records (TXT) from table: Seznam událostí systému.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(76, '2026-08-10 20:09:44', '127.0.0.1', 'export_csv', 'web/logs', 'User exported 15 records (CSV) from table: Seznam událostí systému.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(77, '2026-08-10 20:36:56', '127.0.0.1', 'create', 'Web', 'Vytvořen externí odkaz: test', 'WebExternalLink', 2, 25, '{\"name\":\"test\",\"url\":\"https:\\/\\/www.google.com\\/?hl=cs\",\"position\":\"1\",\"is_active\":\"1\"}', '25', 'jonasbucina@rpsw.cz'),
(78, '2026-08-10 20:37:40', '127.0.0.1', 'PasswordChanged', 'User', 'Změna hesla u: lindicka@mazliva.cz (provedl admin: jonasbucina@rpsw.cz)', 'User', 34, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(79, '2026-08-10 20:37:42', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(80, '2026-08-10 20:37:48', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: lindicka@mazliva.cz', 'User', 34, 34, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '34', 'lindicka@mazliva.cz'),
(81, '2026-08-10 20:37:56', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: lindicka@mazliva.cz', 'User', 34, 34, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '34', 'lindicka@mazliva.cz'),
(82, '2026-08-10 20:38:02', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(83, '2026-08-10 20:38:10', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: lindicka@mazliva.cz', 'User', 34, 25, '\"{\\\"id\\\":34,\\\"user_email\\\":\\\"lindicka@mazliva.cz\\\",\\\"contact_email\\\":\\\"lindicka@mazliva.cz\\\",\\\"full_name\\\":\\\"Lindi\\u010dka Tr\\u00fdb\\u00ed\\u010dkov\\u00e1 Mazliva\\\",\\\"birth_date\\\":null,\\\"personal_id_num\\\":null,\\\"address\\\":null,\\\"bank_account\\\":null,\\\"health_insurance\\\":null,\\\"commission_rate\\\":10,\\\"dpp_hours_spent\\\":0,\\\"has_tax_declaration\\\":false,\\\"phone_number\\\":null,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-10 20:37:48\\\",\\\"created_at\\\":\\\"2026-02-14 08:12:31\\\",\\\"updated_at\\\":\\\"2026-08-10 20:37:48\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":1,\\\"roles\\\":[{\\\"id\\\":2,\\\"role_name\\\":\\\"admin\\\",\\\"description\\\":\\\"Administr\\u00e1tor - spr\\u00e1va webu\\\",\\\"is_protected\\\":true,\\\"users_count\\\":1,\\\"permissions\\\":[\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"core-view-welcome-page\\\"],\\\"created_at\\\":\\\"2026-02-14 09:12:31\\\",\\\"updated_at\\\":\\\"2026-02-14 09:12:31\\\"}],\\\"user_permissions\\\":[\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"core-view-welcome-page\\\"],\\\"permissions\\\":[\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"core-view-welcome-page\\\"]}\"', '25', 'jonasbucina@rpsw.cz'),
(84, '2026-08-10 20:38:13', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(85, '2026-08-10 20:38:18', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: lindicka@mazliva.cz', 'User', 34, 34, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '34', 'lindicka@mazliva.cz'),
(86, '2026-08-10 20:38:28', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: lindicka@mazliva.cz', 'User', 34, 34, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '34', 'lindicka@mazliva.cz'),
(87, '2026-08-10 20:38:32', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(88, '2026-08-10 22:37:13', '127.0.0.1', 'create', 'WebSupportTicket', 'Nový ticket: asdasdad', 'WebSupportTicket', 5, 25, '\"{\\\"category\\\":\\\"it\\\",\\\"priority\\\":\\\"medium\\\",\\\"subject\\\":\\\"asdasdad\\\",\\\"description\\\":\\\"asdadasdad\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(89, '2026-08-10 22:42:07', '127.0.0.1', 'create', 'WebSupportTicket', 'Nový ticket: asdasdsd', 'WebSupportTicket', 6, 25, '\"{\\\"subject\\\":\\\"asdasdsd\\\",\\\"category\\\":\\\"it\\\",\\\"priority\\\":\\\"low\\\",\\\"description\\\":\\\"asdsdf\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(90, '2026-08-11 00:47:07', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: lindicka@mazliva.cz', 'User', 34, 25, '\"{\\\"id\\\":34,\\\"user_email\\\":\\\"lindicka@mazliva.cz\\\",\\\"full_name\\\":\\\"Lindi\\u010dka Tr\\u00fdb\\u00ed\\u010dkov\\u00e1 Mazliva\\\",\\\"commission_rate\\\":10,\\\"dpp_hours_spent\\\":0,\\\"has_tax_declaration\\\":false,\\\"enable_2fa\\\":true,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-10 20:38:18\\\",\\\"created_at\\\":\\\"2026-02-14 08:12:31\\\",\\\"updated_at\\\":\\\"2026-08-11 00:23:26\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":2,\\\"roles\\\":[{\\\"id\\\":1,\\\"role_name\\\":\\\"sysadmin\\\",\\\"description\\\":\\\"Syst\\u00e9mov\\u00fd administr\\u00e1tor - m\\u00e1 v\\u0161e\\\",\\\"is_protected\\\":true,\\\"users_count\\\":2,\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"],\\\"created_at\\\":\\\"2026-02-14 09:12:31\\\",\\\"updated_at\\\":\\\"2026-02-14 09:12:31\\\"}],\\\"user_permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"],\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"]}\"', '25', 'jonasbucina@rpsw.cz'),
(91, '2026-08-11 00:47:13', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"id\\\":25,\\\"user_email\\\":\\\"jonasbucina@rpsw.cz\\\",\\\"full_name\\\":\\\"Jon\\u00e1\\u0161 Bu\\u010dina\\\",\\\"commission_rate\\\":10,\\\"dpp_hours_spent\\\":0,\\\"has_tax_declaration\\\":false,\\\"enable_2fa\\\":true,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-10 20:38:32\\\",\\\"created_at\\\":\\\"2026-02-14 08:12:31\\\",\\\"updated_at\\\":\\\"2026-08-11 00:23:26\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":2,\\\"roles\\\":[{\\\"id\\\":1,\\\"role_name\\\":\\\"sysadmin\\\",\\\"description\\\":\\\"Syst\\u00e9mov\\u00fd administr\\u00e1tor - m\\u00e1 v\\u0161e\\\",\\\"is_protected\\\":true,\\\"users_count\\\":1,\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"],\\\"created_at\\\":\\\"2026-02-14 09:12:31\\\",\\\"updated_at\\\":\\\"2026-02-14 09:12:31\\\"}],\\\"user_permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"],\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"]}\"', '25', 'jonasbucina@rpsw.cz'),
(92, '2026-08-11 00:55:22', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(93, '2026-08-11 00:55:27', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: lindicka@mazliva.cz', 'User', 34, 34, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '34', 'lindicka@mazliva.cz'),
(94, '2026-08-11 00:55:36', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: lindicka@mazliva.cz', 'User', 34, 34, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '34', 'lindicka@mazliva.cz'),
(95, '2026-08-11 00:55:39', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(96, '2026-08-11 00:56:00', '127.0.0.1', 'create', 'CoreRole', 'Created role: test', 'CoreRole', 12, 25, '\"{\\\"role_name\\\":\\\"test\\\",\\\"description\\\":\\\"test\\\",\\\"is_protected\\\":false,\\\"users_count\\\":0,\\\"permissions\\\":[]}\"', '25', 'jonasbucina@rpsw.cz'),
(97, '2026-08-11 00:56:27', '127.0.0.1', 'sync_permissions', 'CoreRole', 'Aktualizována oprávnění role: test (13 oprávnění)', 'CoreRole', 12, 25, '\"{\\\"permission_keys\\\":[\\\"core-view-welcome-page\\\",\\\"view-deleted\\\",\\\"web-manage-administrators\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"web-view-job-applications\\\",\\\"web-view-news\\\",\\\"web-view-personal-info\\\",\\\"web-view-sales-leads\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-user-requests\\\",\\\"web-view-web-logs\\\"]}\"', '25', 'jonasbucina@rpsw.cz'),
(98, '2026-08-11 00:57:51', '127.0.0.1', 'create', 'User', 'Vytvořen uživatel: test@test.test', 'User', 86, 25, '\"{\\\"user_email\\\":\\\"test@test.test\\\",\\\"full_name\\\":\\\"Test\\\",\\\"role_id\\\":12,\\\"enable_2fa\\\":true,\\\"internal_note\\\":null,\\\"dpp_hours_spent\\\":0}\"', '25', 'jonasbucina@rpsw.cz'),
(99, '2026-08-11 00:57:56', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(100, '2026-08-11 00:58:05', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: test@test.test', 'User', 86, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '86', 'test@test.test'),
(101, '2026-08-11 00:58:10', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: test@test.test', 'User', 86, NULL, '\"{\\\"enable_2fa\\\":false}\"', '86', 'test@test.test'),
(102, '2026-08-11 00:58:40', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: jonasbucina@rpsw.cz', 'User', 25, NULL, '\"{\\\"id\\\":25,\\\"user_email\\\":\\\"jonasbucina@rpsw.cz\\\",\\\"full_name\\\":\\\"Jon\\u00e1\\u0161 Bu\\u010dina\\\",\\\"dpp_hours_spent\\\":0,\\\"enable_2fa\\\":true,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-11 00:55:39\\\",\\\"created_at\\\":\\\"2026-02-14 08:12:31\\\",\\\"updated_at\\\":\\\"2026-08-11 00:55:39\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":2,\\\"roles\\\":[{\\\"id\\\":1,\\\"role_name\\\":\\\"sysadmin\\\",\\\"description\\\":\\\"Syst\\u00e9mov\\u00fd administr\\u00e1tor - m\\u00e1 v\\u0161e\\\",\\\"is_protected\\\":true,\\\"users_count\\\":1,\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"],\\\"created_at\\\":\\\"2026-02-14 09:12:31\\\",\\\"updated_at\\\":\\\"2026-02-14 09:12:31\\\"}],\\\"user_permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"],\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"shop-view-reports\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"shop-manage-shipping-methods\\\",\\\"shop-manage-suppliers\\\",\\\"shop-manage-payment-methods\\\",\\\"shop-set-maitanance-mode\\\",\\\"web-edit-legal\\\",\\\"web-view-web-settings\\\",\\\"shop-view-edit-eshop\\\",\\\"core-view-welcome-page\\\",\\\"web-manage-external-links\\\",\\\"view-core\\\"]}\"', '86', 'test@test.test'),
(103, '2026-08-11 01:09:03', '127.0.0.1', 'update_denied', 'User', 'Zamítnut pokus o povýšení účtu na sysadmina: jonasbucina@rpsw.cz', 'User', 25, NULL, '\"{\\\"id\\\":25,\\\"user_email\\\":\\\"jonasbucina@rpsw.cz\\\",\\\"full_name\\\":\\\"Jon\\u00e1\\u0161 Bu\\u010dina\\\",\\\"dpp_hours_spent\\\":0,\\\"enable_2fa\\\":true,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-11 00:55:39\\\",\\\"created_at\\\":\\\"2026-02-14 08:12:31\\\",\\\"updated_at\\\":\\\"2026-08-11 00:55:39\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":1,\\\"roles\\\":[{\\\"id\\\":2,\\\"role_name\\\":\\\"admin\\\",\\\"description\\\":\\\"Administr\\u00e1tor - spr\\u00e1va webu\\\",\\\"is_protected\\\":true,\\\"users_count\\\":2,\\\"permissions\\\":[\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"core-view-welcome-page\\\"],\\\"created_at\\\":\\\"2026-02-14 09:12:31\\\",\\\"updated_at\\\":\\\"2026-02-14 09:12:31\\\"}],\\\"user_permissions\\\":[\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"core-view-welcome-page\\\"],\\\"permissions\\\":[\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"shop-manage-products\\\",\\\"shop-manage-categories\\\",\\\"shop-view-orders\\\",\\\"shop-manage-customers\\\",\\\"view-web\\\",\\\"view-eshop\\\",\\\"shop-view-dashboard\\\",\\\"shop-view-logs\\\",\\\"core-view-welcome-page\\\"]}\"', '86', 'test@test.test'),
(104, '2026-08-11 01:10:42', '127.0.0.1', 'create_denied', 'User', 'Zamítnut pokus o vytvoření nového sysadmin účtu: tset@sdf.cz', 'User', NULL, NULL, '\"{\\\"user_email\\\":\\\"tset@sdf.cz\\\",\\\"full_name\\\":\\\"jkljlkj\\\",\\\"role_id\\\":1,\\\"enable_2fa\\\":false,\\\"internal_note\\\":null,\\\"dpp_hours_spent\\\":0}\"', '86', 'test@test.test'),
(105, '2026-08-11 01:10:48', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: test@test.test', 'User', 86, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '86', 'test@test.test'),
(106, '2026-08-11 01:11:10', '127.0.0.1', 'login_failed', 'Auth', 'Neúspěšný pokus o přihlášení na login: test@test.cz', 'User', NULL, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '0', 'test@test.cz'),
(107, '2026-08-11 01:11:24', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: test@test.test', 'User', 86, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '86', 'test@test.test'),
(108, '2026-08-11 01:11:37', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: test@test.test', 'User', 86, NULL, '\"{\\\"id\\\":86,\\\"user_email\\\":\\\"test@test.test\\\",\\\"full_name\\\":\\\"Test\\\",\\\"dpp_hours_spent\\\":0,\\\"enable_2fa\\\":false,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-11 01:11:24\\\",\\\"created_at\\\":\\\"2026-08-11 00:57:51\\\",\\\"updated_at\\\":\\\"2026-08-11 01:11:24\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":2,\\\"roles\\\":[{\\\"id\\\":12,\\\"role_name\\\":\\\"test\\\",\\\"description\\\":\\\"test\\\",\\\"is_protected\\\":false,\\\"users_count\\\":1,\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"core-view-welcome-page\\\"],\\\"created_at\\\":\\\"2026-08-11 00:56:00\\\",\\\"updated_at\\\":\\\"2026-08-11 00:56:00\\\"}],\\\"user_permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"core-view-welcome-page\\\"],\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"core-view-welcome-page\\\"]}\"', '86', 'test@test.test'),
(109, '2026-08-11 01:22:08', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: test@test.test', 'User', 86, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '86', 'test@test.test'),
(110, '2026-08-11 01:22:11', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(111, '2026-08-11 01:22:36', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: dasdasd', 'WebNews', 6, 25, '\"{\\\"title\\\":\\\"dasdasd\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"dasdasd\\\",\\\"message\\\":\\\"dasdasd\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz');
INSERT INTO `web_logs` (`id`, `created_at`, `origin`, `event_type`, `module`, `description`, `affected_entity_type`, `affected_entity_id`, `user_id`, `context_data`, `user_id_plain`, `user_plain`) VALUES
(112, '2026-08-11 01:22:47', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: dasdasd', 'WebNews', 7, 25, '\"{\\\"title\\\":\\\"dasdasd\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"dasdasd\\\",\\\"message\\\":\\\"dasdasd\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(113, '2026-08-11 01:22:54', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: dasdasd', 'WebNews', 8, 25, '\"{\\\"title\\\":\\\"dasdasd\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"dasdasd\\\",\\\"message\\\":\\\"dasdasd\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(114, '2026-08-11 01:23:01', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: dasdasd', 'WebNews', 9, 25, '\"{\\\"title\\\":\\\"dasdasd\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"dasdasd\\\",\\\"message\\\":\\\"dasdasd\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(115, '2026-08-11 01:23:46', '127.0.0.1', 'export_json', 'web/news', 'User exported 4 records (JSON) from table: Seznam aktualit a novinek.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(116, '2026-08-11 01:33:32', '127.0.0.1', 'PasswordChanged', 'User', 'Změna hesla u: test@test.test (provedl admin: jonasbucina@rpsw.cz)', 'User', 86, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(117, '2026-08-11 01:34:59', '127.0.0.1', 'PasswordChanged', 'User', 'Změna hesla u: jonasbucina@rpsw.cz ', 'User', 25, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(118, '2026-08-11 01:35:23', '127.0.0.1', 'PasswordChanged', 'User', 'Změna hesla u: jonasbucina@rpsw.cz ', 'User', 25, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(119, '2026-08-11 01:36:54', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: test@test.test', 'User', 86, NULL, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '86', 'test@test.test'),
(120, '2026-08-11 01:37:24', '127.0.0.1', 'PasswordChanged', 'User', 'Změna hesla u: test@test.test (provedl admin: jonasbucina@rpsw.cz)', 'User', 86, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(121, '2026-08-11 13:58:01', '127.0.0.1', 'PasswordChanged', 'User', 'Změna hesla u: test@test.test (provedl admin: jonasbucina@rpsw.cz)', 'User', 86, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(122, '2026-08-11 14:02:51', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(123, '2026-08-11 14:02:54', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(124, '2026-08-11 15:02:31', '127.0.0.1', 'export', 'User', 'Hromadný export uživatelů.', 'User', NULL, 25, '\"{\\\"no_pagination\\\":\\\"true\\\",\\\"sort_by\\\":\\\"id\\\",\\\"sort_direction\\\":\\\"desc\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(125, '2026-08-11 15:02:32', '127.0.0.1', 'export_json', 'core/users', 'User exported 3 records (JSON) from table: Seznam Administrátorksých účtů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(126, '2026-08-11 15:03:25', '127.0.0.1', 'export_json', 'web/logs', 'User exported 15 records (JSON) from table: Seznam událostí systému.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(127, '2026-08-11 15:24:25', '127.0.0.1', 'update', 'User', 'Aktualizace uživatele: test@test.test', 'User', 86, 25, '\"{\\\"id\\\":86,\\\"user_email\\\":\\\"test@test.test\\\",\\\"full_name\\\":\\\"Testova\\u010d Testov\\u00fd\\\",\\\"dpp_hours_spent\\\":0,\\\"enable_2fa\\\":true,\\\"internal_note\\\":null,\\\"last_login_at\\\":\\\"2026-08-11 01:36:54\\\",\\\"created_at\\\":\\\"2026-08-11 00:57:51\\\",\\\"updated_at\\\":\\\"2026-08-11 13:58:01\\\",\\\"deleted_at\\\":null,\\\"role_id\\\":12,\\\"roles\\\":[{\\\"id\\\":12,\\\"role_name\\\":\\\"test\\\",\\\"description\\\":\\\"test\\\",\\\"is_protected\\\":false,\\\"users_count\\\":1,\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"core-view-welcome-page\\\"],\\\"created_at\\\":\\\"2026-08-11 00:56:00\\\",\\\"updated_at\\\":\\\"2026-08-11 00:56:00\\\"}],\\\"user_permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"core-view-welcome-page\\\"],\\\"permissions\\\":[\\\"web-manage-administrators\\\",\\\"web-view-web-logs\\\",\\\"web-view-personal-info\\\",\\\"web-view-user-requests\\\",\\\"web-view-dashboard\\\",\\\"web-view-edit-website\\\",\\\"view-deleted\\\",\\\"web-view-sales-leads\\\",\\\"web-view-news\\\",\\\"web-view-sales-orders\\\",\\\"web-view-support-tickets\\\",\\\"web-view-job-applications\\\",\\\"core-view-welcome-page\\\"]}\"', '25', 'jonasbucina@rpsw.cz'),
(128, '2026-08-11 15:25:43', '127.0.0.1', 'export', 'User', 'Hromadný export uživatelů.', 'User', NULL, 25, '\"{\\\"no_pagination\\\":\\\"true\\\",\\\"sort_by\\\":\\\"id\\\",\\\"sort_direction\\\":\\\"desc\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(129, '2026-08-11 15:25:43', '127.0.0.1', 'export_csv', 'core/users', 'User exported 3 records (CSV) from table: Seznam Administrátorksých účtů.', NULL, NULL, 25, NULL, '25', 'jonasbucina@rpsw.cz'),
(130, '2026-08-11 15:51:39', '127.0.0.1', 'create', 'WebNews', 'Vytvořena novinka: sdfsdf', 'WebNews', 10, 25, '\"{\\\"title\\\":\\\"sdfsdf\\\",\\\"thema\\\":\\\"Miln\\u00edk\\\",\\\"author\\\":\\\"sdfsdf\\\",\\\"message\\\":\\\"sdfsdf\\\",\\\"bullet_1\\\":null,\\\"bullet_2\\\":null,\\\"bullet_3\\\":null,\\\"bullet_4\\\":null}\"', '25', 'jonasbucina@rpsw.cz'),
(131, '2026-08-11 15:51:48', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(132, '2026-08-11 15:51:50', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 7, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(133, '2026-08-11 15:51:54', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 9, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(134, '2026-08-11 15:51:56', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 8, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(135, '2026-08-11 16:45:10', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: dasdasd', 'WebNews', 9, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(136, '2026-08-11 16:45:12', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: dasdasd', 'WebNews', 8, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(137, '2026-08-11 16:45:15', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: dasdasd', 'WebNews', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(138, '2026-08-11 16:46:26', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: sdfsdf', 'WebNews', 10, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(139, '2026-08-11 16:46:29', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(140, '2026-08-11 16:46:46', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: sdfsdf', 'WebNews', 10, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(141, '2026-08-11 16:48:01', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: dasdasd', 'WebNews', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(142, '2026-08-11 16:48:04', '127.0.0.1', 'restore', 'WebNews', 'Obnovení novinky: dasdasd', 'WebNews', 7, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(143, '2026-08-11 16:48:13', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: sdfsdf', 'WebNews', 10, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(144, '2026-08-11 16:48:15', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(145, '2026-08-11 16:48:19', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 7, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(146, '2026-08-12 01:09:48', '127.0.0.1', 'maintenance_status_changed', 'Core', 'User jonasbucina@rpsw.cz changed status - e-shopu: ENABLED (Operational).', 'CoreSiteSetting', 1, 25, '\"{\\\"is_shop_active\\\":true,\\\"maintenance_message\\\":\\\"Omlouv\\u00e1me se, na syst\\u00e9mu moment\\u00e1ln\\u011b prob\\u00edh\\u00e1 \\u00fadr\\u017eba. Zkuste to pros\\u00edm pozd\\u011bji.\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(147, '2026-08-12 01:10:08', '127.0.0.1', 'maintenance_status_changed', 'Core', 'User jonasbucina@rpsw.cz changed status - e-shopu: DISABLED (Maintenance).', 'CoreSiteSetting', 1, 25, '\"{\\\"is_shop_active\\\":false,\\\"maintenance_message\\\":\\\"Omlouv\\u00e1me se, na syst\\u00e9mu moment\\u00e1ln\\u011b prob\\u00edh\\u00e1 \\u00fadr\\u017eba. Zkuste to pros\\u00edm pozd\\u011bji.\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(148, '2026-08-12 01:11:39', '127.0.0.1', 'logout', 'Auth', 'Uživatel se odhlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(149, '2026-08-12 01:11:43', '127.0.0.1', 'login_success', 'Auth', 'Uživatel se úspěšně přihlásil: jonasbucina@rpsw.cz', 'User', 25, 25, '\"{\\\"ip\\\":\\\"127.0.0.1\\\",\\\"user_agent\\\":\\\"Mozilla\\\\\\/5.0 (X11; Linux x86_64; rv:145.0) Gecko\\\\\\/20100101 Firefox\\\\\\/145.0\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(150, '2026-08-12 01:11:57', '127.0.0.1', 'maintenance_status_changed', 'Core', 'User jonasbucina@rpsw.cz changed status - webu: DISABLED (Maintenance).', 'CoreSiteSetting', 1, 25, '\"{\\\"is_web_active\\\":false,\\\"web_maintenance_message\\\":\\\"Omlouv\\u00e1me se, web je moment\\u00e1ln\\u011b v \\u00fadr\\u017eb\\u011b.\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(151, '2026-08-12 13:35:20', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 9, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(152, '2026-08-12 13:35:23', '127.0.0.1', 'soft_delete', 'WebNews', 'Smazání novinky: dasdasd', 'WebNews', 8, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(153, '2026-08-12 13:35:30', '127.0.0.1', 'force_delete_all', 'WebNews', 'Hromadné smazání koše novinek. Počet: 5', 'WebNews', NULL, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(154, '2026-08-12 13:35:38', '127.0.0.1', 'soft_delete', 'WebSupportTicket', 'Smazání ticketu ID: 6', 'WebSupportTicket', 6, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(155, '2026-08-12 13:35:41', '127.0.0.1', 'soft_delete', 'WebSupportTicket', 'Smazání ticketu ID: 5', 'WebSupportTicket', 5, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(156, '2026-08-12 13:35:46', '127.0.0.1', 'force_delete_all', 'WebSupportTicket', 'Hromadné smazání koše ticketů. Počet: 2', 'WebSupportTicket', NULL, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(157, '2026-08-12 13:36:14', '127.0.0.1', 'delete', 'Web', 'Smazán externí odkaz: test', 'WebExternalLink', 2, 25, '[]', '25', 'jonasbucina@rpsw.cz'),
(158, '2026-08-12 13:36:27', '127.0.0.1', 'soft_delete', 'User', 'Smazáno ID: 86', 'User', 86, 25, '\"[]\"', '25', 'jonasbucina@rpsw.cz'),
(159, '2026-08-12 13:36:39', '127.0.0.1', 'hard_delete', 'User', 'Smazáno ID: 30', 'User', 30, 25, '\"{\\\"force_delete\\\":\\\"true\\\"}\"', '25', 'jonasbucina@rpsw.cz'),
(160, '2026-08-12 13:36:45', '127.0.0.1', 'hard_delete', 'User', 'Smazáno ID: 86', 'User', 86, 25, '\"{\\\"force_delete\\\":\\\"true\\\"}\"', '25', 'jonasbucina@rpsw.cz');

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
  `file_path` varchar(255) DEFAULT NULL
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
  `status` varchar(255) DEFAULT 'nové',
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
  `attachment_path` varchar(512) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

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
-- Indexes for table `core_site_settings`
--
ALTER TABLE `core_site_settings`
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
-- Indexes for table `shop_suppliers`
--
ALTER TABLE `shop_suppliers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ico` (`ico`);

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
-- Indexes for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_web_support_user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `core_logs`
--
ALTER TABLE `core_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `core_permissions`
--
ALTER TABLE `core_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `core_roles`
--
ALTER TABLE `core_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `core_site_settings`
--
ALTER TABLE `core_site_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=702;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=701;

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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

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
-- AUTO_INCREMENT for table `shop_suppliers`
--
ALTER TABLE `shop_suppliers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=87;

--
-- AUTO_INCREMENT for table `web_external_links`
--
ALTER TABLE `web_external_links`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `web_job_applications`
--
ALTER TABLE `web_job_applications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `web_logs`
--
ALTER TABLE `web_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=161;

--
-- AUTO_INCREMENT for table `web_news`
--
ALTER TABLE `web_news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `web_raw_request_commissions`
--
ALTER TABLE `web_raw_request_commissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `core_role_permissions`
--
ALTER TABLE `core_role_permissions`
  ADD CONSTRAINT `fk_crp_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `core_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_crp_role_id` FOREIGN KEY (`role_id`) REFERENCES `core_roles` (`id`) ON DELETE CASCADE;

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
