/**
 * @file kb-pages.data.ts
 * @path src/app/admin/intranet/knowledge-base/data/kb-pages.data.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description STATICKÝ obsah celého interního manuálu (Knowledge Base). Editace
 * manuálu = editace tohoto pole v kódu - viz kb-content.ts pro vysvětlení architektury.
 *
 * @editing-guide Jak přidat novou stránku manuálu:
 * 1) Přidej nový objekt do `KB_PAGES` pole níže, `id` musí být unikátní kebab-case slug.
 *    Pozor na kolize napříč moduly (např. web/core/shop mají každý vlastní "dashboard" a
 *    "logs" route) - proto jsou tyto stránky prefixované (`web-dashboard`,
 *    `core-dashboard`, `shop-dashboard`, `web-business-logs`, `core-logs`, `shop-logs`).
 * 2) `navGroup`/`navOrder` určují, kde se stránka objeví v bočním menu - žádná úprava
 *    knowledge-base.component.html není potřeba, menu se generuje z tohoto pole
 *    automaticky (viz KnowledgeBaseComponent.navGroups getter).
 * 3) Pokud stránka dokumentuje funkci vázanou na konkrétní permission/roli, popiš to do
 *    `devNote` (viditelné jen v kódu) - permission klíče odpovídají 1:1 hodnotám
 *    `data: { permission: '...' }` v admin-routing.module.ts.
 * 4) Obrázky (KBImageBlock.path) patří do `src/assets/kb/<page-id>/...`.
 *
 * @note `support-form` a `news` NEJSOU v tomhle poli - obě zůstávají vlastní
 * komponenty/routy (mají skutečnou logiku, ne statický text) - viz admin-routing.module.ts.
 *
 * @status VÝCHOZÍ STAV: každá stránka níže má zatím jen placeholder `lead` popis (1-2
 * věty) + `devNote` s technickým kontextem (komponenta, permission). Detailní obsah
 * (kroky, screenshoty, upozornění) se doplní postupně - tohle je jen kostra pokrývající
 * VŠECHNY route z admin-routing.module.ts, ať v manuálu od začátku nechybí žádná stránka.
 */

import { KBPage } from "../../../../shared/interfaces/kb-content";
export const KB_PAGES: KBPage[] = [

  // ── General ──────────────────────────────────────────────────────────────

  {
    id: 'introductions',
    navGroup: 'General',
    navLabel: 'Introductions',
    navOrder: 1,
    breadcrumb: 'Interní manuál / Úvod / Vítejte v RPSW',
    header: 'Vítejte u zrodu RPSoftware',
    sections: [
      {
        blocks: [
          { type: 'lead', content: 'Jsme technologické křídlo zavedené společnosti RegioPartner, s.r.o. Zatímco naše mateřská firma udává směr v regionálním rozvoji a evaluacích, my v RPSW stavíme digitální budoucnost pro malé a střední projekty.' }
        ]
      },
      {
        heading: '01. Naše identita a vize',
        blocks: [
          { type: 'text', content: 'RPSW (RPSoftware) vzniklo jako potřeba propojit expertní znalosti z businessu s moderními technologiemi. Nejsme korporát – jsme agilní tým, který právě teď definuje své procesy, hledá ty nejlepší cesty k zakázkám a buduje si své jméno na trhu.' },
          { type: 'alert', variant: 'info', content: 'Jsi u samotného zrodu: Momentálně nefungujeme v režimu 24/7 full-time, ale jsme ve fázi aktivního rozjezdu. Každá splněná zakázka a každý nový lead nás posouvá blíž k velkému cíli.' }
        ]
      },
      {
        heading: '02. Systém "In-House" – Stavíme si vlastní nástroje',
        blocks: [
          { type: 'text', content: 'Věříme v to, co prodáváme. Proto i tento evidenční systém, webové stránky a celá tato Knowledge Base nejsou koupené šablony, ale custom řešení vyvinuté přímo námi.' },
          { type: 'text', content: 'Tento systém je ve fázi aktivního vývoje. Čas od času může dojít ke změnám funkcí nebo vzhledu. O všech podstatných novinkách se dozvíte v sekci Novinky. Systém může obsahovat bugy – prosím nahlašte veškeré závady přes support formulář. Každé zneužití zranitelnosti systému se trestá.' },
          {
            type: 'grid',
            cards: [
              { title: 'Systém ve vývoji', text: 'Vše je plně funkční, ale neustále ladíme detaily. Pokud narazíš na chybu nebo tě napadne vylepšení, využij náš support formulář.' },
              { title: 'Informovanost', text: 'O každé změně v postupech nebo updatech systému tě budeme informovat v sekci Novinky nebo na Discordu.' }
            ]
          }
        ]
      },
      {
        heading: '03. Komunikace a zpětná vazba',
        blocks: [
          { type: 'text', content: 'Otevřenost je pro nás klíčová. Protože teprve hledáme tu nejefektivnější cestu, potřebujeme slyšet tvůj názor. Jakýkoliv poznatek z praxe (od klientů, z ovládání systému nebo z procesů) s námi sdílej.' },
          {
            type: 'flow',
            steps: [
              { label: 'Discord (Hlavní kanál)', text: 'Místo pro real-time diskuzi, rychlé dotazy a operativní řešení témat napříč týmem.', active: true },
              { label: 'Novinky v KB', text: 'Zde najdeš oficiální ChangeLog a soupis změn v procesech či aplikaci.' },
              { label: 'E-mail / Feedback', text: 'Pro hlubší podněty nebo oficiální záležitosti jsme k dispozici na mailu.' }
            ]
          }
        ]
      },
      {
        blocks: [
          { type: 'note', highlight: true, content: 'Slovo závěrem: Vážíme si toho, že do toho jdeš s námi. RPSW není jen o kódu a obchodu, je o lidech, kteří chtějí něco vybudovat od nuly. Pojďme společně vytvořit něco, co bude dávat smysl.' }
        ]
      }
    ]
  },
  {
    id: 'security',
    navGroup: 'General',
    navLabel: 'Přístup',
    navOrder: 3,
    breadcrumb: 'Interní manuál / Přístup',
    header: 'Přístupové údaje a bezpečnost',
    devNote: 'Popisuje obecná bezpečnostní pravidla (2FA, hesla) - viz PersonalInfoComponent a User::FORCED_2FA_ROLE_NAMES pro skutečnou implementaci vynucení.',
    sections: [
      {
        blocks: [
          { type: 'lead', content: 'Testovací obsah - sem patří vysvětlení přihlašování, 2FA a politiky hesel.' }
        ]
      }
    ]
  },
  {
    id: 'contacts',
    navGroup: 'General',
    navLabel: 'Kontakty',
    navOrder: 4,
    breadcrumb: 'Interní manuál / Kontakty',
    header: 'Kontakty na tým',
    sections: [
      {
        blocks: [
          { type: 'lead', content: 'Testovací obsah - sem patří seznam kontaktů na klíčové lidi v týmu.' }
        ]
      }
    ]
  },

  // ── Roles ────────────────────────────────────────────────────────────────

  {
    id: 'sales-rep',
    navGroup: 'Roles',
    navLabel: 'Sales Rep',
    navOrder: 5,
    breadcrumb: 'Interní manuál / Role / Sales Rep',
    header: 'Role: Obchodní zástupce',
    sections: [
      {
        blocks: [
          { type: 'lead', content: 'Testovací obsah - sem patří popis náplně role obchodního zástupce v systému (Sales Leads, Sales Orders).' }
        ]
      }
    ]
  },

  // ── Web (odpovídá routám 'web/*' v admin-routing.module.ts) ─────────────

  {
    id: 'web-dashboard',
    navGroup: 'Web',
    navLabel: 'Dashboard',
    navOrder: 10,
    breadcrumb: 'Interní manuál / Web / Dashboard',
    header: 'Web - Dashboard',
    devNote: "DashboardComponent (web-pages), route 'web/dashboard', permission 'web-view-dashboard'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - přehledová stránka webového modulu administrace.' } ] } ]
  },
  {
    id: 'user-request',
    navGroup: 'Web',
    navLabel: 'Webový formulář',
    navOrder: 11,
    breadcrumb: 'Interní manuál / Web / Webový formulář',
    header: 'Webový formulář (poptávky)',
    devNote: "UserRequestComponent, route 'web/user-request', permission 'web-user-requests-view' (edit/delete vyžadují navíc -update/-delete).",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa poptávek odeslaných z veřejného webového formuláře.' } ] } ]
  },
  {
    id: 'web-business-logs',
    navGroup: 'Web',
    navLabel: 'Business logy',
    navOrder: 12,
    breadcrumb: 'Interní manuál / Web / Business logy',
    header: 'Web - Business logy',
    devNote: "BusinessLogsComponent, route 'web/business-logs', permission 'web-view-web-logs'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - auditní log akcí provedených ve webovém modulu.' } ] } ]
  },
  {
    id: 'sales-leads',
    navGroup: 'Web',
    navLabel: 'Obchodní leady',
    navOrder: 13,
    breadcrumb: 'Interní manuál / Web / Obchodní leady',
    header: 'Obchodní leady',
    devNote: "SalesLeadsComponent, route 'web/sales-leads', permission 'web-sales-leads-view'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - evidence a generování odkazů pro obchodní leady.' } ] } ]
  },
  {
    id: 'edit-news',
    navGroup: 'Web',
    navLabel: 'Novinky (web)',
    navOrder: 14,
    breadcrumb: 'Interní manuál / Web / Novinky (web)',
    header: 'Správa novinek na webu',
    devNote: "EditNewsComponent, route 'web/edit-news', permission 'web-news-view'. Nezaměňovat s KB sekcí 'Novinky' (interní ChangeLog) - tohle je editace novinek zobrazovaných na veřejném webu.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - editace novinek zobrazovaných na veřejném webu.' } ] } ]
  },
  {
    id: 'edit-website',
    navGroup: 'Web',
    navLabel: 'Editace webu',
    navOrder: 15,
    breadcrumb: 'Interní manuál / Web / Editace webu',
    header: 'Editace obsahu webu',
    devNote: "EditWebsiteComponent, route 'web/edit-website', permission 'web-view-edit-website'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - editace obsahových částí veřejného webu.' } ] } ]
  },
  {
    id: 'sales-orders',
    navGroup: 'Web',
    navLabel: 'Přijaté objednávky',
    navOrder: 16,
    breadcrumb: 'Interní manuál / Web / Přijaté objednávky',
    header: 'Přijaté objednávky (realizace)',
    devNote: "SalesOrdersComponent, route 'web/sales-orders', permission 'web-sales-orders-view'. Řádková akce 'Projekt' zakládá navazující záznam v Projects.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - přehled přijatých objednávek/realizací a jejich zpracování.' } ] } ]
  },
  {
    id: 'support-tickets',
    navGroup: 'Web',
    navLabel: 'Helpdesk tickety',
    navOrder: 17,
    breadcrumb: 'Interní manuál / Web / Helpdesk tickety',
    header: 'Helpdesk tickety',
    devNote: "SupportTicketsComponent, route 'web/support-tickets', permission 'web-support-tickets-view'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa helpdesk ticketů přijatých od uživatelů.' } ] } ]
  },
  {
    id: 'job-applications',
    navGroup: 'Web',
    navLabel: 'Pracovní nabídky',
    navOrder: 18,
    breadcrumb: 'Interní manuál / Web / Pracovní nabídky',
    header: 'Pracovní formulář (uchazeči)',
    devNote: "JobApplicationsComponent, route 'web/job-applications', permission 'web-job-applications-view'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - přehled odeslaných žádostí z pracovního formuláře.' } ] } ]
  },
  {
    id: 'projects',
    navGroup: 'Web',
    navLabel: 'Projekty',
    navOrder: 19,
    breadcrumb: 'Interní manuál / Web / Projekty',
    header: 'Projekty a zákaznická vlákna',
    devNote: "ProjectsComponent, route 'web/projects', permission 'web-projects-view'. Obsahuje i cross-project tabulku zákaznických vláken (web/project-threads).",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa zákaznických projektů, checkpointů a komunikace.' } ] } ]
  },

  // ── Core (odpovídá routám 'core/*' v admin-routing.module.ts) ────────────

  {
    id: 'core-dashboard',
    navGroup: 'Core',
    navLabel: 'Dashboard',
    navOrder: 20,
    breadcrumb: 'Interní manuál / Core / Dashboard',
    header: 'Core - Dashboard',
    devNote: "CoreDashboardComponent, route 'core/dashboard', permission 'view-core'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - přehledová stránka systémového (core) modulu.' } ] } ]
  },
  {
    id: 'welcome-page',
    navGroup: 'Core',
    navLabel: 'Uvítací stránka',
    navOrder: 21,
    breadcrumb: 'Interní manuál / Core / Uvítací stránka',
    header: 'Uvítací stránka',
    devNote: "WelcomePageComponent, route 'core/welcome-page' (výchozí route pod core/), permission 'core-view-welcome-page'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - úvodní stránka po přihlášení do administrace.' } ] } ]
  },
  {
    id: 'edit-legal',
    navGroup: 'Core',
    navLabel: 'Právní dokumenty',
    navOrder: 22,
    breadcrumb: 'Interní manuál / Core / Právní dokumenty',
    header: 'Editace právních dokumentů (GDPR, TOS...)',
    devNote: "EditLegalComponent, route 'core/edit-legal', permission 'core-legal-documents-view|core-legal-config-view'. Vícejazyčný obsah, typy dokumentů se načítají dynamicky z legal/document-types.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - editace vícejazyčného obsahu právních dokumentů (GDPR, obchodní podmínky, cookies).' } ] } ]
  },
  {
    id: 'personal-info',
    navGroup: 'Core',
    navLabel: 'Osobní údaje',
    navOrder: 23,
    breadcrumb: 'Interní manuál / Core / Osobní údaje',
    header: 'Osobní údaje a zabezpečení účtu',
    devNote: "PersonalInfoComponent, route 'core/personal-info', permission 'web-view-personal-info'. Self-service 2FA toggle a změna hesla.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa vlastního profilu, hesla a dvoufaktorového ověření.' } ] } ]
  },
  {
    id: 'web-settings',
    navGroup: 'Core',
    navLabel: 'Nastavení webu',
    navOrder: 24,
    breadcrumb: 'Interní manuál / Core / Nastavení webu',
    header: 'Globální nastavení webu',
    devNote: "WebSettingsComponent, route 'core/web-settings', permission 'core-legal-config-view'. Firemní údaje, logo, sociální sítě.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - firemní údaje, logo a sociální sítě zobrazované na webu.' } ] } ]
  },
  {
    id: 'external-links',
    navGroup: 'Core',
    navLabel: 'Externí odkazy',
    navOrder: 25,
    breadcrumb: 'Interní manuál / Core / Externí odkazy',
    header: 'Externí odkazy (rychlé odkazy adminu)',
    devNote: "ExternalLinksComponent + CoreExternalLinkController, route 'core/external-links', permission 'core-external-links-view' (create/update/delete zvlášť). Odkazy jsou SOUKROMÉ per-uživatel (scoped na user_id na backendu).",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - osobní seznam rychlých odkazů na externí nástroje, viditelný jen tobě.' } ] } ]
  },
  {
    id: 'edit-roles',
    navGroup: 'Core',
    navLabel: 'Role a oprávnění',
    navOrder: 26,
    breadcrumb: 'Interní manuál / Core / Role a oprávnění',
    header: 'Správa rolí a oprávnění',
    devNote: "EditRolesComponent, route 'core/edit-roles'. Přístup NEZÁVISLE na permission systému natvrdo omezen na roli 'sysadmin' (sysadminGuard) - nemá klasický permission klíč.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa rolí a jejich oprávnění. Přístupné výhradně sysadminovi.' } ] } ]
  },
  {
    id: 'administrators',
    navGroup: 'Core',
    navLabel: 'Administrátoři',
    navOrder: 27,
    breadcrumb: 'Interní manuál / Core / Administrátoři',
    header: 'Správa uživatelských účtů',
    devNote: "AdministratorsComponent, route 'core/administrators', permission 'core-administrators-view'. Řeší i 2FA vynucení, blokaci účtů a e-mailovou doménovou politiku (jen sysadmin).",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa administrátorských účtů, rolí, 2FA a blokací.' } ] } ]
  },
  {
    id: 'core-logs',
    navGroup: 'Core',
    navLabel: 'Systémové logy',
    navOrder: 28,
    breadcrumb: 'Interní manuál / Core / Systémové logy',
    header: 'Core - Systémové logy',
    devNote: "CoreLogsComponent, route 'core/logs', permission 'view-core'. Poznámka v routing komentáři: dočasně čte ze stejného zdroje jako web/business-logs.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - přehled systémových auditních logů.' } ] } ]
  },
  {
    id: 'security-events',
    navGroup: 'Core',
    navLabel: 'Bezpečnostní monitoring',
    navOrder: 29,
    breadcrumb: 'Interní manuál / Core / Bezpečnostní monitoring',
    header: 'Bezpečnostní monitoring',
    devNote: "SecurityEventsComponent, route 'core/security-events', permission 'core-security-view'. Triage podezřelých eventů, retenční politika (GDPR), ruční purge.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - monitoring podezřelé aktivity, triage eventů a nastavení retenční doby.' } ] } ]
  },

  // ── Shop (odpovídá routám 'shop/*' v admin-routing.module.ts) ────────────

  {
    id: 'shop-dashboard',
    navGroup: 'Shop',
    navLabel: 'Dashboard',
    navOrder: 30,
    breadcrumb: 'Interní manuál / Shop / Dashboard',
    header: 'Shop - Dashboard',
    devNote: "ShopDashboardComponent, route 'shop/dashboard', permission 'shop-view-dashboard'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - přehledová stránka e-shop modulu administrace.' } ] } ]
  },
  {
    id: 'shop-products',
    navGroup: 'Shop',
    navLabel: 'Produkty',
    navOrder: 31,
    breadcrumb: 'Interní manuál / Shop / Produkty',
    header: 'Správa produktů',
    devNote: "ProductsComponent, route 'shop/products', permission 'shop-manage-products'. Zahrnuje varianty a obrázky produktu (samostatné modaly).",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa produktového katalogu, variant a obrázků.' } ] } ]
  },
  {
    id: 'shop-categories',
    navGroup: 'Shop',
    navLabel: 'Kategorie',
    navOrder: 32,
    breadcrumb: 'Interní manuál / Shop / Kategorie',
    header: 'Správa kategorií',
    devNote: "CategoriesComponent, route 'shop/categories', permission 'shop-manage-categories'. Stromová struktura kategorií + přiřazování produktů.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - hierarchická správa kategorií produktů.' } ] } ]
  },
  {
    id: 'shop-orders',
    navGroup: 'Shop',
    navLabel: 'Objednávky',
    navOrder: 33,
    breadcrumb: 'Interní manuál / Shop / Objednávky',
    header: 'Správa objednávek',
    devNote: "OrdersComponent, route 'shop/orders', permission 'shop-view-orders'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa e-shopových objednávek, stavů a plateb.' } ] } ]
  },
  {
    id: 'shop-customers',
    navGroup: 'Shop',
    navLabel: 'Zákazníci',
    navOrder: 34,
    breadcrumb: 'Interní manuál / Shop / Zákazníci',
    header: 'Správa zákazníků',
    devNote: "CustomersComponent, route 'shop/customers', permission 'shop-manage-customers'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa zákaznických účtů a jejich historie objednávek.' } ] } ]
  },
  {
    id: 'shop-shipping-methods',
    navGroup: 'Shop',
    navLabel: 'Způsoby dopravy',
    navOrder: 35,
    breadcrumb: 'Interní manuál / Shop / Způsoby dopravy',
    header: 'Způsoby dopravy',
    devNote: "ShippingMethodsComponent, route 'shop/shipping-methods', permission 'shop-manage-shipping-methods'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa dostupných způsobů dopravy.' } ] } ]
  },
  {
    id: 'shop-payment-methods',
    navGroup: 'Shop',
    navLabel: 'Platební metody',
    navOrder: 36,
    breadcrumb: 'Interní manuál / Shop / Platební metody',
    header: 'Platební metody',
    devNote: "PaymentMethodsComponent, route 'shop/payment-methods', permission 'shop-manage-payment-methods'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa dostupných platebních metod.' } ] } ]
  },
  {
    id: 'shop-suppliers',
    navGroup: 'Shop',
    navLabel: 'Dodavatelé',
    navOrder: 37,
    breadcrumb: 'Interní manuál / Shop / Dodavatelé',
    header: 'Správa dodavatelů',
    devNote: "SuppliersComponent, route 'shop/suppliers', permission 'shop-manage-suppliers'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - evidence dodavatelů produktů.' } ] } ]
  },
  {
    id: 'coupons',
    navGroup: 'Shop',
    navLabel: 'Slevové kupóny',
    navOrder: 38,
    breadcrumb: 'Interní manuál / Shop / Slevové kupóny',
    header: 'Slevové kupóny',
    devNote: "CouponsComponent, route 'shop/coupons', permission 'shop-view-reports'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - správa slevových kupónů a jejich podmínek.' } ] } ]
  },
  {
    id: 'shop-logs',
    navGroup: 'Shop',
    navLabel: 'Logy',
    navOrder: 39,
    breadcrumb: 'Interní manuál / Shop / Logy',
    header: 'Shop - Logy',
    devNote: "ShopLogsComponent, route 'shop/logs', permission 'shop-view-logs'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - auditní log akcí provedených v e-shop modulu.' } ] } ]
  },
  {
    id: 'edit-eshop',
    navGroup: 'Shop',
    navLabel: 'Nastavení e-shopu',
    navOrder: 40,
    breadcrumb: 'Interní manuál / Shop / Nastavení e-shopu',
    header: 'Globální nastavení e-shopu',
    devNote: "EditEshopComponent, route 'shop/edit-eshop', permission 'shop-view-edit-eshop'.",
    sections: [ { blocks: [ { type: 'lead', content: 'Testovací obsah - globální nastavení e-shopu.' } ] } ]
  },

  // ── Support ──────────────────────────────────────────────────────────────
  // support-form (vlastní komponenta) a news (vlastní komponenta) NEJSOU v tomhle
  // poli - viz admin-routing.module.ts, obě mají vlastní explicitní route.
];