import * as Core from '../../../shared/imports/core-providers';

export const SHIPPING_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔍', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' } // 👈 Vráceno pro možnost mazání custom metod
];

export const SHIPPING_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },
     { action: 'triggerImport', label: 'Importovat data', icon: '', class: 'btn-neutral', showIf: true },
     { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  { action: 'toggleTable', label: 'Zobrazit koš', icon: '', class: 'btn-trash', permission: 'view-deleted' }
];

export const SHIPPING_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'code',
    label: 'Kód metody',
    placeholder: 'např. ppl_parcel',
    type: 'text',
    required: true,
    pattern: '^[a-z0-9_-]{3,50}$',
    errorMessage: 'Kód musí mít 3-50 znaků (malá písmena, čísla, podtržítka).',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'name',
    label: 'Název dopravy',
    placeholder: 'Zadejte název pro zákazníka',
    type: 'text',
    required: true,
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'shipping_type',
    label: 'Typ dopravy',
    type: 'select',
    options: [
      { value: 'address', label: 'Doručení na adresu' },
      { value: 'pickup_point', label: 'Výdejní místo' },
      { value: 'store', label: 'Osobní odběr' }
    ],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'base_price',
    label: 'Základní cena (Kč)',
    type: 'number',
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'allows_cod',
    label: 'Podporuje dobírku?',
    type: 'select',
    options: [{ value: '1', label: 'Ano' }, { value: '0', label: 'Ne' }],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'cod_price',
    label: 'Příplatek za dobírku (Kč)',
    placeholder: '0',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'free_shipping_threshold',
    label: 'Doprava zdarma od (Kč)',
    placeholder: '0 = není zdarma',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'max_weight',
    label: 'Max. váha (kg)',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'requires_pickup_point',
    label: 'Vyžaduje výdejní místo?',
    type: 'select',
    options: [{ value: '1', label: 'Ano (Zásilkovna apod.)' }, { value: '0', label: 'Ne' }],
    required: true,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'delivery_days_min',
    label: 'Doručení min (dny)',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'delivery_days_max',
    label: 'Doručení max (dny)',
    type: 'number',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'tracking_url',
    label: 'Tracking URL',
    placeholder: 'https://.../track?id={T}',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'sort_order',
    label: 'Pořadí',
    type: 'number',
    required: true,
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
    type: 'textarea',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  }
];

export const SHIPPING_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'shipping_type', header: 'Typ', type: 'text' },
  { key: 'base_price', header: 'Cena', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' },
  { key: 'sort_order', header: 'Pořadí', type: 'text' }
];

export const SHIPPING_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Název', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const SHIPPING_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'name', header: 'Název', type: 'text', placeholder: 'Hledat název...', canSort: true },
  { key: 'shipping_type', header: 'Typ', type: 'select', options: ["address", "pickup_point", "store"], placeholder: '-- Typ --', canSort: true },
];

export const SHIPPING_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID', type: 'text' },
  { key: 'code', displayName: 'Interní kód', type: 'text', importable: true },
  { key: 'name', displayName: 'Název dopravy', type: 'text', importable: true },
  { key: 'description', displayName: 'Popis', type: 'text', importable: true },
  {
    key: 'shipping_type', displayName: 'Typ dopravy', type: 'text', importable: true,
    chartable: true, chartPossibleValues: ['address', 'pickup_point', 'store'],
  },
  { key: 'base_price', displayName: 'Základní cena', type: 'text', importable: true },
  { key: 'allows_cod', displayName: 'Podpora dobírky', type: 'boolean', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
  { key: 'cod_price', displayName: 'Cena dobírky', type: 'text', importable: true },
  { key: 'free_shipping_threshold', displayName: 'Zdarma od', type: 'text', importable: true },
  { key: 'max_weight', displayName: 'Max. váha', type: 'text', importable: true },
  { key: 'requires_pickup_point', displayName: 'Vyžaduje výdejnu', type: 'boolean', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
  { key: 'delivery_days_min', displayName: 'Min. dny', type: 'text', importable: true },
  { key: 'delivery_days_max', displayName: 'Max. dny', type: 'text', importable: true },
  { key: 'tracking_url', displayName: 'Sledovací URL', type: 'text', importable: true },
  { key: 'is_active', displayName: 'Aktivní', type: 'boolean', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium', importable: true },
];