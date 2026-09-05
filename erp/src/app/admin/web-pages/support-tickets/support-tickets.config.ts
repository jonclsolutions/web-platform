/**
 * @file support-tickets.config.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the Helpdesk Support Tickets management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php a
 *      edit-news.config.ts stejné datum): doplněny reálné permission klíče:
 *      - SUPPORT_TICKET_TOOLBAR_BUTTONS: "Přidat tiket" -> `permission: 'web-support-tickets-create'`.
 *        Tickety jsou INTERNÍ (na ICT) - žádná veřejná routa pro ně neexistuje, takže na
 *        rozdíl od sales-leads/sales-orders/job-applications tu `-create` skutečně gatuje
 *        jediný způsob, jak ticket vůbec vznikne (viz api.php refactor-note 2026-08-5).
 *      - SUPPORT_TICKET_BUTTONS: "Edit" -> `web-support-tickets-update`,
 *        "Smazat" -> `web-support-tickets-delete`. "Detaily" zůstává bez permission.
 *
 * @refactor-note (2026-08-23) BULK IMPORT/EXPORT: `SUPPORT_TICKET_DETAILS_COLUMNS` má
 *      u 6 polí nově `importable: true` - musí přesně sedět s
 *      `WebSupportTicketController::IMPORTABLE_COLUMNS`. `user_id` a `attachments`
 *      ZÁMĚRNĚ bez příznaku - import nezná reálné propojení na existující účet a
 *      tabulkový soubor nemůže nést nahraný soubor jako přílohu. `state` je
 *      importovatelné, i když ho `store()` vůbec nepřijímá (viz backend
 *      WebSupportTicketController::buildImportRules()) - import historických/
 *      archivních ticketů může chtít rovnou nastavit finální stav.
 *
 * @bugfix-note (2026-09-07) BACKLOG "permission audit napříč web stránkami":
 * `openGraphBuilder` používal nesouvisející `web-user-requests-view` - opraveno na
 * `web-support-tickets-view` (vlastní view permission téhle stránky).
 */
import * as Core from '../../../shared/imports/core-providers';

export const SUPPORT_TICKET_BUTTONS: Core.TableButtons[] = [
  { display_name: '', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-support-tickets-update' },
  { display_name: '', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-support-tickets-delete' },
];
export const SUPPORT_TICKET_TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Otevřít filtry',
    icon: '',
    class: 'btn-filter',
    isActive: false
  },
  {
    action: 'handleCreateFormOpened',
    label: 'Přidat záznam',
    icon: '',
    class: 'btn-create',
    showIf: true,
    permission: 'web-support-tickets-create'
  },
  {
    action: 'exportActiveTable',
    label: 'Exportovat data',
    icon: '',
    class: 'btn-export',
    showIf: true
  },
  { action: 'triggerImport', label: 'Importovat data', icon: '', class: 'btn-neutral', showIf: true },
  { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-support-tickets-view' },
  {
    action: 'toggleTable',
    label: 'Zobrazit koš',
    icon: '',
    class: 'btn-trash',
    permission: 'view-deleted'
  }
];
export const SUPPORT_TICKET_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'user_name_plain',
    label: 'Jméno žadatele',
    type: 'text',
    required: false,
    editable: false,
    show_in_edit: true, show_in_create: false, 
  },
  {
    column_name: 'user_plain',
    label: 'E-mail pro odpověď',
    type: 'text',
    required: false,
    editable: false,
    show_in_edit: true, show_in_create: false,
  },
  {
    column_name: 'subject',
    label: 'Předmět',
    placeholder: 'O co se jedná?',
    type: 'text',
    required: true,
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'category',
    label: 'Kategorie',
    type: 'select',
    required: true,
    options: [
      { value: 'it', label: 'IT / Technický' },
      { value: 'obchod', label: 'Obchodní' },
      { value: 'chyba', label: 'Chyba' },
      { value: 'ostatni', label: 'Ostatní' }
    ],
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'priority',
    label: 'Priorita',
    type: 'select',
    required: true,
    options: [
      { value: 'low', label: 'Nízká' },
      { value: 'medium', label: 'Střední' },
      { value: 'high', label: 'Vysoká' }
    ],
    editable: true, show_in_edit: true, show_in_create: true
  },
  {   column_name: 'state',
    label: 'Stav tiketu',
    type: 'select',
    required: false,
    options: [
      { value: 'new', label: 'Nový' },
      { value: 'open', label: 'V řešení' },
      { value: 'closed', label: 'Uzavřeno' }
    ],
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'description',
    label: 'Popis',
    type: 'textarea',
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'attachment',
    label: 'Nahrát přílohu',
    type: 'file',
    required: false,
    show_in_edit: false,
    show_in_create: true,
  }
];

export const SUPPORT_TICKET_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'subject', header: 'Předmět', type: 'text' },
  { key: 'user_name_plain', header: 'Žadatel', type: 'text' },
  { key: 'category', header: 'Kategorie', type: 'text' },
  { key: 'priority', header: 'Priorita', type: 'text' },
  { key: 'state', header: 'Stav', type: 'text' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
];

export const SUPPORT_TICKET_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'subject', header: 'Předmět', type: 'text' },
  { key: 'user_name_plain', header: 'Žadatel', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const SUPPORT_TICKET_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID', canSort: true },
  { key: 'subject', header: 'Předmět', type: 'text', placeholder: 'Hledat předmět', canSort: true },
  { key: 'user_name_plain', header: 'Žadatel', type: 'text', placeholder: 'Žadatel', canSort: true },
  { 
    key: 'category', 
    header: 'Kategorie', 
    type: 'select', 
    options: ['it', 'obchod', 'chyba', 'ostatni'], 
    placeholder: '-- Kategorie --', 
    canSort: true 
  },
  { 
    key: 'priority', 
    header: 'Priorita', 
    type: 'select', 
    options: ['low', 'medium', 'high'], 
    placeholder: '-- Priorita --', 
    canSort: true 
  },
  { 
    key: 'state', 
    header: 'Stav', 
    type: 'select', 
    options: ['new', 'open', 'closed'], 
    placeholder: '-- Stav --', 
    canSort: true 
  }
];

/**
 * @refactor-note (2026-08-23) `importable: true` u 6 polí - viz refactor-note v
 * hlavičce souboru. `id`, `user_id`, `attachments`, `created_at` ZÁMĚRNĚ bez tohoto
 * příznaku.
 */
export const SUPPORT_TICKET_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Ticketu', type: 'text' },
  { key: 'state', displayName: 'Stav', type: 'text', importable: true, chartable: true, chartPossibleValues: ['new', 'open', 'closed'] },
  { key: 'subject', displayName: 'Předmět', type: 'text', importable: true },
  { key: 'user_name_plain', displayName: 'Žadatel', type: 'text', importable: true },
  { key: 'user_plain', displayName: 'Email', type: 'text', importable: true },
  { key: 'category', displayName: 'Kategorie', type: 'text', importable: true, chartable: true, chartPossibleValues: ['it', 'obchod', 'chyba', 'ostatni'] },
  { key: 'priority', displayName: 'Priorita', type: 'text', importable: true, chartable: true, chartPossibleValues: ['low', 'medium', 'high'] },
  { key: 'description', displayName: 'Popis problému', type: 'text', importable: true },
  { key: 'attachments', displayName: 'Příloha', type: 'files' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' }
];