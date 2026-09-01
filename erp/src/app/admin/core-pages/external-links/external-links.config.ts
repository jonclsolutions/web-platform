/**
 * @file external-links.config.ts
 * @path src/app/admin/core-pages/external-links/external-links.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the External Links management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php a
 *      edit-news.config.ts stejné datum): doplněny reálné permission klíče:
 *      - EXTERNAL_LINK_TOOLBAR_BUTTONS: "Přidat" -> `permission: 'core-external-links-create'`.
 *      - EXTERNAL_LINK_BUTTONS: "Edit" -> `core-external-links-update`,
 *        "Smazat" -> `core-external-links-delete`. "Detaily" zůstává bez permission.
 *      @note Klíče přejmenovány z historického `web-manage-external-links` na
 *      `core-external-links-*`, protože stránka reálně žije pod `/core` routou - viz
 *      admin-routing.module.ts stejné datum.
 *
 * @refactor-note (2026-08-31) ODSTRANĚNY `position`/`is_active` - viz CoreExternalLink
 * model a CoreExternalLinkController stejné datum (sloupce fyzicky odstraněny z
 * `web_external_links` SQL migrací). Dopady:
 * - `EXTERNAL_LINK_FORM_FIELDS`: pole "Pořadí" a "Aktivní" odstraněna.
 * - `EXTERNAL_LINK_COLUMNS`/`EXTERNAL_LINK_DETAILS_COLUMNS`: sloupce `position`/
 *   `is_active` odstraněny (včetně `chartable: true` u `is_active`, protože sloupec
 *   už neexistuje - report by na něj stejně narazil na 500 z backendu).
 * - `EXTERNAL_LINK_FILTER_COLUMNS`: filtr "Aktivní" odstraněn.
 */
import * as Core from '../../../shared/imports/core-providers';

export const EXTERNAL_LINK_BUTTONS: Core.TableButtons[] = [
  { display_name: 'Detaily', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  { display_name: 'Edit', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'core-external-links-update', icon: 'edit' },
  { display_name: 'Smazat', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'core-external-links-delete', icon: 'delete' },
];

export const EXTERNAL_LINK_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true, permission: 'core-external-links-create' },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },{ action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  { action: 'toggleTable', label: 'Zobrazit koš', icon: '', class: 'btn-trash', permission: 'view-deleted' }
];

export const EXTERNAL_LINK_FORM_FIELDS: Core.InputDefinition[] = [
  {
column_name: 'name',
label: 'Název odkazu',
placeholder: 'např. Google Analytics',
type: 'text',
required: true,
errorMessage: 'Název je povinný (max 150 znaků).',
editable: true, show_in_edit: true, show_in_create: true,
  },
  {
column_name: 'url',
label: 'URL adresa',
placeholder: 'https://analytics.google.com/...',
type: 'text',
required: true,
pattern: '^https?:\\/\\/.+',
errorMessage: 'Zadejte platnou URL adresu (začínající http:// nebo https://).',
editable: true, show_in_edit: true, show_in_create: true,
  },
];

export const EXTERNAL_LINK_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'url', header: 'URL', type: 'link' },
];

export const EXTERNAL_LINK_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'url', header: 'URL', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const EXTERNAL_LINK_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'name', header: 'Název', type: 'text', placeholder: 'Hledat název...', canSort: true },
  { key: 'url', header: 'URL', type: 'text', placeholder: 'Hledat URL...', canSort: true },
];

export const EXTERNAL_LINK_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'name', displayName: 'Název', type: 'text' },
  { key: 'url', displayName: 'URL adresa', type: 'text' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Naposledy změněno', type: 'date', format: 'medium' },
];