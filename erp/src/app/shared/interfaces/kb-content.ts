/**
 * @file kb-content.ts
 * @path src/app/admin/intranet/knowledge-base/interfaces/kb-content.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Datový model interního manuálu (Knowledge Base). CELÝ obsah manuálu je
 * statická TS data (viz kb-pages.data.ts) - žádný HTTP fetch, žádná DB tabulka. Editace
 * manuálu = editace toho datového souboru v kódu (git diff, code review, deploy) -
 * záměrně, protože jde o manuál k released produktu, ne o uživatelsky editovatelný
 * obsah (na rozdíl od `EditLegalComponent`, který řeší DB-backed GDPR/TOS text).
 *
 * @architecture Jedna stránka (`KBPage`) = pole sekcí (`KBSection`), sekce = pole bloků
 * (`KBBlock`). `KbArticleComponent` (viz kb-article.component.ts) je JEDINÝ renderer -
 * vykresluje libovolnou stránku podle `page.sections`, přepínáním přes `block.type`
 * (`@switch` v šabloně). Přidání nové stránky manuálu = přidat nový objekt do
 * `KB_PAGES` pole v kb-pages.data.ts, ŽÁDNÁ nová komponenta/route/soubor není potřeba
 * (na rozdíl od dřívějšího stavu, kde měla každá stránka manuálu vlastní
 * .component.ts/.html/.css trojici).
 *
 * @note Jediná výjimka je `support-form` - zůstává vlastní explicitní komponentou/route
 * (má skutečnou logiku - reaktivní formulář, file upload, POST na `web/support_tickets`),
 * ne statický text, takže do tohoto blokového modelu nepatří.
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * KAŽDÉ uživatelsky viditelné textové pole (`content`/`label`/`title`/`text`/`alt`/
 * `caption`/`navLabel`/`header`) je teď `LocalizedText` (`{cz, en}`) místo plochého
 * `string` - viz `LocalizedText`/`resolveLoc()` níže. `devNote` ZŮSTÁVÁ plochý string -
 * je to poznámka pro vývojáře, nikdy se nevykresluje v UI, takže nemá smysl ji
 * zdvojovat. `breadcrumb` pole bylo Z DATOVÉHO MODELU ODSTRANĚNO ÚPLNĚ - dřív to byl
 * ručně psaný duplicitní string ("Interní manuál / Web / X"), teď se skládá dynamicky
 * v `KbArticleComponent` z přeloženého kořene + přeloženého názvu skupiny (`navGroup`)
 * + `navLabel`, takže se nemůže rozejít s realitou a nemusí se překládat zvlášť (viz
 * `KbArticleComponent.breadcrumb` getter). `navGroup` je teď uzavřená množina
 * anglických identifikátorů (`KBNavGroupKey`) - stabilní klíč pro grupování/routing,
 * NE zobrazovaný text; zobrazovaný název skupiny se překládá přes
 * `AdminLocalizationService`, sekce 'knowledge-base', klíče `nav_group_{group}`.
 */

/** @description Textové pole dostupné ve všech podporovaných admin jazycích. */
export interface LocalizedText {
  cz: string;
  en: string;
  /** Index signatura kvůli `resolveLoc()` - umožňuje bezpečný přístup přes
   * dynamický klíč jazyka (`loc[lang]`) bez nutnosti `as unknown as Record<...>`
   * přetypování, které TS jinak odmítá kvůli nedostatečnému překryvu typů. */
  [key: string]: string;
}

/**
 * @description Vrátí text v aktuálním jazyce, s fallbackem na češtinu, pokud by pro
 * daný jazyk (budoucí rozšíření nad cz/en) chyběl klíč.
 */
export function resolveLoc(loc: LocalizedText, lang: string): string {
  return loc[lang] ?? loc.en;
}

/** @description Stabilní, NEpřekládaný identifikátor sekce levého menu. Malá
 * písmena záměrně - odpovídá JSON klíčům `knowledge-base.nav_group_{key}`
 * (AdminLocalizationService), viz KnowledgeBaseComponent.buildNavGroups(). */
export type KBNavGroupKey = 'general' | 'roles' | 'web' | 'core' | 'shop';

/** Prostý odstavec textu. */
export interface KBTextBlock {
  type: 'text';
  content: LocalizedText;
}

/** Zvýrazněný úvodní odstavec (větší font, `--text-muted`) - typicky jeden na stránku, hned pod nadpisem. */
export interface KBLeadBlock {
  type: 'lead';
  content: LocalizedText;
}

/** Barevně odlišený box pro důležité upozornění. */
export interface KBAlertBlock {
  type: 'alert';
  variant: 'info' | 'warning' | 'success' | 'danger';
  content: LocalizedText;
}

/** Obrázek (např. screenshot konkrétního tlačítka/modalu, na který se text odkazuje). */
export interface KBImageBlock {
  type: 'image';
  /** Cesta pod `/assets/kb/...` - viz poznámka u KB_PAGES o umístění obrázků. Cesta k
   * souboru samotná NENÍ text k překladu, zůstává plochý string. */
  path: string;
  alt: LocalizedText;
  caption?: LocalizedText;
}

/** Odkaz - buď interní `routerLink` (do admin sekce, kterou popisuje), nebo externí `href`. */
export interface KBLinkBlock {
  type: 'link';
  label: LocalizedText;
  /** Cílová URL/route - NENÍ text k překladu, zůstává plochý string. */
  url: string;
  /** true = otevře se v novém okně (`target="_blank"`, externí URL); false/chybí = `routerLink` v rámci appky. */
  external?: boolean;
}

/** Odrážkový nebo číslovaný seznam - typicky pro postupy krok-za-krokem. */
export interface KBListBlock {
  type: 'list';
  ordered?: boolean;
  items: LocalizedText[];
}

/** Jedna karta v `KBGridBlock`. */
export interface KBGridCard {
  title: LocalizedText;
  text: LocalizedText;
}

/** Mřížka 2-4 karet vedle sebe (stejný vzor jako `.grid-layout .info-card` v introductions). */
export interface KBGridBlock {
  type: 'grid';
  cards: KBGridCard[];
}

/** Jeden krok v `KBFlowBlock`. */
export interface KBFlowStep {
  label: LocalizedText;
  text: LocalizedText;
  /** Zvýrazní krok jako "aktuální/výchozí" (stejný vzor jako `.flow-item.active`). */
  active?: boolean;
}

/** Vodorovný postup/proces (stejný vzor jako `.process-flow` v introductions). */
export interface KBFlowBlock {
  type: 'flow';
  steps: KBFlowStep[];
}

/** Závěrečná poznámka na konci stránky/sekce (stejný vzor jako `.note-box.highlight-note`). */
export interface KBNoteBlock {
  type: 'note';
  highlight?: boolean;
  content: LocalizedText;
}

export type KBBlock =
  | KBTextBlock
  | KBLeadBlock
  | KBAlertBlock
  | KBImageBlock
  | KBLinkBlock
  | KBListBlock
  | KBGridBlock
  | KBFlowBlock
  | KBNoteBlock;

/** Jedna sekce stránky - volitelný nadpis (`<h2>`) + pole bloků. Sekce bez `heading` = pokračování předchozí vizuální sekce bez nového nadpisu. */
export interface KBSection {
  heading?: LocalizedText;
  blocks: KBBlock[];
}

/**
 * @description Jedna stránka manuálu. `id` je route segment (`/admin/intranet/
 * knowledge-base/:id`) i unikátní klíč v `KB_PAGES` - musí být kebab-case, beze změny
 * jakmile je jednou publikovaný (jinak se rozbijí odkazy z jiných stránek/Discordu).
 */
export interface KBPage {
  /** Route slug, např. 'introductions', 'external-links'. Musí být unikátní v KB_PAGES. */
  id: string;
  /** Stabilní (NEpřekládaný) identifikátor skupiny v bočním menu - stránky se stejným
   * `navGroup` se vykreslí pod sebou pod jedním nadpisem. Zobrazovaný (přeložený)
   * název skupiny se dohledá přes `AdminLocalizationService`, klíč
   * `knowledge-base.nav_group_{navGroup}` - viz refactor-note v hlavičce souboru. */
  navGroup: KBNavGroupKey;
  /** Text odkazu v bočním menu. */
  navLabel: LocalizedText;
  /** Pořadí v rámci `navGroup` (vzestupně) - i pořadí SKUPIN se odvozuje z nejnižšího `navOrder` uvnitř nich. */
  navOrder: number;
  /** Hlavní `<h1>` nadpis stránky. */
  header: LocalizedText;
  /**
   * @description Volitelná dokumentační poznámka VIDITELNÁ JEN V KÓDU (nevykresluje se
   * na stránce) - kam patří permission klíč/role, se kterou daná funkce souvisí. Slouží
   * výhradně programátorovi, co v budoucnu edituje tenhle datový soubor, ať ví, jaké
   * oprávnění popisovaná funkce reálně vyžaduje, aniž by musel dohledávat v *.config.ts.
   * ZÁMĚRNĚ zůstává plochý (jednojazyčný) string - nikdy se nevykresluje v UI.
   */
  devNote?: string;
  sections: KBSection[];
}