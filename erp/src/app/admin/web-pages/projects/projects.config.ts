/**
 * @file projects.config.ts
 * @path src/app/admin/web-pages/projects/projects.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration for the customer Project management page.
 * @refactor-note (2026-08-29b) BACKLOG "sjednotit web/projects a web/project-threads
 * do jedné feature": PROJECT_THREAD_* konstanty (dřív ve zvlášť souboru
 * project-threads.config.ts) přesunuty sem - cross-project tabulka požadavků teď
 * žije jako druhá tabulka POD tabulkou projektů v `ProjectsComponent`, ne jako
 * samostatná stránka/routa.
 */
import * as Core from '../../../shared/imports/core-providers';

export const PROJECT_PLATFORM_OPTIONS: string[] = ['Web', 'Mobilní', 'Desktopová', 'AI', 'Jiné'];

export const PROJECT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'new', label: 'Nový' },
  { value: 'development', label: 'Ve vývoji' },
  { value: 'finished', label: 'Dokončeno' },
];

export const PROJECT_VISIBILITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'private', label: 'Neveřejný (private) — zákazník se NEDOKÁŽE přihlásit' },
  { value: 'public', label: 'Veřejný (public) — zákazník se dokáže přihlásit' },
];

export const PROJECT_BUTTONS: Core.TableButtons[] = [
  { display_name: 'Správa', header_name: 'Správa', isActive: true, type: 'neutral_button', action: 'generate_form', icon: 'settings' },
  { display_name: 'Edit', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-projects-update', icon: 'edit' },
  { display_name: 'Smazat', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-projects-delete', icon: 'delete' },
];

export const PROJECT_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true, permission: 'web-projects-create' },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },
  { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  { action: 'toggleTable', label: 'Zobrazit koš', icon: '', class: 'btn-trash', permission: 'view-deleted' },
];

export const PROJECT_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'order_id',
    label: 'Realizace (nepovinné)',
    type: 'select',
    options: [{ value: '', label: '— Bez realizace (samostatný projekt) —' }],
    required: false,
    editable: true, show_in_edit: false, show_in_create: true,
  },
  { column_name: 'name', label: 'Název projektu', type: 'text', required: true, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'description', label: 'Popis projektu', type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'platform', label: 'Platforma', type: 'select', options: PROJECT_PLATFORM_OPTIONS.map(v => ({ value: v, label: v })), required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'project_lead', label: 'Vedoucí projektu', type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'contact_phone', label: 'Kontaktní telefon', type: 'tel', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'contact_email', label: 'Kontaktní e-mail (i notifikace o aktivitě zákazníka)', type: 'email', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'technologies', label: 'Technologie', type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'visibility', label: 'Viditelnost', type: 'select', options: PROJECT_VISIBILITY_OPTIONS, required: true, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'status', label: 'Stav projektu', type: 'select', options: PROJECT_STATUS_OPTIONS, required: false, editable: true, show_in_edit: true, show_in_create: true },
];

export const PROJECT_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'platform', header: 'Platforma', type: 'text' },
  { key: 'visibility', header: 'Viditelnost', type: 'text' },
  { key: 'status', header: 'Stav', type: 'text' },
  { key: 'project_lead', header: 'Vedoucí', type: 'text' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' },
];

export const PROJECT_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' },
];

export const PROJECT_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'name', header: 'Název', type: 'text', placeholder: 'Hledat název...', canSort: true },
  { key: 'visibility', header: 'Viditelnost', type: 'select', options: PROJECT_VISIBILITY_OPTIONS, placeholder: '-- Viditelnost --', canSort: true },
  { key: 'status', header: 'Stav', type: 'select', options: PROJECT_STATUS_OPTIONS, placeholder: '-- Stav --', canSort: true },
  { key: 'platform', header: 'Platforma', type: 'select', options: PROJECT_PLATFORM_OPTIONS, placeholder: '-- Platforma --', canSort: true },
];

export const PROJECT_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'name', displayName: 'Název', type: 'text' },
  { key: 'description', displayName: 'Popis', type: 'text' },
  { key: 'platform', displayName: 'Platforma', type: 'text', chartable: true, chartPossibleValues: PROJECT_PLATFORM_OPTIONS },
  { key: 'project_lead', displayName: 'Vedoucí', type: 'text' },
  { key: 'contact_phone', displayName: 'Telefon', type: 'text' },
  { key: 'contact_email', displayName: 'E-mail', type: 'text' },
  { key: 'technologies', displayName: 'Technologie', type: 'text' },
  { key: 'visibility', displayName: 'Viditelnost', type: 'text', chartable: true, chartPossibleValues: PROJECT_VISIBILITY_OPTIONS.map(o => o.value) },
  { key: 'status', displayName: 'Stav projektu', type: 'text', chartable: true, chartPossibleValues: PROJECT_STATUS_OPTIONS.map(o => o.value) },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
];
export const CHECKPOINT_STATUS_CYCLE: Record<string, string> = {
  new: 'active',
  active: 'done',
  done: 'new',
};

export const CHECKPOINT_STATUS_LABELS: Record<string, string> = {
  new: 'Nezahájeno',
  active: 'Rozpracováno',
  done: 'Hotovo',
};

// ── Cross-project tabulka požadavků (dřív project-threads.config.ts) ────────

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
  { display_name: 'Vlákno', header_name: 'Vlákno', isActive: true, type: 'info_button', action: 'details', icon: 'chat' },
];

export const PROJECT_THREAD_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleThreadsFilters', label: 'Filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'exportThreadsTable', label: 'Export', icon: '', class: 'btn-export', showIf: true },
];

export const PROJECT_THREAD_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'project_id', header: 'ID projektu', type: 'text', placeholder: 'ID projektu...', canSort: false },
  { key: 'priority', header: 'Priorita', type: 'select', options: ['low', 'medium', 'high', 'critic'], placeholder: '-- Priorita --', canSort: true },
  { key: 'status', header: 'Stav', type: 'select', options: PROJECT_THREAD_STATUS_OPTIONS, placeholder: '-- Stav --', canSort: true },
];

export const PROJECT_THREAD_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'project_name', displayName: 'Projekt', type: 'text', chartable: true },
  { key: 'subject', displayName: 'Téma', type: 'text' },
  { key: 'priority', displayName: 'Priorita', type: 'text', chartable: true, chartPossibleValues: ['low', 'medium', 'high', 'critic'] },
  { key: 'status', displayName: 'Stav', type: 'text', chartable: true, chartPossibleValues: PROJECT_THREAD_STATUS_OPTIONS.map(o => o.value) },
];