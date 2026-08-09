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
    label: 'Export CSV',
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
    options: ["create", "update", "soft_delete", "hard_delete", "restore", "login", "bulk_hard_delete"],
    placeholder: '-- Typ akce --',
    canSort: true
  },
  {
    key: 'module',
    header: 'Modul',
    type: 'select',
    options: ["Auth", "BusinessLog", "JobApplication", "News", "RawRequestCommission", "Role", "SalesLead", "SalesOrder", "SupportTicket", "Translation", "User"],
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