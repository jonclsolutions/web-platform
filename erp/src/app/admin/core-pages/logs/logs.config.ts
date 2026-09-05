/**
 * @file logs.config.ts
 * @path src/app/admin/core-pages/logs/logs.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration (buttons, table/filter/detail columns) for the Core
 * system logs (audit trail) page. Read-only - no FORM_FIELDS, no create/edit/delete
 * buttons, since log entries are never created or edited through the admin UI, only
 * written internally by LogsActivity trait calls throughout the backend.
 *
 * (Earlier bugfix-notes for the 2026-08-15 module/event_type recalculation and the
 * 2026-08-22 security-audit event types are unchanged - see version history.)
 *
 * @bugfix-note (2026-09-07) BACKLOG "permission audit napříč core stránkami":
 * `openGraphBuilder` používal `permission: 'web-user-requests-view'` - nesouvisející
 * permission z web sekce, zjevně zkopírovaná z jiné stránky. Opraveno na `view-core` -
 * neexistuje žádná dedikovaná `core-logs-*`/`core-audit-*` permission pro tuto
 * stránku (audit log nemá vlastní CRUD sadu, jen read-only přístup gatovaný na
 * úrovni Core sekce jako celku), takže `view-core` (oprávnění nutné k tomu, aby se
 * uživatel na tuhle stránku vůbec dostal) je nejbližší smysluplná hranice - kdo
 * stránku vidí, smí si její data i vygrafovat. Pokud v budoucnu vznikne dedikovaná
 * permission pro audit log, přepnout na ni.
 */
import * as Core from '../../../shared/imports/core-providers';

export const BUTTONS: Core.TableButtons[] = [
  { display_name: 'Detaily', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details', icon: 'search' },
];
export const TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Otevřít filtry',
    icon: '',
    class: 'btn-filter',
    isActive: false
  },
  { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'view-core' },
  {
    action: 'exportActiveTable',
    label: 'Exportovat data',
    icon: '',
    class: 'btn-export',
    showIf: true
  }
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
      "create_denied",
      "update",
      "update_denied",
      "soft_delete",
      "hard_delete",
      "delete",
      "delete_denied",
      "restore",
      "restore_denied",
      "force_delete_all",
      "force_delete_all_denied",
      "sync_permissions",
      "sync_permissions_denied",
      "PasswordChanged",
      "password_change_denied",
      "password_notification_rate_limited",
      "login_success",
      "delete_bulk",
      "login_failed",
      "logout",
      "export",
      "error",
      "security_retention_updated",
      "security_event_triaged",
      "security_event_deleted",
      "security_events_purged"
    ],
    placeholder: '-- Typ akce --',
    canSort: true
  },
  {
    key: 'module',
    header: 'Modul',
    type: 'select',
    options: [
      "Auth",
      "CoreRole",
      "User",
      "Legal",
      "Core"
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
    key: 'event_type',
    displayName: 'Typ události',
    type: 'text',
    chartable: true,
    chartPossibleValues: [
      "create", "create_denied", "update", "update_denied", "soft_delete", "hard_delete",
      "delete", "delete_denied", "restore", "restore_denied", "force_delete_all",
      "force_delete_all_denied", "sync_permissions", "sync_permissions_denied",
      "PasswordChanged", "password_change_denied", "password_notification_rate_limited",
      "login_success", "delete_bulk", "login_failed", "logout", "export", "error",
      "security_retention_updated", "security_event_triaged", "security_event_deleted",
      "security_events_purged"
    ],
  },
  {
    key: 'module',
    displayName: 'Systémový modul',
    type: 'text',
    chartable: true,
    chartPossibleValues: ["Auth", "CoreRole", "User", "Legal", "Core"],
  },
  { key: 'description', displayName: 'Podrobný popis', type: 'text' },
  { key: 'affected_entity_type', displayName: 'Tabulka / Entita', type: 'text' },
  { key: 'affected_entity_id', displayName: 'ID záznamu entity', type: 'text' },
  { key: 'user_id_plain', displayName: 'ID uživatele', type: 'text' },
  { key: 'user_plain', displayName: 'Uživatel', type: 'text' },
  { key: 'context_data', displayName: 'Payload / JSON Data', type: 'text' }
];