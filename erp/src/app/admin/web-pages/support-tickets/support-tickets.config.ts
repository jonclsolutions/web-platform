import * as Core from '../../../shared/imports/core-providers';

export const SUPPORT_TICKET_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];
export const SUPPORT_TICKET_TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Filtry',
    icon: '🔍',
    class: 'btn-filter',
    isActive: false
  },
  {
    action: 'handleCreateFormOpened',
    label: 'Přidat tiket',
    icon: '➕',
    class: 'btn-create',
    showIf: true
  },
  {
    action: 'exportActiveTable',
    label: 'Export',
    icon: '📥',
    class: 'btn-export',
    showIf: true
  },
  {
    action: 'toggleTable',
    label: 'Koš',
    icon: '🗑️',
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
  {
    column_name: 'state',
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

export const SUPPORT_TICKET_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Ticketu', type: 'text' },
  { key: 'state', displayName: 'Stav', type: 'text' },
  { key: 'subject', displayName: 'Předmět', type: 'text' },
  { key: 'user_name_plain', displayName: 'Žadatel', type: 'text' },
  { key: 'user_plain', displayName: 'Email', type: 'text' },
  { key: 'category', displayName: 'Kategorie', type: 'text' },
  { key: 'priority', displayName: 'Priorita', type: 'text' },
  { key: 'description', displayName: 'Popis problému', type: 'text' },
{ key: 'attachments', displayName: 'Příloha', type: 'files' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' }
];