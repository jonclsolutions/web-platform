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
 *    automaticky (viz KnowledgeBaseComponent.buildNavGroups()).
 * 3) Pokud stránka dokumentuje funkci vázanou na konkrétní permission/roli, popiš to do
 *    `devNote` (viditelné jen v kódu, NEPŘEKLÁDÁ SE) - permission klíče odpovídají 1:1
 *    hodnotám `data: { permission: '...' }` v admin-routing.module.ts.
 * 4) Obrázky (KBImageBlock.path) patří do `src/assets/kb/<page-id>/...`.
 * 5) VŠECHNY uživatelsky viditelné texty (navLabel, header, obsah bloků) MUSÍ mít
 *    vyplněné `cz` i `en` pole - viz `LocalizedText` v kb-content.ts. `devNote`
 *    zůstává jednojazyčný (dev-only, nikdy se nevykresluje).
 *
 * @note `support-form` a `news` NEJSOU v tomhle poli - obě zůstávají vlastní
 * komponenty/routy (mají skutečnou logiku, ne statický text) - viz admin-routing.module.ts.
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * VŠECHNA textová pole převedena z plochého `string` na `LocalizedText` (`{cz, en}`) -
 * viz kb-content.ts refactor-note stejné datum. `breadcrumb` pole ODSTRANĚNO (skládá
 * se dynamicky v KbArticleComponent).
 */

import { KBPage } from "../../../../shared/interfaces/kb-content";

export const KB_PAGES: KBPage[] = [

  // ── General ──────────────────────────────────────────────────────────────

  {
    id: 'introductions',
    navGroup: 'general',
    navLabel: { cz: 'Introductions', en: 'Introductions' },
    navOrder: 1,
    header: { cz: 'Vítejte u zrodu RPSoftware', en: 'Welcome to the Birth of RPSoftware' },
    sections: [
      {
        blocks: [
          { type: 'lead', content: {
            cz: 'Jsme technologické křídlo zavedené společnosti RegioPartner, s.r.o. Zatímco naše mateřská firma udává směr v regionálním rozvoji a evaluacích, my v RPSW stavíme digitální budoucnost pro malé a střední projekty.',
            en: 'We are the technology arm of the established company RegioPartner, s.r.o. While our parent company sets the direction in regional development and evaluations, at RPSW we are building the digital future for small and medium-sized projects.'
          } }
        ]
      },
      {
        heading: { cz: '01. Naše identita a vize', en: '01. Our Identity and Vision' },
        blocks: [
          { type: 'text', content: {
            cz: 'RPSW (RPSoftware) vzniklo jako potřeba propojit expertní znalosti z businessu s moderními technologiemi. Nejsme korporát – jsme agilní tým, který právě teď definuje své procesy, hledá ty nejlepší cesty k zakázkám a buduje si své jméno na trhu.',
            en: 'RPSW (RPSoftware) was created out of the need to connect expert business knowledge with modern technology. We are not a corporation - we are an agile team that is currently defining its processes, finding the best paths to new business, and building its name in the market.'
          } },
          { type: 'alert', variant: 'info', content: {
            cz: 'Jsi u samotného zrodu: Momentálně nefungujeme v režimu 24/7 full-time, ale jsme ve fázi aktivního rozjezdu. Každá splněná zakázka a každý nový lead nás posouvá blíž k velkému cíli.',
            en: 'You are here at the very beginning: we are not yet operating full-time 24/7, but we are in an active growth phase. Every completed project and every new lead moves us closer to our big goal.'
          } }
        ]
      },
      {
        heading: { cz: '02. Systém "In-House" – Stavíme si vlastní nástroje', en: '02. "In-House" System - We Build Our Own Tools' },
        blocks: [
          { type: 'text', content: {
            cz: 'Věříme v to, co prodáváme. Proto i tento evidenční systém, webové stránky a celá tato Knowledge Base nejsou koupené šablony, ale custom řešení vyvinuté přímo námi.',
            en: 'We believe in what we sell. That is why this record-keeping system, the website, and this entire Knowledge Base are not purchased templates, but custom solutions developed by us.'
          } },
          { type: 'text', content: {
            cz: 'Tento systém je ve fázi aktivního vývoje. Čas od času může dojít ke změnám funkcí nebo vzhledu. O všech podstatných novinkách se dozvíte v sekci Novinky. Systém může obsahovat bugy – prosím nahlašte veškeré závady přes support formulář. Každé zneužití zranitelnosti systému se trestá.',
            en: 'This system is under active development. From time to time, features or the appearance may change. You will learn about all significant updates in the News section. The system may contain bugs - please report any issues via the support form. Any exploitation of a system vulnerability will be penalized.'
          } },
          { type: 'grid', cards: [
            { title: { cz: 'Systém ve vývoji', en: 'System Under Development' }, text: {
              cz: 'Vše je plně funkční, ale neustále ladíme detaily. Pokud narazíš na chybu nebo tě napadne vylepšení, využij náš support formulář.',
              en: 'Everything is fully functional, but we are constantly fine-tuning the details. If you come across a bug or have an idea for an improvement, use our support form.'
            } },
            { title: { cz: 'Informovanost', en: 'Staying Informed' }, text: {
              cz: 'O každé změně v postupech nebo updatech systému tě budeme informovat v sekci Novinky nebo na Discordu.',
              en: 'We will keep you informed of every change in processes or system updates in the News section or on Discord.'
            } }
          ] }
        ]
      },
      {
        heading: { cz: '03. Komunikace a zpětná vazba', en: '03. Communication and Feedback' },
        blocks: [
          { type: 'text', content: {
            cz: 'Otevřenost je pro nás klíčová. Protože teprve hledáme tu nejefektivnější cestu, potřebujeme slyšet tvůj názor. Jakýkoliv poznatek z praxe (od klientů, z ovládání systému nebo z procesů) s námi sdílej.',
            en: 'Openness is key for us. Since we are still finding the most effective path, we need to hear your opinion. Share any insight from practice with us - from clients, from using the system, or from our processes.'
          } },
          { type: 'flow', steps: [
            { label: { cz: 'Discord (Hlavní kanál)', en: 'Discord (Main Channel)' }, text: {
              cz: 'Místo pro real-time diskuzi, rychlé dotazy a operativní řešení témat napříč týmem.',
              en: 'The place for real-time discussion, quick questions, and resolving topics across the team on the fly.'
            }, active: true },
            { label: { cz: 'Novinky v KB', en: 'News in the KB' }, text: {
              cz: 'Zde najdeš oficiální ChangeLog a soupis změn v procesech či aplikaci.',
              en: 'Here you will find the official changelog and a list of changes to processes or the application.'
            } },
            { label: { cz: 'E-mail / Feedback', en: 'E-mail / Feedback' }, text: {
              cz: 'Pro hlubší podněty nebo oficiální záležitosti jsme k dispozici na mailu.',
              en: 'For deeper feedback or official matters, we are available by e-mail.'
            } }
          ] }
        ]
      },
      {
        blocks: [
          { type: 'note', highlight: true, content: {
            cz: 'Slovo závěrem: Vážíme si toho, že do toho jdeš s námi. RPSW není jen o kódu a obchodu, je o lidech, kteří chtějí něco vybudovat od nuly. Pojďme společně vytvořit něco, co bude dávat smysl.',
            en: 'A final word: We appreciate you going into this with us. RPSW is not just about code and business - it is about people who want to build something from scratch. Let us create something meaningful together.'
          } }
        ]
      }
    ]
  },
  {
    id: 'security',
    navGroup: 'general',
    navLabel: { cz: 'Přístup', en: 'Access' },
    navOrder: 3,
    header: { cz: 'Přístupové údaje a bezpečnost', en: 'Access Credentials and Security' },
    devNote: 'Popisuje obecná bezpečnostní pravidla (2FA, hesla) - viz PersonalInfoComponent a User::FORCED_2FA_ROLE_NAMES pro skutečnou implementaci vynucení.',
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - sem patří vysvětlení přihlašování, 2FA a politiky hesel.',
      en: 'Placeholder content - this should explain login, 2FA, and password policy.'
    } } ] } ]
  },
  {
    id: 'contacts',
    navGroup: 'general',
    navLabel: { cz: 'Kontakty', en: 'Contacts' },
    navOrder: 4,
    header: { cz: 'Kontakty na tým', en: 'Team Contacts' },
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - sem patří seznam kontaktů na klíčové lidi v týmu.',
      en: 'Placeholder content - this should list contacts for key people on the team.'
    } } ] } ]
  },

  // ── Roles ────────────────────────────────────────────────────────────────

  {
    id: 'sales-rep',
    navGroup: 'roles',
    navLabel: { cz: 'Sales Rep', en: 'Sales Rep' },
    navOrder: 5,
    header: { cz: 'Role: Obchodní zástupce', en: 'Role: Sales Representative' },
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - sem patří popis náplně role obchodního zástupce v systému (Sales Leads, Sales Orders).',
      en: 'Placeholder content - this should describe the responsibilities of the Sales Representative role in the system (Sales Leads, Sales Orders).'
    } } ] } ]
  },

  // ── Web (odpovídá routám 'web/*' v admin-routing.module.ts) ─────────────

  {
    id: 'web-dashboard',
    navGroup: 'web',
    navLabel: { cz: 'Dashboard', en: 'Dashboard' },
    navOrder: 10,
    header: { cz: 'Web - Dashboard', en: 'Web - Dashboard' },
    devNote: "DashboardComponent (web-pages), route 'web/dashboard', permission 'web-view-dashboard'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - přehledová stránka webového modulu administrace.',
      en: 'Placeholder content - the overview page of the Web admin module.'
    } } ] } ]
  },
  {
    id: 'user-request',
    navGroup: 'web',
    navLabel: { cz: 'Webový formulář', en: 'Web Form' },
    navOrder: 11,
    header: { cz: 'Webový formulář (poptávky)', en: 'Web Form (Inquiries)' },
    devNote: "UserRequestComponent, route 'web/user-request', permission 'web-user-requests-view' (edit/delete vyžadují navíc -update/-delete).",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa poptávek odeslaných z veřejného webového formuláře.',
      en: 'Placeholder content - management of inquiries submitted via the public web form.'
    } } ] } ]
  },
  {
    id: 'web-business-logs',
    navGroup: 'web',
    navLabel: { cz: 'Business logy', en: 'Business Logs' },
    navOrder: 12,
    header: { cz: 'Web - Business logy', en: 'Web - Business Logs' },
    devNote: "BusinessLogsComponent, route 'web/business-logs', permission 'web-view-web-logs'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - auditní log akcí provedených ve webovém modulu.',
      en: 'Placeholder content - an audit log of actions performed in the Web module.'
    } } ] } ]
  },
  {
    id: 'sales-leads',
    navGroup: 'web',
    navLabel: { cz: 'Obchodní leady', en: 'Sales Leads' },
    navOrder: 13,
    header: { cz: 'Obchodní leady', en: 'Sales Leads' },
    devNote: "SalesLeadsComponent, route 'web/sales-leads', permission 'web-sales-leads-view'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - evidence a generování odkazů pro obchodní leady.',
      en: 'Placeholder content - tracking and link generation for sales leads.'
    } } ] } ]
  },
  {
    id: 'edit-news',
    navGroup: 'web',
    navLabel: { cz: 'Novinky (web)', en: 'News (Website)' },
    navOrder: 14,
    header: { cz: 'Správa novinek na webu', en: 'Website News Management' },
    devNote: "EditNewsComponent, route 'web/edit-news', permission 'web-news-view'. Nezaměňovat s KB sekcí 'Novinky' (interní ChangeLog) - tohle je editace novinek zobrazovaných na veřejném webu.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - editace novinek zobrazovaných na veřejném webu.',
      en: 'Placeholder content - editing news items shown on the public website.'
    } } ] } ]
  },
  {
    id: 'edit-website',
    navGroup: 'web',
    navLabel: { cz: 'Editace webu', en: 'Website Editing' },
    navOrder: 15,
    header: { cz: 'Editace obsahu webu', en: 'Website Content Editing' },
    devNote: "EditWebsiteComponent, route 'web/edit-website', permission 'web-view-edit-website'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - editace obsahových částí veřejného webu.',
      en: 'Placeholder content - editing content sections of the public website.'
    } } ] } ]
  },
  {
    id: 'sales-orders',
    navGroup: 'web',
    navLabel: { cz: 'Přijaté objednávky', en: 'Received Orders' },
    navOrder: 16,
    header: { cz: 'Přijaté objednávky (realizace)', en: 'Received Orders (Fulfillment)' },
    devNote: "SalesOrdersComponent, route 'web/sales-orders', permission 'web-sales-orders-view'. Řádková akce 'Projekt' zakládá navazující záznam v Projects.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - přehled přijatých objednávek/realizací a jejich zpracování.',
      en: 'Placeholder content - overview of received orders/fulfillments and their processing.'
    } } ] } ]
  },
  {
    id: 'support-tickets',
    navGroup: 'web',
    navLabel: { cz: 'Helpdesk tickety', en: 'Helpdesk Tickets' },
    navOrder: 17,
    header: { cz: 'Helpdesk tickety', en: 'Helpdesk Tickets' },
    devNote: "SupportTicketsComponent, route 'web/support-tickets', permission 'web-support-tickets-view'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa helpdesk ticketů přijatých od uživatelů.',
      en: 'Placeholder content - management of helpdesk tickets received from users.'
    } } ] } ]
  },
  {
    id: 'job-applications',
    navGroup: 'web',
    navLabel: { cz: 'Pracovní nabídky', en: 'Job Applications' },
    navOrder: 18,
    header: { cz: 'Pracovní formulář (uchazeči)', en: 'Job Application Form (Candidates)' },
    devNote: "JobApplicationsComponent, route 'web/job-applications', permission 'web-job-applications-view'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - přehled odeslaných žádostí z pracovního formuláře.',
      en: 'Placeholder content - overview of applications submitted via the job form.'
    } } ] } ]
  },
  {
    id: 'projects',
    navGroup: 'web',
    navLabel: { cz: 'Projekty', en: 'Projects' },
    navOrder: 19,
    header: { cz: 'Projekty a zákaznická vlákna', en: 'Projects and Customer Threads' },
    devNote: "ProjectsComponent, route 'web/projects', permission 'web-projects-view'. Obsahuje i cross-project tabulku zákaznických vláken (web/project-threads).",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa zákaznických projektů, checkpointů a komunikace.',
      en: 'Placeholder content - management of customer projects, checkpoints, and communication.'
    } } ] } ]
  },

  // ── Core (odpovídá routám 'core/*' v admin-routing.module.ts) ────────────

  {
    id: 'core-dashboard',
    navGroup: 'core',
    navLabel: { cz: 'Dashboard', en: 'Dashboard' },
    navOrder: 20,
    header: { cz: 'Core - Dashboard', en: 'Core - Dashboard' },
    devNote: "CoreDashboardComponent, route 'core/dashboard', permission 'view-core'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - přehledová stránka systémového (core) modulu.',
      en: 'Placeholder content - the overview page of the Core (system) module.'
    } } ] } ]
  },
  {
    id: 'welcome-page',
    navGroup: 'core',
    navLabel: { cz: 'Uvítací stránka', en: 'Welcome Page' },
    navOrder: 21,
    header: { cz: 'Uvítací stránka', en: 'Welcome Page' },
    devNote: "WelcomePageComponent, route 'core/welcome-page' (výchozí route pod core/), permission 'core-view-welcome-page'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - úvodní stránka po přihlášení do administrace.',
      en: 'Placeholder content - the landing page shown after logging into the administration.'
    } } ] } ]
  },
  {
    id: 'edit-legal',
    navGroup: 'core',
    navLabel: { cz: 'Právní dokumenty', en: 'Legal Documents' },
    navOrder: 22,
    header: { cz: 'Editace právních dokumentů (GDPR, TOS...)', en: 'Editing Legal Documents (GDPR, TOS...)' },
    devNote: "EditLegalComponent, route 'core/edit-legal', permission 'core-legal-documents-view|core-legal-config-view'. Vícejazyčný obsah, typy dokumentů se načítají dynamicky z legal/document-types.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - editace vícejazyčného obsahu právních dokumentů (GDPR, obchodní podmínky, cookies).',
      en: 'Placeholder content - editing multilingual content of legal documents (GDPR, terms of service, cookies).'
    } } ] } ]
  },
  {
    id: 'personal-info',
    navGroup: 'core',
    navLabel: { cz: 'Osobní údaje', en: 'Personal Information' },
    navOrder: 23,
    header: { cz: 'Osobní údaje a zabezpečení účtu', en: 'Personal Information and Account Security' },
    devNote: "PersonalInfoComponent, route 'core/personal-info', permission 'web-view-personal-info'. Self-service 2FA toggle a změna hesla.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa vlastního profilu, hesla a dvoufaktorového ověření.',
      en: 'Placeholder content - managing your own profile, password, and two-factor authentication.'
    } } ] } ]
  },
  {
    id: 'web-settings',
    navGroup: 'core',
    navLabel: { cz: 'Nastavení webu', en: 'Website Settings' },
    navOrder: 24,
    header: { cz: 'Globální nastavení webu', en: 'Global Website Settings' },
    devNote: "WebSettingsComponent, route 'core/web-settings', permission 'core-legal-config-view'. Firemní údaje, logo, sociální sítě.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - firemní údaje, logo a sociální sítě zobrazované na webu.',
      en: 'Placeholder content - company details, logo, and social media shown on the website.'
    } } ] } ]
  },
  {
    id: 'external-links',
    navGroup: 'core',
    navLabel: { cz: 'Externí odkazy', en: 'External Links' },
    navOrder: 25,
    header: { cz: 'Externí odkazy (rychlé odkazy adminu)', en: 'External Links (Admin Quick Links)' },
    devNote: "ExternalLinksComponent + CoreExternalLinkController, route 'core/external-links', permission 'core-external-links-view' (create/update/delete zvlášť). Odkazy jsou SOUKROMÉ per-uživatel (scoped na user_id na backendu).",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - osobní seznam rychlých odkazů na externí nástroje, viditelný jen tobě.',
      en: 'Placeholder content - a personal list of quick links to external tools, visible only to you.'
    } } ] } ]
  },
  {
    id: 'edit-roles',
    navGroup: 'core',
    navLabel: { cz: 'Role a oprávnění', en: 'Roles and Permissions' },
    navOrder: 26,
    header: { cz: 'Správa rolí a oprávnění', en: 'Roles and Permissions Management' },
    devNote: "EditRolesComponent, route 'core/edit-roles'. Přístup NEZÁVISLE na permission systému natvrdo omezen na roli 'sysadmin' (sysadminGuard) - nemá klasický permission klíč.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa rolí a jejich oprávnění. Přístupné výhradně sysadminovi.',
      en: 'Placeholder content - management of roles and their permissions. Accessible exclusively to the sysadmin.'
    } } ] } ]
  },
  {
    id: 'administrators',
    navGroup: 'core',
    navLabel: { cz: 'Administrátoři', en: 'Administrators' },
    navOrder: 27,
    header: { cz: 'Správa uživatelských účtů', en: 'User Account Management' },
    devNote: "AdministratorsComponent, route 'core/administrators', permission 'core-administrators-view'. Řeší i 2FA vynucení, blokaci účtů a e-mailovou doménovou politiku (jen sysadmin).",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa administrátorských účtů, rolí, 2FA a blokací.',
      en: 'Placeholder content - management of administrator accounts, roles, 2FA, and blocking.'
    } } ] } ]
  },
  {
    id: 'core-logs',
    navGroup: 'core',
    navLabel: { cz: 'Systémové logy', en: 'System Logs' },
    navOrder: 28,
    header: { cz: 'Core - Systémové logy', en: 'Core - System Logs' },
    devNote: "CoreLogsComponent, route 'core/logs', permission 'view-core'. Poznámka v routing komentáři: dočasně čte ze stejného zdroje jako web/business-logs.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - přehled systémových auditních logů.',
      en: 'Placeholder content - overview of system audit logs.'
    } } ] } ]
  },
  {
    id: 'security-events',
    navGroup: 'core',
    navLabel: { cz: 'Bezpečnostní monitoring', en: 'Security Monitoring' },
    navOrder: 29,
    header: { cz: 'Bezpečnostní monitoring', en: 'Security Monitoring' },
    devNote: "SecurityEventsComponent, route 'core/security-events', permission 'core-security-view'. Triage podezřelých eventů, retenční politika (GDPR), ruční purge.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - monitoring podezřelé aktivity, triage eventů a nastavení retenční doby.',
      en: 'Placeholder content - monitoring of suspicious activity, event triage, and retention period settings.'
    } } ] } ]
  },

  // ── Shop (odpovídá routám 'shop/*' v admin-routing.module.ts) ────────────

  {
    id: 'shop-dashboard',
    navGroup: 'shop',
    navLabel: { cz: 'Dashboard', en: 'Dashboard' },
    navOrder: 30,
    header: { cz: 'Shop - Dashboard', en: 'Shop - Dashboard' },
    devNote: "ShopDashboardComponent, route 'shop/dashboard', permission 'shop-view-dashboard'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - přehledová stránka e-shop modulu administrace.',
      en: 'Placeholder content - the overview page of the Shop admin module.'
    } } ] } ]
  },
  {
    id: 'shop-products',
    navGroup: 'shop',
    navLabel: { cz: 'Produkty', en: 'Products' },
    navOrder: 31,
    header: { cz: 'Správa produktů', en: 'Product Management' },
    devNote: "ProductsComponent, route 'shop/products', permission 'shop-manage-products'. Zahrnuje varianty a obrázky produktu (samostatné modaly).",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa produktového katalogu, variant a obrázků.',
      en: 'Placeholder content - management of the product catalog, variants, and images.'
    } } ] } ]
  },
  {
    id: 'shop-categories',
    navGroup: 'shop',
    navLabel: { cz: 'Kategorie', en: 'Categories' },
    navOrder: 32,
    header: { cz: 'Správa kategorií', en: 'Category Management' },
    devNote: "CategoriesComponent, route 'shop/categories', permission 'shop-manage-categories'. Stromová struktura kategorií + přiřazování produktů.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - hierarchická správa kategorií produktů.',
      en: 'Placeholder content - hierarchical management of product categories.'
    } } ] } ]
  },
  {
    id: 'shop-orders',
    navGroup: 'shop',
    navLabel: { cz: 'Objednávky', en: 'Orders' },
    navOrder: 33,
    header: { cz: 'Správa objednávek', en: 'Order Management' },
    devNote: "OrdersComponent, route 'shop/orders', permission 'shop-view-orders'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa e-shopových objednávek, stavů a plateb.',
      en: 'Placeholder content - management of e-shop orders, statuses, and payments.'
    } } ] } ]
  },
  {
    id: 'shop-customers',
    navGroup: 'shop',
    navLabel: { cz: 'Zákazníci', en: 'Customers' },
    navOrder: 34,
    header: { cz: 'Správa zákazníků', en: 'Customer Management' },
    devNote: "CustomersComponent, route 'shop/customers', permission 'shop-manage-customers'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa zákaznických účtů a jejich historie objednávek.',
      en: 'Placeholder content - management of customer accounts and their order history.'
    } } ] } ]
  },
  {
    id: 'shop-shipping-methods',
    navGroup: 'shop',
    navLabel: { cz: 'Způsoby dopravy', en: 'Shipping Methods' },
    navOrder: 35,
    header: { cz: 'Způsoby dopravy', en: 'Shipping Methods' },
    devNote: "ShippingMethodsComponent, route 'shop/shipping-methods', permission 'shop-manage-shipping-methods'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa dostupných způsobů dopravy.',
      en: 'Placeholder content - management of available shipping methods.'
    } } ] } ]
  },
  {
    id: 'shop-payment-methods',
    navGroup: 'shop',
    navLabel: { cz: 'Platební metody', en: 'Payment Methods' },
    navOrder: 36,
    header: { cz: 'Platební metody', en: 'Payment Methods' },
    devNote: "PaymentMethodsComponent, route 'shop/payment-methods', permission 'shop-manage-payment-methods'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa dostupných platebních metod.',
      en: 'Placeholder content - management of available payment methods.'
    } } ] } ]
  },
  {
    id: 'shop-suppliers',
    navGroup: 'shop',
    navLabel: { cz: 'Dodavatelé', en: 'Suppliers' },
    navOrder: 37,
    header: { cz: 'Správa dodavatelů', en: 'Supplier Management' },
    devNote: "SuppliersComponent, route 'shop/suppliers', permission 'shop-manage-suppliers'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - evidence dodavatelů produktů.',
      en: 'Placeholder content - tracking of product suppliers.'
    } } ] } ]
  },
  {
    id: 'coupons',
    navGroup: 'shop',
    navLabel: { cz: 'Slevové kupóny', en: 'Discount Coupons' },
    navOrder: 38,
    header: { cz: 'Slevové kupóny', en: 'Discount Coupons' },
    devNote: "CouponsComponent, route 'shop/coupons', permission 'shop-view-reports'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - správa slevových kupónů a jejich podmínek.',
      en: 'Placeholder content - management of discount coupons and their conditions.'
    } } ] } ]
  },
  {
    id: 'shop-logs',
    navGroup: 'shop',
    navLabel: { cz: 'Logy', en: 'Logs' },
    navOrder: 39,
    header: { cz: 'Shop - Logy', en: 'Shop - Logs' },
    devNote: "ShopLogsComponent, route 'shop/logs', permission 'shop-view-logs'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - auditní log akcí provedených v e-shop modulu.',
      en: 'Placeholder content - an audit log of actions performed in the Shop module.'
    } } ] } ]
  },
  {
    id: 'edit-eshop',
    navGroup: 'shop',
    navLabel: { cz: 'Nastavení e-shopu', en: 'E-shop Settings' },
    navOrder: 40,
    header: { cz: 'Globální nastavení e-shopu', en: 'Global E-shop Settings' },
    devNote: "EditEshopComponent, route 'shop/edit-eshop', permission 'shop-view-edit-eshop'.",
    sections: [ { blocks: [ { type: 'lead', content: {
      cz: 'Testovací obsah - globální nastavení e-shopu.',
      en: 'Placeholder content - global e-shop settings.'
    } } ] } ]
  },

  // ── Support ──────────────────────────────────────────────────────────────
  // support-form (vlastní komponenta) a news (vlastní komponenta) NEJSOU v tomhle
  // poli - viz admin-routing.module.ts, obě mají vlastní explicitní route.
];