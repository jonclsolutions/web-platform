/**
 * @bugfix-note (2026-09-07) BACKLOG "granularizace shop permissions": nahrazeno
 * nesouvisející `shop-view-reports` (a chybějící permission na Edit/Smazat/Přidat/
 * Import) NOVOU dedikovanou sadou `shop-coupons-view/-create/-update/-delete` -
 * viz migrace 002_shop_permissions_granularization.sql a api.php stejné datum.
 * `openGraphBuilder` zůstává na `shop-view-reports` (grafy/reporty jsou napříč
 * celým e-shopem sdílená permission, ne resource-specific).
 */
import * as Core from '../../../shared/imports/core-providers';

export const COUPON_BUTTONS: Core.TableButtons[] = [
  { display_name: 'Detaily', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  { display_name: 'Edit', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-coupons-update', icon: 'edit' },
  { display_name: 'Smazat', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-coupons-delete', icon: 'delete' },
];

export const COUPON_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true, permission: 'shop-coupons-create' },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },
     { action: 'triggerImport', label: 'Importovat data', icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-coupons-create' },
     { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
  { action: 'toggleTable', label: 'Zobrazit koš', icon: '', class: 'btn-trash', permission: 'view-deleted' }
];

export const COUPON_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'code',
    label: 'Kód kupónu',
    placeholder: 'NAPŘ. LETO20',
    type: 'text',
    required: true,
    pattern: '^[a-zA-Z0-9_-]{3,50}$',
    errorMessage: 'Kód musí mít 3-50 znaků (bez mezer).',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'discount_type',
    label: 'Typ slevy',
    type: 'select',
    options: [
      { value: 'percent', label: 'Procentuální (%)' },
      { value: 'fixed', label: 'Pevná částka (Kč)' }
    ],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'discount_value',
    label: 'Hodnota slevy',
    placeholder: 'Zadejte číslo',
    type: 'number',
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'min_order_amount',
    label: 'Minimální objednávka',
    placeholder: '0',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'max_usage',
    label: 'Max. počet použití',
    placeholder: 'Prázdné = neomezeno',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'applies_to',
    label: 'Platí pro',
    type: 'select',
    options: [
      { value: 'all', label: 'Vše' },
      { value: 'products', label: 'Produkty' },
      { value: 'categories', label: 'Kategorie' }
    ],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'valid_from',
    label: 'Platnost od',
    type: 'date',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'valid_until',
    label: 'Platnost do',
    type: 'date',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'is_active',
    label: 'Aktivní',
    type: 'select',
    options: [{ value: '1', label: 'Ano' }, { value: '0', label: 'Ne' }],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'description',
    label: 'Popis',
    placeholder: 'Interní poznámka...',
    type: 'textarea',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  }
];

export const COUPON_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'code', header: 'Kód', type: 'text' },
  { key: 'discount_type', header: 'Typ', type: 'text' },
  { key: 'discount_value', header: 'Sleva', type: 'text' },
  { key: 'usage_count', header: 'Použito', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' },
  { key: 'valid_until', header: 'Platí do', type: 'date', format: 'short' }
];

export const COUPON_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'code', header: 'Kód', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const COUPON_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'code', header: 'Kód', type: 'text', placeholder: 'Hledat kód...', canSort: true },
  { key: 'discount_type', header: 'Typ', type: 'select', options: ["percent", "fixed"], placeholder: '-- Typ --', canSort: true },
];

export const COUPON_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text', importable: true },
  { key: 'code', displayName: 'Kód kupónu', type: 'text', importable: true },
  { key: 'description', displayName: 'Popis', type: 'text', importable: true },
  {
    key: 'discount_type', displayName: 'Typ slevy', type: 'text', importable: true,
    chartable: true, chartPossibleValues: ['percent', 'fixed'],
  },
  { key: 'discount_value', displayName: 'Hodnota slevy', type: 'text', importable: true },
  { key: 'max_usage', displayName: 'Max. použití', type: 'text', importable: true },
  { key: 'usage_count', displayName: 'Aktuálně použito', type: 'text', importable: true },
  { key: 'min_order_amount', displayName: 'Min. objednávka', type: 'text', importable: true },
  {
    key: 'applies_to', displayName: 'Platí pro', type: 'text', importable: true,
    chartable: true, chartPossibleValues: ['all', 'products', 'categories'],
  },
  { key: 'valid_from', displayName: 'Platí od', type: 'date', format: 'medium', importable: true },
  { key: 'valid_until', displayName: 'Platí do', type: 'date', format: 'medium', importable: true },
  {
    key: 'is_active', displayName: 'Aktivní', type: 'text', importable: true,
    chartable: true, chartPossibleValues: ['1', '0'],
  },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
];