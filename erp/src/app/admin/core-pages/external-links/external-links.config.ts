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
 */
import * as Core from '../../../shared/imports/core-providers';

export const EXTERNAL_LINK_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔍', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'core-external-links-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'core-external-links-delete' },
];

export const EXTERNAL_LINK_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtry', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat', icon: '➕', class: 'btn-create', showIf: true, permission: 'core-external-links-create' },
  { action: 'exportActiveTable', label: 'Export', icon: '📥', class: 'btn-export', showIf: true },
  { action: 'toggleTable', label: 'Koš', icon: '🗑️', class: 'btn-trash', permission: 'view-deleted' }
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
  {
column_name: 'position',
label: 'Pořadí',
placeholder: '0',
type: 'number',
required: false,
editable: true, show_in_edit: true, show_in_create: true,
  },
  {
column_name: 'is_active',
label: 'Aktivní',
type: 'select',
options: [
      { value: '1', label: 'Ano' },
      { value: '0', label: 'Ne' }
    ],
required: true,
editable: true, show_in_edit: true, show_in_create: true
  },
];

export const EXTERNAL_LINK_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'url', header: 'URL', type: 'link' },
  { key: 'position', header: 'Pořadí', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
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
  { key: 'is_active', header: 'Aktivní', type: 'select', options: ["1", "0"], placeholder: '-- Stav --', canSort: true },
];

export const EXTERNAL_LINK_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'name', displayName: 'Název', type: 'text' },
  { key: 'url', displayName: 'URL adresa', type: 'text' },
  { key: 'position', displayName: 'Pořadí', type: 'text' },
  { key: 'is_active', displayName: 'Aktivní', type: 'text' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Naposledy změněno', type: 'date', format: 'medium' },
];