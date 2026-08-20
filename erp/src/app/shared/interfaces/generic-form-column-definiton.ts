/**
 * @file generic-form-column-definiton.ts
 * @path src/app/shared/interfaces/generic-form-column-definiton.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Shape of a single column configuration consumed by `TableBuilderComponent`
 * (table rendering, cell-value resolution) and its export pipeline.
 * @refactor-note (2026-08-18) Přidán `exportable?: boolean` - viz backlog task "export:
 * uživatelský výběr sloupců přes checkboxy". Sloupec s `exportable: false` se:
 * 1) VŮBEC nezobrazí v checkbox seznamu sloupců v `ExportPopupBuilderComponent` (ne jen
 *    defaultně odškrtnutý - uživatel ho nemá šanci ani omylem zapnout),
 * 2) je natvrdo vynechaný z `buildExportRows()` v `TableBuilderComponent`, bez ohledu na
 *    to, co by případně přišlo v `columnKeys` výběru.
 * Typický případ užití: sloupec, který se v tabulce zobrazuje (např. maskovaně, nebo jen
 * pro interní přehled), ale nikdy by neměl opustit systém v exportovaném souboru -
 * hesla/hashe, technické `permissions` sloupce s desítkami klíčů (zbytečný šum pro
 * uživatele) apod. Na rozdíl od `hidden` (řídí jen VIZUÁLNÍ zobrazení ve sloupcích
 * tabulky) je `exportable` nezávislá vlastnost - sloupec může být `hidden: true` a
 * přesto `exportable: true` (např. interní ID použité pro export/audit, ale nezajímavé
 * pro běžný přehled), nebo naopak viditelný v tabulce a `exportable: false` (typicky
 * právě `permissions`/citlivá pole). Chybějící `exportable` = chová se jako `true`
 * (zpětně kompatibilní se všemi existujícími column configy, které toto pole nemají).
 * @note Tento soubor definuje POUZE tvar konfigurace sloupce - vlastní vynucení
 * `exportable` (filtrování při exportu) řeší `TableBuilderComponent.buildExportRows()`,
 * ne tento interface sám o sobě.
 */
export interface ColumnDefinition {
  key: string;
  header: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'image' | 'link';
  format?: string;
  hidden?: boolean;
  currencyCode?: 'CZK' | 'EUR' | 'USD' | 'GBP' | string;
  /**
   * @description Zda tento sloupec smí být vůbec součástí exportu (CSV/XLSX/JSON/TXT).
   * `false` = sloupec se nezobrazí v checkbox výběru sloupců a nikdy se neexportuje,
   * bez ohledu na uživatelský výběr. Chybějící hodnota = `true` (zpětně kompatibilní
   * výchozí chování). Viz refactor-note (2026-08-18) výše.
   */
  exportable?: boolean;
}