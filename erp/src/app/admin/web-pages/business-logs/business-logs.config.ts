/**
 * @file business-logs.config.ts
 * @path src/app/admin/web-pages/business-logs/business-logs.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration (buttons, table/filter/detail columns) for the Web
 * business logs (audit trail) page. Read-only - no FORM_FIELDS, no create/edit/delete
 * buttons, since log entries are never created or edited through the admin UI, only
 * written internally by LogsActivity trait calls throughout the backend.
 *
 * @bugfix-note (2026-08-15, part 3) Doplněn event_type `delete` - CoreExternalLinkController
 * (namespace Api\Core, ale loguje do WebLog::class/module='Web' - externí odkazy patří
 * doménově do Web) používá `delete` pro OBOJÍ soft-delete i force-delete-all, na rozdíl
 * od konvence `soft_delete`/`force_delete_all` používané zbytkem web controllerů. Modul
 * `Web` teď tedy pokrývá jak WebSiteSettingController (maintenance eventy), tak
 * CoreExternalLinkController (create/update/delete/restore externích odkazů) - žádná
 * změna v seznamu `module`, jen v `event_type`.
 */
import * as Core from '../../../shared/imports/core-providers';

export const BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
];

export const TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Filtry',
    icon: '🔍',
    class: 'btn-filter',
    isActive: false
  },
  { action: 'openGraphBuilder', label: 'Grafy a reporty', icon: '📊', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  {
    action: 'exportActiveTable',
    label: 'Export',
    icon: '📥',
    class: 'btn-export',
    showIf: true
  },
];

export const FORM_FIELDS: Core.InputDefinition[] = [];

export const TABLE_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'created_at', header: 'Čas', type: 'date', format: 'short' },
  { key: 'user_plain', header: 'Uživatel', type: 'text' },
  { key: 'event_type', header: 'Akce', type: 'text' },
  { key: 'module', header: 'Modul', type: 'text' },
  { key: 'description', header: 'Popis události', type: 'text' },
  { key: 'origin', header: 'IP adresa', type: 'text' }
];

export const FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID logu', canSort: true },
  { key: 'user_plain', header: 'Uživatel', type: 'text', placeholder: 'Email uživatele', canSort: true },
  {
    key: 'event_type',
    header: 'Událost',
    type: 'select',
    options: [
      "create",
      "update",
      "delete",
      "soft_delete",
      "hard_delete",
      "restore",
      "force_delete_all",
      "export",
      "error",
      "delete_bulk",
      "generate_link",
      "maintenance_status_changed",
      "unauthorized_maintenance_toggle_attempt"
    ],
    placeholder: '-- Typ akce --',
    canSort: true
  },
  {
    key: 'module',
    header: 'Modul',
    type: 'select',
    options: [
      "WebNews",
      "WebJobApplication",
      "WebSalesLead",
      "WebSalesOrder",
      "WebSupportTicket",
      "WebRawRequestCommission",
      "Web",
      "Translation:web"
    ],
    placeholder: '-- Modul --',
    canSort: true
  },
  { key: 'origin', header: 'IP adresa', type: 'text', placeholder: 'Hledat IP', canSort: true }
];

export const DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Záznamu', type: 'text' },
  { key: 'created_at', displayName: 'Čas události', type: 'date', format: 'medium' },
  { key: 'origin', displayName: 'IP adresa zdroje', type: 'text' },
  {
    key: 'event_type', displayName: 'Typ události', type: 'text',
    chartable: true,
    chartPossibleValues: ['create', 'update', 'delete', 'soft_delete', 'hard_delete', 'restore', 'force_delete_all', 'export', 'error', 'delete_bulk', 'generate_link', 'maintenance_status_changed', 'unauthorized_maintenance_toggle_attempt'],
  },
  {
    key: 'module', displayName: 'Systémový modul', type: 'text',
    chartable: true,
    chartPossibleValues: ['WebNews', 'WebJobApplication', 'WebSalesLead', 'WebSalesOrder', 'WebSupportTicket', 'WebRawRequestCommission', 'Web', 'Translation:web'],
  },
  { key: 'description', displayName: 'Podrobný popis', type: 'text' },
  { key: 'affected_entity_type', displayName: 'Tabulka / Entita', type: 'text' },
  { key: 'affected_entity_id', displayName: 'ID záznamu entity', type: 'text' },
  { key: 'user_id_plain', displayName: 'ID uživatele', type: 'text' },
  { key: 'user_plain', displayName: 'Uživatel', type: 'text' },
  { key: 'context_data', displayName: 'Payload / JSON Data', type: 'text' }
];