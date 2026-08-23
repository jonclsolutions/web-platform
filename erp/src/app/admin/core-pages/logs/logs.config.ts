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
 * @bugfix-note (2026-08-15, part 1+2, superseded) Dřívější verze doplnila "Core" a
 * maintenance eventy, ale nikdy nebyla ověřena proti VŠEM core controllerům - obsahovala
 * moduly, které ve skutečnosti patří do web_logs ("News", "SalesOrder", "SupportTicket",
 * "JobApplication", "RawRequestCommission", "BusinessLog", "Translation"), a chyběl jí
 * "Legal" i drtivá většina _denied eventů.
 *
 * @bugfix-note (2026-08-15, part 3 - DEFINITIVNÍ) KOMPLETNÍ PŘEPOČET po plošné kontrole
 * všech pěti core controllerů, které do core_logs skutečně zapisují: AuthController
 * (module='Auth'), CoreRoleController (module='CoreRole'), UserController (module='User'),
 * DocumentSectionController + SiteConfigurationController (obě module='Legal' - právní
 * dokumenty a firemní/site konfigurace sdílí jeden modul, viz jejich vlastní refactor-notes
 * o přesunu z chybného shop_logs). CorePermissionController potvrzen jako čistě read-only -
 * do logu nezapisuje nic. "Core" odstraněno - CoreSiteSettingController, jediný zdroj této
 * hodnoty, byl mezitím smazán (web/shop maintenance migrace). "News"/"SalesOrder"/
 * "SupportTicket"/"JobApplication"/"RawRequestCommission"/"BusinessLog"/"Translation"
 * odstraněny - patří do web_logs, ne core_logs (viz business-logs.config.ts). "Role"
 * opraveno na "CoreRole". "login" opraveno na "login_success"/"login_failed" (přesné
 * event_type hodnoty, které AuthController skutečně zapisuje). "bulk_hard_delete"
 * opraveno na "force_delete_all". Doplněna kompletní sada _denied eventů
 * (create_denied, update_denied, delete_denied, restore_denied, sync_permissions_denied,
 * force_delete_all_denied, password_change_denied) - bezpečnostně nejcitlivější kategorie
 * v celém logu (zamítnuté pokusy o privilege escalation / zásah do cizího/sysadmin účtu),
 * dřív úplně nefiltrovatelná stejně jako unauthorized_maintenance_toggle_attempt.
 *
 * @refactor-note (2026-08-22) BEZPEČNOSTNÍ MONITORING - AUDIT ADMINISTRÁTORSKÝCH AKCÍ:
 * doplněny 4 nové event_type hodnoty zapisované z `CoreSecurityEventController` a
 * `CoreSecuritySettingController` (module zůstává 'Core', stejně jako CoreRole/User/
 * Legal) - `security_retention_updated` (změna GDPR retenční doby),
 * `security_event_triaged` (změna stavu bezpečnostního eventu), `security_event_deleted`
 * (ruční smazání jednoho záznamu), `security_events_purged` (hromadné vyčištění starých
 * záznamů). Samotné zápisy diagnostických eventů (`CoreSecurityEvent::record()` -
 * captcha_failed, throttle_exceeded, scan_probe apod.) se do `core_logs` NEZAPISUJÍ -
 * ty žijí výhradně v `core_security_events` (jiná stránka, jiný účel, viz
 * core-pages/security-events). Tady se loguje jen ADMINISTRÁTORSKÁ AKCE nad monitoringem.
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
  {
    action: 'exportActiveTable',
    label: 'Export',
    icon: '📥',
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
  { key: 'event_type', displayName: 'Typ události', type: 'text' },
  { key: 'module', displayName: 'Systémový modul', type: 'text' },
  { key: 'description', displayName: 'Podrobný popis', type: 'text' },
  { key: 'affected_entity_type', displayName: 'Tabulka / Entita', type: 'text' },
  { key: 'affected_entity_id', displayName: 'ID záznamu entity', type: 'text' },
  { key: 'user_id_plain', displayName: 'ID uživatele', type: 'text' },
  { key: 'user_plain', displayName: 'Uživatel', type: 'text' },
  { key: 'context_data', displayName: 'Payload / JSON Data', type: 'text' }
];