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
 */

/** Prostý odstavec textu. */
export interface KBTextBlock {
  type: 'text';
  content: string;
}

/** Zvýrazněný úvodní odstavec (větší font, `--text-muted`) - typicky jeden na stránku, hned pod nadpisem. */
export interface KBLeadBlock {
  type: 'lead';
  content: string;
}

/** Barevně odlišený box pro důležité upozornění. */
export interface KBAlertBlock {
  type: 'alert';
  variant: 'info' | 'warning' | 'success' | 'danger';
  content: string;
}

/** Obrázek (např. screenshot konkrétního tlačítka/modalu, na který se text odkazuje). */
export interface KBImageBlock {
  type: 'image';
  /** Cesta pod `/assets/kb/...` - viz poznámka u KB_PAGES o umístění obrázků. */
  path: string;
  alt: string;
  caption?: string;
}

/** Odkaz - buď interní `routerLink` (do admin sekce, kterou popisuje), nebo externí `href`. */
export interface KBLinkBlock {
  type: 'link';
  label: string;
  url: string;
  /** true = otevře se v novém okně (`target="_blank"`, externí URL); false/chybí = `routerLink` v rámci appky. */
  external?: boolean;
}

/** Odrážkový nebo číslovaný seznam - typicky pro postupy krok-za-krokem. */
export interface KBListBlock {
  type: 'list';
  ordered?: boolean;
  items: string[];
}

/** Jedna karta v `KBGridBlock`. */
export interface KBGridCard {
  title: string;
  text: string;
}

/** Mřížka 2-4 karet vedle sebe (stejný vzor jako `.grid-layout .info-card` v introductions). */
export interface KBGridBlock {
  type: 'grid';
  cards: KBGridCard[];
}

/** Jeden krok v `KBFlowBlock`. */
export interface KBFlowStep {
  label: string;
  text: string;
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
  content: string;
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
  heading?: string;
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
  /** Nadpis skupiny v bočním menu - stránky se stejným `navGroup` se vykreslí pod sebou pod jedním nadpisem. */
  navGroup: string;
  /** Text odkazu v bočním menu. */
  navLabel: string;
  /** Pořadí v rámci `navGroup` (vzestupně) - i pořadí SKUPIN se odvozuje z nejnižšího `navOrder` uvnitř nich. */
  navOrder: number;
  /** Text drobečkové navigace nahoře na stránce, např. "Interní manuál / Web / Externí odkazy". */
  breadcrumb: string;
  /** Hlavní `<h1>` nadpis stránky. */
  header: string;
  /**
   * @description Volitelná dokumentační poznámka VIDITELNÁ JEN V KÓDU (nevykresluje se
   * na stránce) - kam patří permission klíč/role, se kterou daná funkce souvisí. Slouží
   * výhradně programátorovi, co v budoucnu edituje tenhle datový soubor, ať ví, jaké
   * oprávnění popisovaná funkce reálně vyžaduje, aniž by musel dohledávat v *.config.ts.
   */
  devNote?: string;
  sections: KBSection[];
}