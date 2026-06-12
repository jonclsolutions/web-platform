import * as Core from '../../../shared/imports/core-providers';

export const PAYMENT_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔍', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' }
];

export const PAYMENT_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtry', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'exportActiveTable', label: 'Export CSV', icon: '📥', class: 'btn-export', showIf: true }
];

export const PAYMENT_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'name',
    label: 'Název platby',
    placeholder: 'Např. Bankovní převod',
    type: 'text',
    required: true,
    editable: true, show_in_edit: true, show_in_create: false,
  },
  {
    column_name: 'price',
    label: 'Poplatek (Kč)',
    type: 'number',
    required: true,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'bank_account_number',
    label: 'Číslo účtu',
    placeholder: '123456789',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'bank_account_code',
    label: 'Kód banky',
    placeholder: '0100',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'variable_symbol_type',
    label: 'Variabilní symbol',
    type: 'select',
    options: [
      { value: 'order_number', label: 'Číslo objednávky' },
      { value: 'phone_number', label: 'Telefonní číslo' },
      { value: 'none', label: 'Žádný' }
    ],
    required: true,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'sort_order',
    label: 'Pořadí',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'is_active',
    label: 'Aktivní',
    type: 'select',
    options: [{ value: '1', label: 'Ano' }, { value: '0', label: 'Ne' }],
    required: true,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'config',
    label: 'Konfigurace brány (JSON)',
    placeholder: '{"sandbox_public_key": "...", "production_secret": "..."}',
    type: 'textarea',
    required: false,
    editable: true, show_in_edit: true, show_in_create: false
  },
  {
    column_name: 'description',
    label: 'Popis pro zákazníka',
    type: 'textarea',
    required: false,
    editable: true, show_in_edit: true, show_in_create: false
  }
];

export const PAYMENT_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'code', header: 'Kód', type: 'text' },
  { key: 'provider', header: 'Poskytovatel', type: 'text' },
  { key: 'price', header: 'Cena', type: 'currency' },
  { key: 'sort_order', header: 'Pořadí', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' }
];

export const PAYMENT_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'name', header: 'Název', type: 'text', placeholder: 'Hledat název...', canSort: true },
  { key: 'provider', header: 'Poskytovatel', type: 'select', options: ["manual", "stripe", "paypal"], placeholder: '-- Typ --', canSort: true },
];

export const PAYMENT_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'name', displayName: 'Název platby', type: 'text' },
  { key: 'code', displayName: 'Kód', type: 'text' },
  { key: 'price', displayName: 'Cena', type: 'currency' },
  { key: 'provider', displayName: 'Poskytovatel', type: 'text' },
  { key: 'bank_account_number', displayName: 'Číslo účtu', type: 'text' },
  { key: 'bank_account_code', displayName: 'Kód banky', type: 'text' },
  { key: 'variable_symbol_type', displayName: 'Typ VS', type: 'text' },
  { key: 'is_active', displayName: 'Aktivní', type: 'boolean' },
  { key: 'sort_order', displayName: 'Pořadí', type: 'text' },
  { key: 'config', displayName: 'Konfigurace (JSON)', type: 'text' },
  { key: 'description', displayName: 'Popis', type: 'text' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
];