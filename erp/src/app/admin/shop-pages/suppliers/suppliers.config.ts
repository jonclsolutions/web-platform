import * as Core from '../../../shared/imports/core-providers';

export const SUPPLIER_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔍', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];

export const SUPPLIER_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtry', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat', icon: '➕', class: 'btn-create', showIf: true },
  { action: 'exportActiveTable', label: 'Export', icon: '📥', class: 'btn-export', showIf: true },
     { action: 'triggerImport', label: 'Import', icon: '📤', class: 'btn-neutral', showIf: true },
  { action: 'toggleTable', label: 'Koš', icon: '🗑️', class: 'btn-trash', permission: 'view-deleted' }
];

export const SUPPLIER_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'name',
    label: 'Název dodavatele',
    placeholder: 'Zadejte název firmy',
    type: 'text',
    required: true,
    pattern: '^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\\s\\.\\-]{2,200}$',
    errorMessage: 'Název je povinný a musí mít 2-200 znaků.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'ico',
    label: 'IČO',
    placeholder: 'Zadejte IČO',
    type: 'text',
    required: false,
    errorMessage: 'IČO musí být platný text (max 20 znaků).',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'contact_person',
    label: 'Kontaktní osoba',
    placeholder: 'Jméno a příjmení',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'email',
    label: 'Kontaktní e-mail',
    placeholder: 'dodavatel@email.cz',
    type: 'email',
    required: false,
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', // Opravený a spolehlivější regex pro email
    errorMessage: 'Zadejte platnou e-mailovou adresu.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'phone',
    label: 'Telefon',
    placeholder: '+420 123 456 789',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'address',
    label: 'Ulice a č.p.',
    placeholder: 'Zadejte adresu',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'city',
    label: 'Město',
    placeholder: 'Zadejte město',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'postal_code',
    label: 'PSČ',
    placeholder: 'Zadejte PSČ',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'country',
    label: 'Země',
    placeholder: 'Česká republika',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'payment_terms',
    label: 'Platební podmínky',
    placeholder: 'např. Splatnost 14 dní',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'is_active',
    label: 'Aktivní',
    type: 'select',
    options: [
      { value: '1', label: 'Ano' },
      { value: '0', label: 'Ne' }
    ],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'notes',
    label: 'Poznámka',
    placeholder: 'Interní poznámka...',
    type: 'textarea',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  }
];

export const SUPPLIER_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název firmy', type: 'text' },
  { key: 'ico', header: 'IČO', type: 'text' },
  { key: 'email', header: 'Email', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
];

export const SUPPLIER_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název firmy', type: 'text' },
  { key: 'email', header: 'Email', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const SUPPLIER_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'name', header: 'Firma', type: 'text', placeholder: 'Hledat název...', canSort: true },
  { key: 'ico', header: 'IČO', type: 'text', placeholder: 'Hledat IČO...', canSort: true },
  { key: 'email', header: 'Email', type: 'text', placeholder: 'Hledat email...', canSort: true },
  { key: 'is_active', header: 'Aktivní', type: 'select', options: ["1", "0"], placeholder: '-- Stav --', canSort: true },
];

export const SUPPLIER_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID dodavatele', type: 'text' },
  { key: 'name', displayName: 'Název firmy', type: 'text' },
  { key: 'ico', displayName: 'IČO', type: 'text' },
  { key: 'contact_person', displayName: 'Kontaktní osoba', type: 'text' },
  { key: 'email', displayName: 'Email', type: 'text' },
  { key: 'phone', displayName: 'Telefon', type: 'text' },
  { key: 'address', displayName: 'Ulice', type: 'text' },
  { key: 'city', displayName: 'Město', type: 'text' },
  { key: 'postal_code', displayName: 'PSČ', type: 'text' },
  { key: 'country', displayName: 'Země', type: 'text' },
  { key: 'payment_terms', displayName: 'Platební podmínky', type: 'text' },
  { key: 'is_active', displayName: 'Aktivní', type: 'text' },
  { key: 'notes', displayName: 'Poznámka', type: 'text' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Naposledy změněno', type: 'date', format: 'medium' },
];