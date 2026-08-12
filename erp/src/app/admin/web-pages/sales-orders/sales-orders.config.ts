import * as Core from '../../../shared/imports/core-providers';

export const SALES_ORDER_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];

export const SALES_ORDER_TOOLBAR_BUTTONS: Core.Button[] = [
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
  {
    action: 'toggleTable',
    label: 'Koš',
    icon: '🗑️',
    class: 'btn-trash',
    permission: 'view-deleted'
  }
];

/**
 * @refactor-note (2026-08-2) `attachment` (jednosouborové pole, type: 'file') nahrazeno
 * `attachments` (type: 'files', vícenásobný upload) - sedí s backendem, který teď ukládá
 * přílohy do `web_attachments` (viz WebSalesOrderController). `show_in_edit` nastaveno na
 * `true` (dřív `false`) - backend `update()` teď umí přílohy přidávat i při editaci
 * záznamu, ne jen při vytvoření (přidávají se k existujícím, nenahrazují je).
 */
export const SALES_ORDER_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'client_name',
    label: 'Název klienta / Jméno',
    placeholder: 'Zadejte název firmy nebo jméno',
    type: 'text',
    required: true,
    errorMessage: 'Jméno klienta je povinné.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'ico',
    label: 'IČO',
    placeholder: 'Zadejte IČO',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'client_email',
    label: 'E-mail klienta',
    placeholder: 'email@klient.cz',
    type: 'email',
    required: true, 
    pattern: '[^@]+@[^@]+\\.[^@]+',
    errorMessage: 'Neplatný formát e-mailu.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'client_phone',
    label: 'Telefon',
    placeholder: 'Telefonní číslo',
    type: 'tel',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'client_address',
    label: 'Adresa klienta',
    placeholder: 'Ulice, město, PSČ',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'order_description',
    label: 'Popis realizace',
    placeholder: 'Specifikace objednávky...',
    type: 'textarea',
    required: true,
    errorMessage: 'Popis realizace je povinný.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'attachments',
    label: 'Přílohy / Smlouva',
    type: 'files',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'dataProcessingAgreement',
    label: 'Souhlas se zpracováním údajů',
    type: 'checkbox',
    required: true,
    errorMessage: 'Souhlas je povinný.',
    editable: true, show_in_edit: false, show_in_create: true
  }
];

export const SALES_ORDER_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'client_name', header: 'Klient', type: 'text' },
  { key: 'salesman_name', header: 'Obchodník', type: 'text' },
  { key: 'ico', header: 'IČO', type: 'text' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
];

export const SALES_ORDER_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'client_name', header: 'Klient', type: 'text' },
  { key: 'salesman_name', header: 'Obchodník', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const SALES_ORDER_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID', canSort: true },
  { key: 'client_name', header: 'Klient', type: 'text', placeholder: 'Hledat klienta', canSort: true },
  { key: 'salesman_name', header: 'Obchodník', type: 'text', placeholder: 'Hledat obchodníka', canSort: true },
  { key: 'ico', header: 'IČO', type: 'text', placeholder: 'Hledat IČO', canSort: true }
];

/**
 * @refactor-note (2026-08-2) `attachment_url` (type: 'file') nahrazeno `attachments`
 * (type: 'files') - detail teď vypíše VŠECHNY přílohy záznamu, ne jen jednu.
 */
export const SALES_ORDER_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Objednávky', type: 'text' },
  { key: 'client_name', displayName: 'Klient', type: 'text' },
  { key: 'ico', displayName: 'IČO', type: 'text' },
  { key: 'salesman_name', displayName: 'Obchodník', type: 'text' },
  { key: 'client_email', displayName: 'Email', type: 'text' },
  { key: 'client_phone', displayName: 'Telefon', type: 'text' },
  { key: 'client_address', displayName: 'Adresa', type: 'text' },
  { key: 'order_description', displayName: 'Popis realizace', type: 'text' },
  { key: 'attachments', displayName: 'Přílohy / Smlouva', type: 'files' },
  { key: 'created_at', displayName: 'Datum vytvoření', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Poslední změna', type: 'date', format: 'medium' }
];