import * as Core from '../../../shared/imports/core-providers';

export const CUSTOMER_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔍', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '📦', header_name: 'Orders', isActive: true, type: 'neutral_button', action: 'customer_orders' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];

export const CUSTOMER_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },   
  { action: 'triggerImport', label: 'Importovat data', icon: '', class: 'btn-neutral', showIf: true },
  { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  { action: 'toggleTable', label: 'Zobrazit koš', icon: '', class: 'btn-trash', permission: 'view-deleted' }
];

export const CUSTOMER_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'first_name',
    label: 'Jméno',
    placeholder: 'Zadejte jméno',
    type: 'text',
    required: true,
    pattern: '^.{1,100}$',
    errorMessage: 'Jméno je povinné (max. 100 znaků).',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'last_name',
    label: 'Příjmení',
    placeholder: 'Zadejte příjmení',
    type: 'text',
    required: true,
    pattern: '^.{1,100}$',
    errorMessage: 'Příjmení je povinné (max. 100 znaků).',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'email',
    label: 'Email',
    placeholder: 'email@priklad.cz',
    type: 'email',
    required: true,
    pattern: '[^@]+@[^@]+\\.[^@]+',
    errorMessage: 'Zadejte platný email.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'phone',
    label: 'Telefon',
    placeholder: '+420...',
    type: 'tel',
    required: false,
    pattern: '^(\\+?[0-9]{1,3})?[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}$',
    errorMessage: 'Zadejte platné telefonní číslo.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'company',
    label: 'Firma',
    placeholder: 'Název společnosti',
    type: 'text',
    required: false,
    pattern: '^.{0,150}$',
    errorMessage: 'Název firmy může mít maximálně 150 znaků.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'address',
    label: 'Ulice a č.p.',
    placeholder: 'Zadejte adresu',
    type: 'text',
    required: false,
    pattern: '^.{0,255}$',
    errorMessage: 'Adresa může mít maximálně 255 znaků.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'city',
    label: 'Město',
    placeholder: 'Zadejte město',
    type: 'text',
    required: false,
    pattern: '^.{0,100}$',
    errorMessage: 'Název města může mít maximálně 100 znaků.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'postal_code',
    label: 'PSČ',
    placeholder: '123 45',
    type: 'text',
    required: false,
    pattern: '^.{0,10}$',
    errorMessage: 'PSČ může mít maximálně 10 znaků.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'is_active',
    label: 'Aktivní',
    type: 'select',
    options: [{ value: '1', label: 'Ano' }, { value: '0', label: 'Ne' }],
    required: true,
    errorMessage: 'Vyberte status aktivace.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'notes',
    label: 'Poznámka',
    placeholder: 'Interní informace...',
    type: 'textarea',
    required: false,
    pattern: '^.{0,1000}$',
    errorMessage: 'Poznámka může mít maximálně 1000 znaků.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  
  // Skrytá systémová pole
  { column_name: 'user_id', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  { column_name: 'country', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true }
];

export const CUSTOMER_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'last_name', header: 'Příjmení', type: 'text' },
  { key: 'first_name', header: 'Jméno', type: 'text' },
  { key: 'email', header: 'Email', type: 'text' },
  { key: 'phone', header: 'Telefon', type: 'text' },
  { key: 'total_spent', header: 'Celkem utraceno', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' }
];

export const CUSTOMER_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'email', header: 'Email', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const CUSTOMER_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'search', header: 'Hledat', type: 'text', placeholder: 'Jméno, email, telefon...', canSort: false },
  { key: 'is_active', header: 'Status', type: 'select', options: ["1", "0"], placeholder: '-- Aktivní --', canSort: true },
];
export const CUSTOMER_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'first_name', displayName: 'Jméno', type: 'text', importable: true },
  { key: 'last_name', displayName: 'Příjmení', type: 'text', importable: true },
  { key: 'email', displayName: 'Email', type: 'text', importable: true },
  { key: 'phone', displayName: 'Telefon', type: 'text', importable: true },
  { key: 'company', displayName: 'Společnost', type: 'text', importable: true },
  { key: 'address', displayName: 'Adresa', type: 'text', importable: true },
  { key: 'city', displayName: 'Město', type: 'text', importable: true },
  { key: 'postal_code', displayName: 'PSČ', type: 'text', importable: true },
  { key: 'country', displayName: 'Země', type: 'text', importable: true, chartable: true },
  { key: 'total_spent', displayName: 'Celková útrata', type: 'text', importable: true },
  {
    key: 'is_active', displayName: 'Aktivní', type: 'text', importable: true,
    chartable: true, chartPossibleValues: ['1', '0'],
  },
  { key: 'notes', displayName: 'Poznámky', type: 'text', importable: true },
  { key: 'created_at', displayName: 'Registrace', type: 'date', format: 'medium' },
];