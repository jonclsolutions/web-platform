/**
 * @file table-buttons.ts
 * @path src/app/admin/shared/interfaces/table-buttons.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Defines the shape of a single row-level action button rendered by
 * TableBuilderComponent / TrashTableBuilderComponent (e.g. Edit, Delete, Details).
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php,
 *      admin-routing.module.ts a has-permission.directive.ts stejné datum): přidáno
 *      volitelné `permission` pole. Podporuje stejnou OR syntaxi jako
 *      *appHasPermission direktiva a backend CheckPermission middleware
 *      (`'web-news-update'` nebo `'core-legal-documents-view|core-legal-config-view'`).
 *      Tlačítko bez `permission` zůstává viditelné vždy (dokud je `isActive: true`) -
 *      zpětně kompatibilní se stávajícími konfiguracemi, které pole ještě nemají.
 *      Vyhodnocuje TableBuilderComponent.isButtonVisible() / TrashTableBuilderComponent
 *      přes vlastní `@Input() deletePermission`.
 * @refactor-note (2026-08-24) BACKLOG "efektivnější tlačítko pro akci 0-1x na účet":
 *      přidáno volitelné `visibleWhen` - funkce vyhodnocovaná PRO KAŽDÝ ŘÁDEK zvlášť
 *      (na rozdíl od `permission`, což je globální per-uživatel kontrola). Umožňuje
 *      tlačítko zobrazit jen na řádcích, které danou akci reálně potřebují (např.
 *      "Aktivace" jen u účtů s `activated_at === null`) - `TableBuilderComponent` navíc
 *      celý sloupec v hlavičce vůbec nevykreslí, pokud žádný řádek na aktuální stránce
 *      podmínku nesplňuje (viz `hasAnyRowForButton()`), takže zbytečně neplýtvá místem
 *      u tabulek, kde je akce potřeba jen výjimečně. Bez `visibleWhen` se tlačítko chová
 *      přesně jako dřív (na všech řádcích, kde `isActive`+`permission` projde).
 */
export interface TableButtons {
  display_name: string;
  header_name: string;
  isActive: boolean;
  action: string;
  type: string;
  /**
   * Volitelný permission klíč (nebo víc klíčů oddělených `|` - OR) požadovaný k
   * zobrazení tohoto tlačítka. Bez tohoto pole se tlačítko řídí pouze `isActive`.
   */
  permission?: string;
  /**
   * Volitelná podmínka viditelnosti VYHODNOCOVANÁ PRO KONKRÉTNÍ ŘÁDEK (item z `data`).
   * Vrať `true`, pokud se má tlačítko na tomto řádku zobrazit. Bez tohoto pole je
   * tlačítko na všech řádcích stejné (řízeno jen `isActive`/`permission`).
   */
  visibleWhen?: (item: any) => boolean;
}