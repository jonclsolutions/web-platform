-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jun 14, 2026 at 11:06 PM
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
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba', 'i:1;', 1781431782),
('laravel-cache-5c785c036466adea360111aa28563bfd556b5fba:timer', 'i:1781431782;', 1781431782),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400', 'i:38;', 1781471212),
('laravel-cache-f6e1126cedebf23e1463aee73f9df08783640400:timer', 'i:1781471212;', 1781471212),
('laravel-cache-site_setting_active', 'O:31:\"App\\Models\\Core\\CoreSiteSetting\":33:{s:13:\"\0*\0connection\";s:5:\"mysql\";s:8:\"\0*\0table\";s:18:\"core_site_settings\";s:13:\"\0*\0primaryKey\";s:2:\"id\";s:10:\"\0*\0keyType\";s:3:\"int\";s:12:\"incrementing\";b:1;s:7:\"\0*\0with\";a:0:{}s:12:\"\0*\0withCount\";a:0:{}s:19:\"preventsLazyLoading\";b:0;s:10:\"\0*\0perPage\";i:15;s:6:\"exists\";b:1;s:18:\"wasRecentlyCreated\";b:0;s:28:\"\0*\0escapeWhenCastingToString\";b:0;s:13:\"\0*\0attributes\";a:5:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:10:\"updated_at\";s:19:\"2026-06-12 17:15:43\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";}s:11:\"\0*\0original\";a:5:{s:2:\"id\";i:1;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";s:87:\"Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.\";s:10:\"updated_at\";s:19:\"2026-06-12 17:15:43\";s:10:\"created_at\";s:19:\"2026-06-12 13:42:21\";}s:10:\"\0*\0changes\";a:0:{}s:11:\"\0*\0previous\";a:0:{}s:8:\"\0*\0casts\";a:1:{s:14:\"is_shop_active\";s:7:\"boolean\";}s:17:\"\0*\0classCastCache\";a:0:{}s:21:\"\0*\0attributeCastCache\";a:0:{}s:13:\"\0*\0dateFormat\";N;s:10:\"\0*\0appends\";a:0:{}s:19:\"\0*\0dispatchesEvents\";a:0:{}s:14:\"\0*\0observables\";a:0:{}s:12:\"\0*\0relations\";a:0:{}s:10:\"\0*\0touches\";a:0:{}s:27:\"\0*\0relationAutoloadCallback\";N;s:26:\"\0*\0relationAutoloadContext\";N;s:10:\"timestamps\";b:1;s:13:\"usesUniqueIds\";b:0;s:9:\"\0*\0hidden\";a:0:{}s:10:\"\0*\0visible\";a:0:{}s:11:\"\0*\0fillable\";a:2:{i:0;s:14:\"is_shop_active\";i:1;s:19:\"maintenance_message\";}s:10:\"\0*\0guarded\";a:1:{i:0;s:1:\"*\";}}', 1781471301);

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
(26, 'shop-set-maitanance-mode', 'Může přepnout eshop do stavu údržby.', 'core', '2026-06-12 13:09:55'),
(27, 'web-edit-legal', 'Editovat GDPR a TOS.', 'core', '2026-06-12 19:24:15'),
(28, 'web-view-web-settings', 'Může editovat nastavení webu.', 'core', '2026-06-13 08:40:51');

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
(3, 'primeadmin', 'Primární administrátor - správa admins', '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(4, 'UI/UX Designer', 'Designer - správa UI/UX', '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(5, 'Salesman', 'Prodejce - správa sales', '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL),
(6, 'shop-manager', 'Manager e-shopu', '2026-03-22 08:12:31', '2026-03-22 08:12:31', NULL);

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
(3, 1),
(3, 2),
(3, 5),
(3, 18),
(4, 3),
(4, 5),
(4, 6),
(4, 18),
(5, 3),
(5, 5),
(5, 8),
(5, 10),
(5, 18),
(6, 5),
(6, 13),
(6, 14),
(6, 15),
(6, 16),
(6, 17),
(6, 18),
(6, 19),
(6, 20),
(6, 21);

-- --------------------------------------------------------

--
-- Table structure for table `core_site_settings`
--

CREATE TABLE `core_site_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `is_shop_active` tinyint(1) NOT NULL DEFAULT 1,
  `maintenance_message` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `core_site_settings`
--

INSERT INTO `core_site_settings` (`id`, `is_shop_active`, `maintenance_message`, `updated_at`, `created_at`) VALUES
(1, 1, 'Omlouváme se, na systému momentálně probíhá údržba. Zkuste to prosím později.', '2026-06-12 15:15:43', '2026-06-12 11:42:21');

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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `document_sections`
--

INSERT INTO `document_sections` (`id`, `document_type_id`, `position`, `heading`, `content`, `created_at`, `updated_at`) VALUES
(24, 1, 1, '1. Úvodní ustanovení', 'Tyto Zásady zpracování osobních údajů (dále jen „Zásady“) popisují, jak společnost RegioPartner, s.r.o., se sídlem Kytlická 862/6, 190 00 Praha, IČO: 25133161, DIČ: CZ25133161, zapsaná v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 52029 (dále jen „my“ nebo „Správce“), shromažďuje, používá a chrání osobní údaje, které nám poskytujete v souvislosti s používáním našich webových stránek a našich služeb, zejména inzerce digitálních produktů a služeb. Zavazujeme se chránit vaše soukromí a zpracováváme osobní údaje v souladu s Nařízením Evropského parlamentu a Rady (EU) 2016/679 (dále jen „GDPR“) a platnými právními předpisy České republiky, zejména zákonem č. 110/2019 Sb., o zpracování osobních údajů, ve znění pozdějších předpisů. Pokud s těmito Zásadami nesouhlasíte, prosíme, nepoužívejte naše webové stránky ani služby.', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(25, 1, 2, '2. Správce osobních údajů', 'Správcem vašich osobních údajů je: RegioPartner, s.r.o. Sídlo: Kytlická 862/6, 190 00 Praha IČO: 25133161 DIČ: CZ25133161 E-mail: info@rpsw.cz Telefon: +420 733 188 328 V případě dotazů ohledně zpracování osobních údajů nás prosím kontaktujte na výše uvedeném e-mailu.', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(26, 1, 3, '3. Jaké osobní údaje shromažďujeme a proč', 'Shromažďujeme a zpracováváme osobní údaje pouze pro definované, legitimní účely a v rozsahu nezbytném pro naplnění těchto účelů. 3.1. Údaje poskytnuté vámi: Můžeme shromažďovat osobní údaje, které nám dobrovolně poskytnete, například při: Vytvoření objednávky služeb: Jméno, příjmení, e-mail, telefon. Účel: Vyřízení objednávky a poskytnutí sjednané služby. Právní základ: Plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR). Kontaktu prostřednictvím formuláře: Jméno, e-mail, telefon, obsah zprávy. Účel: Zodpovězení dotazu, řešení požadavku, poskytnutí cenové nabídky. Právní základ: Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR) na efektivní komunikaci se zákazníky/uživateli a předsmluvní jednání. Přihlášení k odběru newsletteru: E-mail. Účel: Zasílání obchodních sdělení a informací o novinkách. Právní základ: Souhlas (čl. 6 odst. 1 písm. a) GDPR). 3.2. Údaje shromažďované automaticky: Při používání našich webových stránek můžeme automaticky shromažďovat některé informace, jako jsou: IP adresa: Účel: Zabezpečení webu, diagnostika problémů, statistiky návštěvnosti. Právní základ: Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR). Údaje o prohlížeči a zařízení: Typ prohlížeče, operační systém, jazyk. Účel: Zajištění správné funkčnosti webu, optimalizace zobrazení. Právní základ: Oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR). Údaje o návštěvnosti webu (cookies a podobné technologie): Zobrazované stránky, doba strávená na stránce, reference na jiné weby. Účel: Zlepšování funkčnosti webu, analýza chování uživatelů. Právní základ: Souhlas (pro marketingové a analytické cookies, čl. 6 odst. 1 písm. a) GDPR), oprávněný zájem (pro nezbytné cookies, čl. 6 odst. 1 písm. f) GDPR).', '2026-06-13 05:55:39', '2026-06-13 05:56:51'),
(27, 1, 4, '4. Jak dlouho osobní údaje uchováváme', 'Osobní údaje uchováváme pouze po dobu nezbytně nutnou k naplnění účelů, pro které byly shromážděny, nebo po dobu stanovenou právními předpisy. Doba uchování se liší v závislosti na typu údajů a účelu zpracování: Údaje pro plnění smlouvy: Po dobu trvání smluvního vztahu a následně po dobu stanovenou zákonem pro archivaci účetních a daňových dokladů (obvykle 10 let). Údaje pro marketingové účely (newsletter): Po dobu trvání vašeho souhlasu, nejdéle však 5 let od jeho udělení, nebo do odvolání souhlasu. Údaje z kontaktních formulářů: Po dobu nezbytnou pro vyřízení vašeho požadavku, obvykle 1 rok. Údaje z cookies: Doba uchování se liší dle typu cookies (viz naše Zásady používání souborů cookie). Po uplynutí doby uchování jsou osobní údaje vymazány nebo anonymizovány.', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(28, 1, 5, '5. Komu osobní údaje předáváme (Příjemci)', 'Vaše osobní údaje předáváme pouze v nezbytném rozsahu a pouze prověřeným subjektům, a to na základě smlouvy o zpracování osobních údajů, která zajišťuje stejnou úroveň ochrany. Může se jednat o: Poskytovatelé IT služeb a hostingu: Pro zajištění provozu webu a informačních systémů. Jedná se například o společnost INTERNET CZ, a.s. Poskytovatelé marketingových a analytických služeb: (např. Google Analytics, nástroje pro e-mail marketing). Poskytovatelé platebních služeb: Pro zpracování plateb (např. banky, platební brány). Účetní a právní poradci: Pro plnění právních povinností a obranu právních nároků. Orgány veřejné moci: V případě zákonné povinnosti (např. soudy, policie, finanční úřad). Nepředáváme osobní údaje do zemí mimo Evropskou unii nebo Evropský hospářský prostor bez zajištění odpovídajících záruk ochrany osobních údajů (např. standardní smluvní doložky).', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(29, 1, 6, '6. Vaše práva v souvislosti se zpracováním osobních údajů', 'V souladu s GDPR máte následující práva: Právo na přístup k osobním údajům (čl. 15 GDPR): Máte právo získat potvrzení, zda jsou či nejsou vaše osobní údaje zpracovávány. Právo na opravu (čl. 16 GDPR): Máte právo na opravu nepřesných nebo doplnění neúplných údajů. Právo na výmaz (čl. 17 GDPR): Právo „být zapomenut“, pokud jsou splněny zákonné důvody. Právo na omezení zpracování (čl. 18 GDPR): Máte právo na omezení zpracování v případech stanovených GDPR. Právo na přenositelnost údajů (čl. 20 GDPR): Právo získat údaje ve strukturovaném a strojově čitelném formátu. Právo vznést námitku (čl. 21 GDPR): Právo vznést námitku proti zpracování založeném na oprávněném zájmu nebo pro přímý marketing. Právo odvolat souhlas (čl. 7 odst. 3 GDPR): Právo souhlas kdykoli odvolat. Právo podat stížnost u dozorového úřadu (čl. 77 GDPR). Kontakt na dozorový úřad: Úřad pro ochranu osobních údajů Pplk. Sochora 27, 170 00 Praha 7 Telefon: +420 234 665 800 Web: www.uoou.cz', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(30, 1, 7, '7. Bezpečnost osobních údajů', 'Přijali jsme vhodná technická a organizační opatření k ochraně vašich osobních údajů před neoprávněným přístupem, změnou, zveřejněním nebo zničením. Mezi tato opatření patří: šifrování dat (SSL/TLS), provoz na zabezpečených serverech s pravidelnými audity, striktní řízení přístupu pomocí silných hesel, pravidelné zálohování dat a školení zaměstnanců v oblasti bezpečnosti dat.', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(31, 1, 8, '8. Změny těchto Zásad', 'Tyto Zásady můžeme čas od času aktualizovat. Jakékoli změny zveřejme na této stránce s uvedením data poslední aktualizace. Doporučujeme pravidelně kontrolovat tuto stránku, abyste byli informováni o tom, jak chráníme vaše údaje.', '2026-06-13 05:55:39', '2026-06-13 05:55:39'),
(32, 2, 1, '1. Úvodní ustanovení', 'Tyto obchodní podmínky (dále jen „OP“) společnosti RegioPartner, s.r.o., se sídlem Kytlická 862/6, 190 00 Praha, IČO: 25133161, DIČ: CZ25133161, zapsané v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 52029 (dále jen „Prodávající“), upravují v souladu s ustanovením § 1751 odst. 1 zákona č. 89/2012 Sb., občanský zákoník (dále jen „občanský zákoník“), vzájemná práva a povinnosti smluvních stran vzniklé v souvislosti nebo na základě kupní smlouvy uzavírané mezi Prodávajícím a jinou fyzickou či právnickou osobou (dále jen „Kupující“) prostřednictvím webového rozhraní Prodávajícího umístěného na internetové adrese www.rpsw.cz (dále jen „e-shop“). Ustanovení OP jsou nedílnou součástí kupní smlouvy. Odchylná ujednání v kupní smlouvě mají přednost před ustanoveními OP. Znění OP může Prodávající měnit či doplňovat. Nové znění OP nabývá účinnosti dnem jeho zveřejnění na webové stránce Prodávajícího.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(33, 2, 2, '2. Předmět smlouvy', 'Předmětem kupní smlouvy je prodej a poskytování digitálních produktů a služeb, které jsou specifikovány v nabídce na e-shopu Prodávajícího. Digitální produkty zahrnují, ale nejsou omezeny na: software, online kurzy, e-booky, grafické šablony, audio a video záznamy. Služby zahrnují například tvorbu a správu online reklamy.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(34, 2, 3, '3. Objednávka a uzavření kupní smlouvy', 'Veškerá prezentace zboží a služeb umístěná ve webovém rozhraní e-shopu je informativního charakteru a Prodávající není povinen uzavřít kupní smlouvu ohledně tohoto zboží a služeb. Ustanovení § 1732 odst. 2 občanského zákoníku se nepoužije. Pro objednání zboží (služeb) vyplní Kupující objednávkový formulář na webové stránce. Objednávkový formulář obsahuje zejména informace o: objednávaném zboží (službách) (Kupující vloží objednávané zboží do elektronického nákupního košíku webového rozhraní obchodu), způsobu úhrady kupní ceny zboží (služeb), údajích o požadovaném způsobu doručení objednávaného zboží, informacích o nákladech spojených s dodáním zboží (služeb). Odesláním objednávky Kupující potvrzuje, že se seznámil s těmito OP a souhlasí s nimi. Kupní smlouva je uzavřena doručením přijetí objednávky (akceptací) Prodávajícího Kupujícímu elektronickou poštou, a to na e-mailovou adresu Kupujícího uvedenou v objednávce.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(35, 2, 4, '4. Cena zboží a platební podmínky', 'Ceny zboží a služeb jsou uvedeny včetně DPH, pokud není výslovně uvedeno jinak. Společně s kupní cenou je Kupující povinen uhradit Prodávajícímu také náklady spojené s dodáním zboží (služeb) ve sjednané výši. Prodávající akceptuje následující způsoby platby: bankovním převodem na účet Prodávajícího, online platbou kartou prostřednictvím platební brány. V případě bezhotovostní platby je kupní cena splatná do 7 dnů od uzavření kupní smlouvy. Závazek Kupujícího uhradit kupní cenu je splněn okamžikem připsání příslušné částky na účet Prodávajícího.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(36, 2, 5, '5. Dodání digitálních produktů a služeb', 'Digitální produkty jsou dodány bez zbytečného odkladu po uhrazení ceny, zpravidla do 24 hodin, a to ve formě odkazu ke stažení, přístupu do členské sekce, nebo zasláním souborů na e-mail Kupujícího. V případě služeb je dodání stanoveno individuálně na základě dohody s Kupujícím. Náklady na dopravu zboží jsou uvedeny v objednávce a jsou součástí kupní ceny.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(37, 2, 6, '6. Odstoupení od smlouvy', 'Vzhledem k povaze digitálního obsahu, který není dodáván na hmotném nosiči, a s ohledem na ust. § 1837 písm. l) občanského zákoníku, nemá Kupující právo odstoupit od smlouvy, pokud mu byl obsah dodán s jeho předchozím výslovným souhlasem a před uplynutím lhůty pro odstoupení od smlouvy Kupující prohlásil, že byl poučen o tom, že dodáním digitálního obsahu zaniká jeho právo na odstoupení od smlouvy. Pokud se jedná o službu, Kupující spotřebitel má právo odstoupit od kupní smlouvy bez udání důvodu ve lhůtě 14 dnů od jejího uzavření, pokud poskytování služby již nezačalo. Oznámení o odstoupení od smlouvy musí být Prodávajícímu doručeno ve výše uvedené lhůtě.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(38, 2, 7, '7. Práva z vadného plnění (Reklamace)', 'Práva a povinnosti smluvních stran ohledně práv z vadného plnění se řídí příslušnými obecně závaznými právními předpisy (zejména ustanoveními § 1914 až 1925, § 2099 až 2117 a § 2161 až 2174 občanského zákoníku a zákonem č. 634/1992 Sb., o ochraně spotřebitele, ve znění pozdějších předpisů). Prodávající odpovídá Kupujícímu, že digitální produkt nebo služba při převzetí nemá vady. Zejména Prodávající odpovídá Kupujícímu, že v době, kdy Kupující produkt převzal, má vlastnosti, které si strany ujednaly, hodí se k účelu, který pro jeho použití Prodávající uvádí, a odpovídá požadavkům právních předpisů. Práva z vadného plnění uplatňuje Kupující u Prodávajícího elektronickou poštou na adrese: info@rpsw.cz.', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(39, 2, 8, '8. Ochrana osobních údajů', 'Prodávající se zavazuje chránit osobní údaje Kupujícího v souladu s platnými právními předpisy, zejména s nařízením GDPR (Nařízení Evropského parlamentu a Rady (EU) 2016/679 o ochraně fyzických osob v souvislosti se zpracováním osobních údajů). Podrobné informace o zpracování osobních údajů jsou k dispozici v samostatném dokumentu \"Zásady ochrany osobních údajů\", který je dostupný na webové stránce Prodávajícího. Odkaz:', '2026-06-13 05:58:39', '2026-06-13 05:58:39'),
(40, 2, 9, '9. Práva z vadného plnění a reklamační řád', 'Kupující je povinen při převzetí digitálního produktu či zahájení čerpání služby bez zbytečného odkladu ověřit jejich funkčnost a soulad s objednávkou. Pokud digitální produkt nebo služba vykazuje vady, jako je například nefunkční odkaz ke stažení, nesoulad se specifikací v objednávce či nedostupnost přístupu k členské sekci, má Kupující právo na reklamaci. Reklamaci je Kupující povinen uplatnit bez zbytečného odkladu poté, co vadu zjistí, a to elektronickou poštou na e-mailovou adresu info@rpsw.cz. Oznámení o reklamaci musí obsahovat identifikaci Kupujícího, tedy jméno a e-mail použitý při objednávce, číslo objednávky, detailní popis vady, případně vizuální dokumentaci vady, a požadovaný způsob vyřízení reklamace. Prodávající o reklamaci rozhodne ihned, ve složitých případech do tří pracovních dnů, přičemž do této lhůty se nezapočítává doba přiměřená podle druhu digitálního obsahu či služby potřebná k odbornému posouzení vady. Reklamace včetně odstranění vady bude vyřízena bez zbytečného odkladu, nejpozději do 30 dnů ode dne uplatnění reklamace, pokud se Prodávající s Kupujícím nedohodnou na delší lhůtě. Prodávající odpovídá Kupujícímu za to, že digitální produkt je při dodání bez vad a má vlastnosti, které byly ujednány nebo které lze vzhledem k povaze produktu očekávat. V případě, že vadu nelze odstranit, má Kupující právo na přiměřenou slevu z kupní ceny nebo na odstoupení od kupní smlouvy v souladu s příslušnými ustanoveními občanského zákoníku.', '2026-06-13 05:58:39', '2026-06-13 06:26:22'),
(41, 2, 10, '10. Závěrečná ustanovení', 'Je-li některé ustanovení OP neplatné nebo neúčinné, nebo se takovým stane, namísto neplatných ustanovení nastoupí ustanovení, jehož smysl se neplatnému ustanovení co nejvíce přibližuje. Tyto obchodní podmínky se řídí právním řádem České republiky. Veškeré spory vznikající z těchto OP nebo v souvislosti s nimi budou řešeny příslušnými soudy České republiky. V případě, že dojde mezi Prodávajícím a spotřebitelem ke vzniku spotřebitelského sporu z kupní smlouvy, který se nepodaří vyřešit vzájemnou dohodou, může spotřebitel podat návrh na mimosoudní řešení takového sporu určenému subjektu mimosoudního řešení spotřebitelských sporů, kterým je: Česká obchodní inspekce, Ústřední inspektorát – oddělení ADR, Štěpánská 44, 110 00 Praha 1, Web: www.coi.cz. Tyto obchodní podmínky nabývají účinnosti dnem 22. srpna 2025.', '2026-06-13 06:25:49', '2026-06-13 06:25:49');

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
(2, 'tos', 'Obchodní podmínky', '2026-06-12 19:15:23', '2026-06-13 05:35:46');

-- --------------------------------------------------------

--
-- Table structure for table `legal_site_settings`
--

CREATE TABLE `legal_site_settings` (
  `id` int(11) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `ico` varchar(20) NOT NULL,
  `dic` varchar(20) DEFAULT NULL,
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

INSERT INTO `legal_site_settings` (`id`, `company_name`, `ico`, `dic`, `contact_email`, `contact_phone`, `address`, `footer_text`, `logo_path`, `updated_at`) VALUES
(1, 'Joncletika, s.r.o.', '25133161', 'CZ25133161', 'gamber@rpsw.cz', '733 188 328', 'Kytlická 862/6, 190 00 Praha', '©2026 RegioPartner, s.r.o., Všechna práva vyhrazena.', 'site-logos/dJxyZbRjvhFROyCtxEyx5JdTY2AwVZBrl2vuAt0X.png', '2026-06-14 20:59:36');

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
(12, '2025_07_10_075603_create_raw_request_commissions_table', 4);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
(79, 'App\\Models\\User', 34, 'access-token', '46ffc555bdaa30fe9c7baf1ff082fbc0a7e78cf5bdf4a8a08580f153eab32b51', '[\"*\"]', '2026-02-15 22:39:32', '2026-02-15 23:09:32', '2026-02-15 22:39:32', '2026-02-15 22:39:32'),
(81, 'App\\Models\\User', 34, 'access-token', 'b68364618e440f61d911b78ad90ca53d74ec497c10d71d743a4e4eb20081c2d7', '[\"*\"]', '2026-02-15 22:39:56', '2026-02-15 23:09:56', '2026-02-15 22:39:56', '2026-02-15 22:39:56'),
(87, 'App\\Models\\User', 59, 'access-token', 'c58f7b40a4862562dc033216ec4ba476336d5cc77af42b57e8a6721e0c735545', '[\"*\"]', '2026-02-15 22:41:38', '2026-02-15 23:11:38', '2026-02-15 22:41:38', '2026-02-15 22:41:38'),
(134, 'App\\Models\\User', 62, 'access-token', '696da6ddfce759f43fcd6c430016ffff654238b4bd746c50642599a4b68a1cd7', '[\"*\"]', '2026-02-18 02:12:13', '2026-02-18 03:12:09', '2026-02-18 02:12:09', '2026-02-18 02:12:13'),
(172, 'App\\Models\\User', 77, 'access-token', 'f783051fdb88711a863e9ccd4e5176a5a3f2a3606204c816754c3227d07698f8', '[\"*\"]', '2026-02-25 00:08:53', '2026-02-25 00:42:29', '2026-02-24 23:42:29', '2026-02-25 00:08:53'),
(437, 'App\\Models\\User', 25, 'access-token', '9919045de5fb57a1dd65bcd934c97153d4b5d5deafd29e8e2cb41a280514d68b', '[\"*\"]', '2026-06-14 21:06:06', '2026-06-14 21:29:53', '2026-06-14 20:29:53', '2026-06-14 21:06:06');

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
(436, 25, 'e768c01a729b4f152cd3a8648288e830267eb2a8db647af16494b979f10c263e', '2026-06-21 20:29:53', '2026-06-14 20:29:53', '2026-06-14 20:29:53');

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

--
-- Dumping data for table `shop_categories`
--

INSERT INTO `shop_categories` (`id`, `name`, `slug`, `description`, `parent_id`, `image_path`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(53, 'kat_1', 'kat-1', NULL, NULL, NULL, 1, 0, '2026-06-05 21:39:57', '2026-06-07 10:49:38');

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

--
-- Dumping data for table `shop_customers`
--

INSERT INTO `shop_customers` (`id`, `user_id`, `email`, `first_name`, `last_name`, `phone`, `company`, `address`, `city`, `postal_code`, `country`, `is_active`, `total_spent`, `notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(7, NULL, 'jonas.bucina@seznam.cz', 'Jonas', 'Fonas', '676767676', NULL, 'aksjdlaskd 7677', 'Praha', '19000', 'Česká republika', 1, 0.00, NULL, '2026-06-12 16:54:34', '2026-06-12 16:54:34', NULL),
(8, NULL, 'joner.foner@gamba.czs', 'Lindicka', 'Trybickoa', '123456789', NULL, 'Kittiovksa 777', 'Mazlickov', '777777', 'Česká republika', 1, 0.00, NULL, '2026-06-12 16:55:29', '2026-06-14 11:13:33', NULL),
(9, NULL, 'asda@sd.cz', 'JONERFONRE', 'sdfds', '878787878', NULL, 'sdf', 'dfgfdg', '19099', 'Czechia', 1, 109.00, NULL, '2026-06-14 12:37:23', '2026-06-14 12:37:53', NULL);

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

--
-- Dumping data for table `shop_orders`
--

INSERT INTO `shop_orders` (`id`, `customer_id`, `order_number`, `status`, `payment_status`, `total_amount`, `shipping_amount`, `tax_amount`, `discount_amount`, `final_amount`, `coupon_id`, `payment_method_id`, `shipping_method_id`, `shipping_address`, `shipping_city`, `shipping_postal_code`, `shipping_country`, `notes`, `paid_at`, `shipped_at`, `delivered_at`, `created_at`, `updated_at`, `deleted_at`) VALUES
(39, 9, '2026060001', 'shipped', 'paid', 109.00, 120.00, 18.92, 0.00, 229.00, NULL, 3, 2, 'sdf', 'dfgfdg', '19099', 'Czechia', NULL, NULL, NULL, NULL, '2026-06-14 12:37:23', '2026-06-14 12:37:53', NULL);

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

--
-- Dumping data for table `shop_order_items`
--

INSERT INTO `shop_order_items` (`id`, `order_id`, `product_id`, `product_variant_id`, `product_name`, `variant_name`, `quantity`, `unit_price`, `total_price`, `discount_amount`, `created_at`, `updated_at`) VALUES
(33, 39, 26, 38, 'test', 'test', 1, 109.00, 109.00, 0.00, '2026-06-14 12:37:23', '2026-06-14 12:37:23');

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
(4, 'apple_pay', 'Apple Pay', 'payment-methods-images/apple-pay.png', 'Rychlá platba pomocí Apple Wallet pro zařízení Apple (iPhone, iPad, Mac).', 0.00, 'stripe', 1, NULL, NULL, NULL, NULL, 'none', '{\"public_key\": \"\", \"secret_key\": \"\", \"webhook_secret\": \"\"}', 1, 4, '2026-06-01 17:17:01', '2026-06-01 20:19:04', NULL),
(5, 'paypal', 'PayPal', 'payment-methods-images/paypal.png', 'Platba přes celosvětový platební systém PayPal (účet nebo rychlá platba kartou).', 0.00, 'paypal', 1, NULL, NULL, NULL, NULL, 'none', '{\"client_id\": \"\", \"secret_key\": \"\", \"mode\": \"sandbox\"}', 1, 6, '2026-06-01 17:17:01', '2026-06-01 20:18:43', NULL),
(6, 'cash_on_delivery', 'Platba při převzetí (Dobírka)', 'payment-methods-images/cash-on-delivery.png', 'Zaplatíte hotově nebo kartou kurýrovi při převzetí zásilky na vaší adrese.', 49.00, 'manual', 0, NULL, NULL, NULL, NULL, 'none', '{}', 0, 7, '2026-06-01 17:17:01', '2026-06-01 20:17:49', NULL),
(7, 'cash', 'Hotovost při osobním odběru', 'payment-methods-images/cash.png', 'Platba v hotovosti na naší pobočce při vyzvednutí zboží.', 0.00, 'manual', 0, NULL, NULL, NULL, NULL, 'none', '{}', 0, 8, '2026-06-01 17:17:01', '2026-06-01 20:17:29', NULL),
(8, 'google_pay', 'Google Pay', 'payment-methods-images/google-pay.png', 'Okamžitá platba pomocí Google peněženky pro Android zařízení a prohlížeč Chrome.', 0.00, 'stripe', 1, NULL, NULL, NULL, NULL, 'none', '{\"public_key\": \"\", \"secret_key\": \"\", \"webhook_secret\": \"\"}', 1, 5, '2026-06-01 17:17:01', '2026-06-01 20:16:49', NULL);

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

--
-- Dumping data for table `shop_products`
--

INSERT INTO `shop_products` (`id`, `category_id`, `supplier_id`, `name`, `name_en`, `slug`, `description`, `description_en`, `short_description`, `short_description_en`, `sku`, `stock_quantity`, `stock_warning_level`, `is_active`, `is_featured`, `created_at`, `updated_at`, `deleted_at`) VALUES
(26, 53, NULL, 'test', NULL, 'jonas', NULL, NULL, NULL, NULL, 'foner', 11, 10, 1, 0, '2026-06-14 12:01:42', '2026-06-14 12:37:23', NULL);

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

--
-- Dumping data for table `shop_product_categories`
--

INSERT INTO `shop_product_categories` (`id`, `product_id`, `category_id`, `is_primary`, `sort_order`, `created_at`, `updated_at`) VALUES
(37, 26, 53, 1, 0, '2026-06-14 12:01:42', '2026-06-14 12:02:06');

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

--
-- Dumping data for table `shop_product_prices`
--

INSERT INTO `shop_product_prices` (`id`, `product_id`, `variant_id`, `vat_rate`, `price_eur_without_vat`, `cost_price_eur`, `price_eur_with_vat`, `created_at`, `updated_at`) VALUES
(27, 26, NULL, 21.00, 90.08, 100.0000, 109.00, '2026-06-14 12:01:42', '2026-06-14 12:01:42'),
(28, 26, 38, 21.00, 90.08, 0.0000, 109.00, '2026-06-14 12:02:06', '2026-06-14 12:02:06');

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

--
-- Dumping data for table `shop_product_variants`
--

INSERT INTO `shop_product_variants` (`id`, `product_id`, `variant_name`, `attribute_1_name`, `attribute_1_value`, `attribute_2_name`, `attribute_2_value`, `sku_variant`, `stock_quantity`, `created_at`, `updated_at`, `deleted_at`) VALUES
(38, 26, 'test', 'sdf', 'sdf', 'dsf', 'sdf', 'sdf', 11, '2026-06-14 12:02:06', '2026-06-14 12:37:23', NULL);

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
  `contact_email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) NOT NULL,
  `birth_date` date DEFAULT NULL,
  `personal_id_num` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `bank_account` varchar(50) DEFAULT NULL,
  `health_insurance` varchar(10) DEFAULT NULL,
  `commission_rate` int(3) DEFAULT 10,
  `dpp_hours_spent` int(5) NOT NULL DEFAULT 0,
  `has_tax_declaration` tinyint(1) NOT NULL DEFAULT 0,
  `phone_number` varchar(20) DEFAULT NULL,
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

INSERT INTO `users` (`id`, `user_email`, `contact_email`, `full_name`, `birth_date`, `personal_id_num`, `address`, `bank_account`, `health_insurance`, `commission_rate`, `dpp_hours_spent`, `has_tax_declaration`, `phone_number`, `internal_note`, `user_password_hash`, `user_password_salt`, `last_login_at`, `created_at`, `updated_at`, `deleted_at`, `is_deleted`) VALUES
(25, 'joncl', 'jonasbucina@rpsw.cz', 'Jonáš Bučina', NULL, NULL, NULL, NULL, NULL, 10, 0, 0, '733 188 328', NULL, '$2y$12$rV1ILe7YeW1L1XfWb5DrfuiCYTC.1FZsIU4wtNmA95GaUNwXAtYoa', NULL, '2026-06-14 12:08:43', '2026-02-14 08:12:31', '2026-06-14 12:08:43', NULL, 0),
(30, 'prime_admin', NULL, 'Prime Admin', NULL, NULL, NULL, NULL, NULL, 10, 0, 0, NULL, NULL, '$2y$12$NEiDrqVCChulf9S/EUPIpeOHScIM0zwswPTxIFamRDrY4XajgHQOe', NULL, NULL, '2026-02-14 08:12:31', '2026-02-14 08:12:31', NULL, 0),
(34, 'lindicka', 'lindicka@mazliva.cz', 'Lindička Trýbíčková Mazliva', NULL, NULL, NULL, NULL, NULL, 10, 0, 0, NULL, NULL, '$2y$12$xbMrIDwkEj.ZOnsLe7Glr..2qbca1i7XnSclNnGILENFKlL.Kw9.W', NULL, '2026-02-15 23:39:56', '2026-02-14 08:12:31', '2026-02-20 23:59:34', NULL, 0);

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
(30, 3),
(34, 5);

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
  `message` varchar(255) NOT NULL,
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

-- --------------------------------------------------------

--
-- Table structure for table `web_sales_leads`
--

CREATE TABLE `web_sales_leads` (
  `id` int(10) UNSIGNED NOT NULL,
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

-- --------------------------------------------------------

--
-- Table structure for table `web_system_logs`
--

CREATE TABLE `web_system_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `origin` varchar(255) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `module` varchar(100) NOT NULL,
  `description` varchar(1000) NOT NULL,
  `context_data` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

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
  ADD PRIMARY KEY (`email`);

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
-- Indexes for table `web_system_logs`
--
ALTER TABLE `web_system_logs`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `core_permissions`
--
ALTER TABLE `core_permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `core_roles`
--
ALTER TABLE `core_roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `core_site_settings`
--
ALTER TABLE `core_site_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `document_sections`
--
ALTER TABLE `document_sections`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `document_types`
--
ALTER TABLE `document_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `legal_site_settings`
--
ALTER TABLE `legal_site_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `legal_social_links`
--
ALTER TABLE `legal_social_links`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=438;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=437;

--
-- AUTO_INCREMENT for table `shop_categories`
--
ALTER TABLE `shop_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=58;

--
-- AUTO_INCREMENT for table `shop_coupons`
--
ALTER TABLE `shop_coupons`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `shop_customers`
--
ALTER TABLE `shop_customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `shop_logs`
--
ALTER TABLE `shop_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shop_orders`
--
ALTER TABLE `shop_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `shop_order_items`
--
ALTER TABLE `shop_order_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `shop_payment_methods`
--
ALTER TABLE `shop_payment_methods`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `shop_products`
--
ALTER TABLE `shop_products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `shop_product_categories`
--
ALTER TABLE `shop_product_categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `shop_product_images`
--
ALTER TABLE `shop_product_images`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `shop_product_prices`
--
ALTER TABLE `shop_product_prices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `shop_product_variants`
--
ALTER TABLE `shop_product_variants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

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
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=85;

--
-- AUTO_INCREMENT for table `web_job_applications`
--
ALTER TABLE `web_job_applications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `web_logs`
--
ALTER TABLE `web_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `web_news`
--
ALTER TABLE `web_news`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `web_raw_request_commissions`
--
ALTER TABLE `web_raw_request_commissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `web_sales_leads`
--
ALTER TABLE `web_sales_leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `web_sales_orders`
--
ALTER TABLE `web_sales_orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `web_support_tickets`
--
ALTER TABLE `web_support_tickets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `web_system_logs`
--
ALTER TABLE `web_system_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

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
