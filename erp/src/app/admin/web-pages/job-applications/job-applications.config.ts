/**
 * @file job-applications.config.ts
 * @path src/app/admin/web-pages/job-applications/job-applications.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the Job Applications (nábor) management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php a
 *      edit-news.config.ts stejné datum): doplněny reálné permission klíče:
 *      - JOB_APPLICATION_BUTTONS: "Stav / Poznámka" (edit) -> `web-job-applications-update`,
 *        "Smazat" -> `web-job-applications-delete`. "Detaily" zůstává bez permission.
 *      - JOB_APPLICATION_TOOLBAR_BUTTONS NEMÁ tlačítko "Přidat" (žádný
 *        `handleCreateFormOpened` v HTML - uchazeči vznikají výhradně z veřejného
 *        formuláře `POST /job_applications`). Backend permission
 *        `web-job-applications-create` proto existuje (pro interní API endpoint), ale ve
 *        UI zatím není co gatovat - nic tu tedy NEBYLO přidáno.
 */
import * as Core from '../../../shared/imports/core-providers';

export const JOB_APP_STATUS_OPTIONS = [
  { value: 'Nový', label: 'Nový uchazeč' },
  { value: 'Pohovor', label: 'Pozván na pohovor' },
  { value: 'Vybrán', label: 'Vybrán / Nabídka' },
  { value: 'Zamítnut', label: 'Zamítnut' },
  { value: 'Zásobník', label: 'V databázi (do budoucna)' }
];
export const JOB_APPLICATION_TOOLBAR_BUTTONS: Core.Button[] = [
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
  },
  { action: 'triggerImport', label: 'Import', icon: '📤', class: 'btn-neutral', showIf: true },
  { action: 'openGraphBuilder', label: 'Grafy a reporty', icon: '📊', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  {
    action: 'toggleTable',
    label: 'Koš',
    icon: '🗑️',
    class: 'btn-trash',
    permission: 'view-deleted'
  }
];
export const JOB_APPLICATION_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Stav / Poznámka', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-job-applications-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-job-applications-delete' },
];

export const JOB_APPLICATION_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'state',
    label: 'Stav uchazeče',
    type: 'select',
    options: JOB_APP_STATUS_OPTIONS,
    required: true,
    editable: true, 
    show_in_edit: true, 
    show_in_create: false
  },
  {
    column_name: 'internal_note',
    label: 'Interní poznámka (nevidí uchazeč)',
    placeholder: 'Zadejte výsledek pohovoru, dojem, platové očekávání...',
    type: 'textarea',
    required: false,
    editable: true, 
    show_in_edit: true, 
    show_in_create: false
  },
  {
    column_name: 'first_name',
    label: 'Jméno',
    type: 'text',
    editable: false, 
    show_in_edit: true, 
    show_in_create: false
  },
  {
    column_name: 'last_name',
    label: 'Příjmení',
    type: 'text',
    editable: false,
    show_in_edit: true, 
    show_in_create: false
  },
  {
    column_name: 'position_name',
    label: 'Reakce na pozici',
    type: 'text',
    editable: false,
    show_in_edit: true, 
    show_in_create: false
  }
];

export const JOB_APPLICATION_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'full_name', header: 'Uchazeč', type: 'text' },
  { key: 'position_name', header: 'Pozice', type: 'text' },
  { key: 'state', header: 'Stav', type: 'text' },
  { key: 'created_at', header: 'Doručeno', type: 'date', format: 'short' }
];

export const JOB_APPLICATION_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'full_name', header: 'Uchazeč', type: 'text' },
  { key: 'position_name', header: 'Pozice', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const JOB_APPLICATION_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID', canSort: true },
  { key: 'last_name', header: 'Příjmení', type: 'text', placeholder: 'Hledat příjmení...', canSort: true },
  { key: 'position_name', header: 'Pozice', type: 'text', placeholder: 'Název pozice...', canSort: true },
  { 
    key: 'state', 
    header: 'Stav', 
    type: 'select', 
    options: JOB_APP_STATUS_OPTIONS.map(o => o.value), 
    placeholder: '-- Všechny stavy --', 
    canSort: true 
  }
];

export const JOB_APPLICATION_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Žádosti', type: 'text' },
  { key: 'full_name', displayName: 'Celé jméno', type: 'text' },
  { key: 'position_name', displayName: 'Hlášená pozice', type: 'text', chartable: true },
  { key: 'email', displayName: 'E-mail', type: 'text' },
  { key: 'phone', displayName: 'Telefon', type: 'text' },
  {
    key: 'state', displayName: 'Aktuální stav', type: 'text',
    chartable: true, chartPossibleValues: JOB_APP_STATUS_OPTIONS.map(o => o.value),
  },
  { key: 'message', displayName: 'Průvodní dopis / Zpráva', type: 'text' },
  { key: 'internal_note', displayName: 'Interní poznámka HR', type: 'text' },
  { key: 'attachments', displayName: 'Životopis', type: 'files' },
  { key: 'created_at', displayName: 'Datum doručení', type: 'date', format: 'medium' }
];