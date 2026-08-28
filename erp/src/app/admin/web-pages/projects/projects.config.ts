/**
 * @file projects.config.ts
 * @path src/app/admin/web-pages/projects/projects.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration for the customer Project management page.
 * @bugfix-note (2026-08-29) BACKLOG "ID políčka jsou matoucí": `order_id` textový
 * input nahrazen `select` dropdownem - options se plní DYNAMICKY za běhu
 * (ProjectsComponent.loadOrderOptions()), protože statická konstanta v configu
 * nemůže znát seznam realizací z API. Samostatné `lead_id` pole ODSTRANĚNO z
 * formuláře úplně - objednávka (order) už na leada odkazuje sama
 * (`WebSalesOrder.lead_id`), není potřeba ho vybírat znovu zvlášť.
 * @bugfix-note (2026-08-29) `visibility` má `required: true` - viz backend
 * StoreWebProjectRequest stejné datum (nesmí zůstat implicitní/null).
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
  { display_name: '⚙️', header_name: 'Správa', isActive: true, type: 'neutral_button', action: 'generate_form' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-projects-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-projects-delete' },
];

export const PROJECT_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtry', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Nový projekt', icon: '➕', class: 'btn-create', showIf: true, permission: 'web-projects-create' },
  { action: 'exportActiveTable', label: 'Export', icon: '📥', class: 'btn-export', showIf: true },
  { action: 'toggleTable', label: 'Koš', icon: '🗑️', class: 'btn-trash', permission: 'view-deleted' },
];

/**
 * @description `order_id` options je PRÁZDNÉ pole - `ProjectsComponent.loadOrderOptions()`
 * ho před otevřením formuláře doplní reálným seznamem realizací (viz component pro
 * detaily). Bez vybrané realizace vznikne samostatný projekt bez vazby na lead/order.
 */
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
  { column_name: 'contact_email', label: 'Kontaktní e-mail', type: 'email', required: false, editable: true, show_in_edit: true, show_in_create: true },
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
  { key: 'platform', displayName: 'Platforma', type: 'text' },
  { key: 'project_lead', displayName: 'Vedoucí', type: 'text' },
  { key: 'contact_phone', displayName: 'Telefon', type: 'text' },
  { key: 'contact_email', displayName: 'E-mail', type: 'text' },
  { key: 'technologies', displayName: 'Technologie', type: 'text' },
  { key: 'visibility', displayName: 'Viditelnost', type: 'text' },
  { key: 'status', displayName: 'Stav projektu', type: 'text' },
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