-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Aug 15, 2026 at 04:10 PM
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
('laravel-cache-2d0c8af807ef45ac17cafb2973d866ba8f38caa9', 'i:24;', 1786803025),
('laravel-cache-2d0c8af807ef45ac17cafb2973d866ba8f38caa9:timer', 'i:1786803025;', 1786803025),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba', 'i:1;', 1786801298),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1786801298;', 1786801298),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400', 'i:9;', 1786802968),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400:timer', 'i:1786802968;', 1786802968),
('laravel-cache-site_setting_active_web', 'O:31:\"App\\Models\\Core\\CoreSiteSetting\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:18:\"core_site_settings\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:7:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:0;s:13:\"is_web_active\";i:1;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"updated_at\";s:19:\"2026-08-12 15:44:06\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";}s:11:\"\0*\0original\";a:7:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:0;s:13:\"is_web_active\";i:1;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:23:\"web_maintenance_message\";s:47:\"Omlouváme se, web je momentálně v údržbě.\";s:10:\"updated_at\";s:19:\"2026-08-12 15:44:06\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:1:{s:14:\"is_shop_active\";s:7:\"boolean\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:2:{i:0;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1786801509);

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
(2, 'web-view-web-logs', 'Prohlížení web logů', 'web', '2026-02-14 08:12:31'),
(3, 'web-view-personal-info', 'Zobrazení osobních údajů', 'web', '2026-02-14 08:12:31'),
(5, 'web-view-dashboard', 'Přístup k nástěnce', 'web', '2026-02-14 08:12:31'),
(6, 'web-view-edit-website', 'Možnost editovat web', 'web', '2026-02-14 08:12:31'),
(7, 'view-deleted', 'Zobrazit softdeleted záznamy', 'web', '2026-02-14 08:12:31'),
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
(26, 'shop-set-maintenance-mode', 'Může přepnout eshop do stavu údržby.', 'shop', '2026-06-12 13:09:55'),
(29, 'shop-view-edit-eshop', 'Možnost Editovat shop texty.', 'core', '2026-06-30 10:01:32'),
(30, 'core-view-welcome-page', 'Zobrazit uvítací stránku po přihlášení.', 'web', '2026-07-26 20:08:46'),
(32, 'view-core', 'Zobrazit Core / System založku v administraci.', 'core', '2026-08-07 07:23:39'),
(33, 'web-set-maintenance-mode', 'Může přepnout web do stavu údržby.', 'web', '2026-08-11 22:30:26'),
(35, 'web-support-tickets-view', 'Zobrazit tickety podpory', 'web', '2026-08-13 08:53:39'),
(36, 'web-support-tickets-create', 'Vytvořit ticket podpory (interní)', 'web', '2026-08-13 08:53:39'),
(37, 'web-support-tickets-update', 'Upravit ticket podpory', 'web', '2026-08-13 08:53:39'),
(38, 'web-support-tickets-delete', 'Smazat / obnovit ticket podpory', 'web', '2026-08-13 08:53:39'),
(39, 'web-sales-leads-view', 'Zobrazit sales leady', 'web', '2026-08-13 08:53:39'),
(40, 'web-sales-leads-create', 'Vytvořit sales lead', 'web', '2026-08-13 08:53:39'),
(41, 'web-sales-leads-update', 'Upravit sales lead', 'web', '2026-08-13 08:53:39'),
(42, 'web-sales-leads-delete', 'Smazat / obnovit sales lead', 'web', '2026-08-13 08:53:39'),
(43, 'web-news-view', 'Zobrazit novinky', 'web', '2026-08-13 08:53:39'),
(44, 'web-news-create', 'Vytvořit novinku', 'web', '2026-08-13 08:53:39'),
(45, 'web-news-update', 'Upravit novinku', 'web', '2026-08-13 08:53:39'),
(46, 'web-news-delete', 'Smazat / obnovit novinku', 'web', '2026-08-13 08:53:39'),
(47, 'web-sales-orders-view', 'Zobrazit poptávkové objednávky', 'web', '2026-08-13 08:53:39'),
(48, 'web-sales-orders-create', 'Vytvořit poptávkovou objednávku (interně)', 'web', '2026-08-13 08:53:39'),
(49, 'web-sales-orders-update', 'Upravit poptávkovou objednávku', 'web', '2026-08-13 08:53:39'),
(50, 'web-sales-orders-delete', 'Smazat / obnovit poptávkovou objednávku', 'web', '2026-08-13 08:53:39'),
(51, 'web-job-applications-view', 'Zobrazit uchazeče', 'web', '2026-08-13 08:53:39'),
(52, 'web-job-applications-create', 'Vytvořit záznam uchazeče (interně)', 'web', '2026-08-13 08:53:39'),
(53, 'web-job-applications-update', 'Upravit uchazeče', 'web', '2026-08-13 08:53:39'),
(54, 'web-job-applications-delete', 'Smazat / obnovit uchazeče', 'web', '2026-08-13 08:53:39'),
(55, 'core-administrators-view', 'Zobrazit administrátorské účty', 'core', '2026-08-13 08:53:39'),
(56, 'core-administrators-create', 'Vytvořit administrátorský účet', 'core', '2026-08-13 08:53:39'),
(57, 'core-administrators-update', 'Upravit administrátorský účet', 'core', '2026-08-13 08:53:39'),
(58, 'core-administrators-delete', 'Smazat / obnovit administrátorský účet', 'core', '2026-08-13 08:53:39'),
(59, 'core-external-links-view', 'Zobrazit externí odkazy', 'core', '2026-08-13 08:53:39'),
(60, 'core-external-links-create', 'Vytvořit externí odkaz', 'core', '2026-08-13 08:53:39'),
(61, 'core-external-links-update', 'Upravit externí odkaz', 'core', '2026-08-13 08:53:39'),
(62, 'core-external-links-delete', 'Smazat / obnovit externí odkaz', 'core', '2026-08-13 08:53:39'),
(63, 'core-legal-documents-view', 'Zobrazit právní dokumenty (GDPR/TOS/Cookies)', 'core', '2026-08-13 08:53:39'),
(64, 'core-legal-documents-create', 'Vytvořit sekci právního dokumentu', 'core', '2026-08-13 08:53:39'),
(65, 'core-legal-documents-update', 'Upravit sekci právního dokumentu', 'core', '2026-08-13 08:53:39'),
(66, 'core-legal-documents-delete', 'Smazat sekci právního dokumentu', 'core', '2026-08-13 08:53:39'),
(67, 'core-legal-config-view', 'Zobrazit firemní konfiguraci / sociální sítě', 'core', '2026-08-13 08:53:39'),
(68, 'core-legal-config-create', 'Vytvořit položku sociální sítě', 'core', '2026-08-13 08:53:39'),
(69, 'core-legal-config-update', 'Upravit firemní konfiguraci / sociální síť', 'core', '2026-08-13 08:53:39'),
(70, 'core-legal-config-delete', 'Smazat položku sociální sítě', 'core', '2026-08-13 08:53:39'),
(71, 'core-settings-view', 'Zobrazit firemní údaje / nastavení webu', 'core', '2026-08-13 08:53:39'),
(72, 'core-settings-update', 'Upravit firemní údaje / nastavení webu', 'core', '2026-08-13 08:53:39'),
(73, 'web-user-requests-view', 'Zobrazit uživatelské požadavky (provize)', 'web', '2026-08-13 12:10:56'),
(74, 'web-user-requests-create', 'Vytvořit uživatelský požadavek (provize)', 'web', '2026-08-13 12:10:56'),
(75, 'web-user-requests-update', 'Upravit uživatelský požadavek (provize)', 'web', '2026-08-13 12:10:56'),
(76, 'web-user-requests-delete', 'Smazat / obnovit uživatelský požadavek (provize)', 'web', '2026-08-13 12:10:56');

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
(12, 'test', 'test', '2026-08-10 22:56:00', '2026-08-10 22:56:00', NULL),
(13, 'web-read-only', NULL, '2026-08-13 11:55:25', '2026-08-13 12:14:09', NULL);

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
(1, 71),
(1, 72),
(1, 73),
(1, 74),
(1, 75),
(1, 76),
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
(2, 76),
(12, 2),
(12, 3),
(12, 5),
(12, 6),
(12, 7),
(12, 18),
(12, 19),
(12, 20),
(12, 21),
(12, 22),
(12, 23),
(12, 24),
(12, 29),
(12, 30),
(12, 32),
(12, 33),
(12, 35),
(12, 36),
(12, 37),
(12, 38),
(12, 39),
(12, 40),
(12, 41),
(12, 42),
(12, 43),
(12, 45),
(12, 47),
(12, 48),
(12, 49),
(12, 50),
(12, 51),
(12, 52),
(12, 53),
(12, 54),
(12, 55),
(12, 56),
(12, 57),
(12, 58),
(12, 59),
(12, 60),
(12, 61),
(12, 62),
(12, 63),
(12, 64),
(12, 65),
(12, 66),
(12, 67),
(12, 68),
(12, 69),
(12, 70),
(12, 71),
(12, 72),
(12, 73),
(12, 74),
(12, 75),
(12, 76),
(13, 2),
(13, 3),
(13, 5),
(13, 6),
(13, 18),
(13, 30),
(13, 32),
(13, 35),
(13, 39),
(13, 43),
(13, 47),
(13, 51),
(13, 73);

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
(1, 0, 1, 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.', 'Omlouváme se, web je momentálně v údržbě.', '2026-08-12 13:44:06', '2026-06-12 11:42:21');

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
(771, 'App\\Models\\User', 25, 'access-token', '2cb9f107963df4049984e63b73532099aff7ffa1085b2febd05db9c43f2f5c25', '[\"*\"]', '2026-08-15 14:08:29', '2026-08-15 14:40:38', '2026-08-15 13:40:38', '2026-08-15 14:08:29'),
(772, 'App\\Models\\User', 90, 'access-token', '5e2ac7905d25054d3abf62caedc019dea8cfe121304cc7ed3cdb53b5f09eca9f', '[\"*\"]', '2026-08-15 14:09:45', '2026-08-15 15:00:06', '2026-08-15 14:00:06', '2026-08-15 14:09:45');

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
(770, 25, '9f9bc78454028cbfb5475c9803f08ac3b6b38b4775b946f6e08982fb7e6a84b0', '2026-08-22 13:40:38', '2026-08-15 13:40:38', '2026-08-15 13:40:38'),
(771, 90, '77d7657749bf7a914d29853df194eabd3c6ac00b3b8cfe8a83c0bf084bf48e0f', '2026-08-22 14:00:06', '2026-08-15 14:00:06', '2026-08-15 14:00:06');

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
(25, 'jonasbucina@rpsw.cz', 'Jonáš Bučina', 0, 1, NULL, '$2y$12$PSt4jxIj8qs47185wr149uoVtxUmdWI0srk4Mq.WHSeHlmNoFPvNS', NULL, '2026-08-15 15:40:38', '2026-02-14 08:12:31', '2026-08-15 15:40:38', NULL, 0),
(34, 'lindicka@mazliva.cz', 'Lindička Trýbíčková Mazliva', 0, 1, NULL, '$2y$12$Xni0XZTdDsb22F686yDryefjAJKvlDDnh9G646kl90dDjwGLvSqtS', NULL, '2026-08-11 00:55:27', '2026-02-14 08:12:31', '2026-08-11 00:55:27', NULL, 0),
(90, 'test@test.cz', 'asdadsd', 0, 1, NULL, '$2y$12$1xKhoRDFWyrfslg9Ubrr1e.l3BRd7ULcS8tEbFGyt4/rdc0UfbsrG', NULL, '2026-08-15 10:44:45', '2026-08-13 12:35:47', '2026-08-15 10:44:45', NULL, 0),
(91, 'foner@foner.cz', 'askfjdslkf', 0, 0, NULL, '$2y$12$WEZmuC.izG6ThmGCAAop6.d7kZVb/atIamQkM/aPWxg3iaVAqhDg6', NULL, NULL, '2026-08-15 10:46:16', '2026-08-15 10:46:35', '2026-08-15 10:46:35', 0);

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
(34, 2),
(90, 1),
(91, 13);

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

--
-- Dumping data for table `web_attachments`
--

INSERT INTO `web_attachments` (`id`, `attachable_type`, `attachable_id`, `disk`, `path`, `original_filename`, `mime_type`, `size_bytes`, `created_at`) VALUES
(24, 'App\\Models\\Web\\WebJobApplication', 9, 'public', 'cv_files/P2qFNkfDdO48ZRRWHmS7VTkaijTZJGRYD35RFjFV.txt', 'xxxxxx.mp3', 'audio/mpeg', 1616, '2026-08-12 22:36:16');

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

--
-- Dumping data for table `web_job_applications`
--

INSERT INTO `web_job_applications` (`id`, `first_name`, `last_name`, `email`, `phone`, `position_name`, `message`, `cv_path`, `cv_original_name`, `state`, `internal_note`, `created_at`, `updated_at`, `deleted_at`) VALUES
(9, 'sdnfskjdfhj', 'jsdkfh', 'sdfsd@sdfdsf.cu', NULL, 'UI/UX Designer', NULL, NULL, NULL, 'Nový', NULL, '2026-08-12 22:36:16', '2026-08-12 22:36:55', '2026-08-12 22:36:55');

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
  `note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `web_raw_request_commissions`
--

INSERT INTO `web_raw_request_commissions` (`id`, `thema`, `contact_email`, `contact_phone`, `order_description`, `status`, `priority`, `created_at`, `updated_at`, `deleted_at`, `note`) VALUES
(23, 'est', 'sdfds@sdf.cz', NULL, 'sddfgf', 'Nově zadané', 'Nízká', '2026-08-13 08:57:13', '2026-08-15 11:59:46', '2026-08-15 11:59:46', NULL);

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
  `attachment_original_name` varchar(255) DEFAULT NULL,
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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `core_permissions`
--
ALTER TABLE `core_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=77;

--
-- AUTO_INCREMENT for table `core_roles`
--
ALTER TABLE `core_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=773;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=772;

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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=92;

--
-- AUTO_INCREMENT for table `web_attachments`
--
ALTER TABLE `web_attachments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `web_external_links`
--
ALTER TABLE `web_external_links`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `web_job_applications`
--
ALTER TABLE `web_job_applications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `web_logs`
--
ALTER TABLE `web_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `web_news`
--
ALTER TABLE `web_news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `web_raw_request_commissions`
--
ALTER TABLE `web_raw_request_commissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

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
