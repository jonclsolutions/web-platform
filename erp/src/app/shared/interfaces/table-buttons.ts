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
}