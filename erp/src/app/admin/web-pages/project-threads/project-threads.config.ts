import * as Core from '../../../shared/imports/core-providers';

export const PROJECT_THREAD_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'active', label: 'Aktivní' },
  { value: 'closed', label: 'Uzavřeno' },
];

export const PROJECT_THREAD_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'project_name', header: 'Projekt', type: 'text' },
  { key: 'subject', header: 'Téma', type: 'text' },
  { key: 'priority', header: 'Priorita', type: 'text' },
  { key: 'status', header: 'Stav', type: 'text' },
  { key: 'last_message_at', header: 'Poslední zpráva', type: 'date', format: 'short' },
];

export const PROJECT_THREAD_BUTTONS: Core.TableButtons[] = [
  { display_name: '💬', header_name: 'Vlákno', isActive: true, type: 'info_button', action: 'details' },
];

export const PROJECT_THREAD_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtry', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'exportActiveTable', label: 'Export', icon: '📥', class: 'btn-export', showIf: true },
];

export const PROJECT_THREAD_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'project_id', header: 'ID projektu', type: 'text', placeholder: 'ID projektu...', canSort: false },
  { key: 'priority', header: 'Priorita', type: 'select', options: ['low', 'medium', 'high', 'critic'], placeholder: '-- Priorita --', canSort: true },
  { key: 'status', header: 'Stav', type: 'select', options: PROJECT_THREAD_STATUS_OPTIONS, placeholder: '-- Stav --', canSort: true },
];

export const PROJECT_THREAD_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'project_name', displayName: 'Projekt', type: 'text' },
  { key: 'subject', displayName: 'Téma', type: 'text' },
  { key: 'priority', displayName: 'Priorita', type: 'text' },
  { key: 'status', displayName: 'Stav', type: 'text' },
];