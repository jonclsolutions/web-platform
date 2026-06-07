import * as Core from '../../../shared/imports/core-providers';

export const TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Filtry',
    icon: '🔍',
    class: 'btn-filter',
    isActive: false
  },
  {
    action: 'handleCreateFormOpened',
    label: 'Nový produkt',
    icon: '➕',
    class: 'btn-create',
    showIf: true
  },
  {
    action: 'exportActiveTable',
    label: 'Export CSV',
    icon: '📥',
    class: 'btn-export',
    showIf: true
  },
  {
    action: 'toggleTrash',
    label: 'Koš',
    icon: '🗑️',
    class: 'btn-trash',
    permission: 'shop-products-delete'
  }
];

export const PRODUCT_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '⚙️', header_name: 'Varianty', isActive: true, type: 'neutral_button', action: 'custom_prod_var' },
  { display_name: '🖼️', header_name: 'Obrázky', isActive: true, type: 'neutral_button', action: 'custom_prod_img' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];

export const PRODUCT_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'name',
    label: 'Název produktu',
    placeholder: 'Např. iPhone 15 Pro',
    type: 'text',
    required: true,
    errorMessage: 'Název produktu je povinný.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'sku',
    label: 'SKU (Kód)',
    placeholder: 'APPLE-I15P-BLK',
    type: 'text',
    required: true,
    errorMessage: 'Kód produktu (SKU) je povinný.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'category_id',
    label: 'Kategorie',
    type: 'select',
    options: [], 
    required: true,
    errorMessage: 'Vyberte kategorie.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'supplier_id',
    label: 'Dodavatel',
    type: 'select',
    options: [], 
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'price_czk',
    label: 'Cena CZK (s DPH)',
    type: 'number',
    required: true,
    errorMessage: 'Zadejte cenu v CZK.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'price_eur',
    label: 'Cena EUR (s DPH)',
    type: 'number',
    required: true,
    errorMessage: 'Zadejte cenu v EUR.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },

  // 🌟 PŘIDEJ TYTO DVA BLOKY SEM:
  {
    column_name: 'cost_price_czk',
    label: 'Pořizovací cena CZK',
    placeholder: 'Např. nákupní cena od dodavatele',
    type: 'number',
    required: false, // nemusí být povinná
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'cost_price_eur',
    label: 'Pořizovací cena EUR',
    placeholder: 'Např. nákupní cena od dodavatele',
    type: 'number',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },

  {
    column_name: 'stock_quantity',
    label: 'Skladové množství',
    type: 'number',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'description',
    label: 'Popis produktu',
    type: 'textarea',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'is_active',
    label: 'Aktivní',
    type: 'checkbox',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'is_featured',
    label: 'Doporučené',
    type: 'checkbox',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  }
];

export const TRASH_PRODUCT_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Produkt', type: 'text' },
  { key: 'sku', header: 'SKU', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID', canSort: true },
  { key: 'search', header: 'Hledat', type: 'text', placeholder: 'Název, SKU, popis...', canSort: false },
  { key: 'category_id', header: 'Kategorie', type: 'select', options: [], placeholder: '-- Kategorie --', canSort: true },
  { key: 'supplier_id', header: 'Dodavatel', type: 'select', options: [], placeholder: '-- Dodavatel --', canSort: true },
  { key: 'low_stock', header: 'Nízký sklad', type: 'checkbox', canSort: false, placeholder: ''},
  { key: 'is_active', header: 'Pouze aktivní', type: 'checkbox', canSort: true, placeholder: '' }
];

export const PRODUCT_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'name', header: 'Produkt', type: 'text' },
  { key: 'sku', header: 'SKU', type: 'text' },
  { key: 'category_name', header: 'Kategorie', type: 'text' }, 
  
  // 🌟 Konfigurace s dynamickou měnou:
  { key: 'price_czk', header: 'Cena CZK', type: 'currency', currencyCode: 'CZK' }, 
  { key: 'price_eur', header: 'Cena EUR', type: 'currency', currencyCode: 'EUR' }, 
  
  // Do budoucna velmi snadno rozšíříš o:
  // { key: 'price_usd', header: 'Cena USD', type: 'currency', currencyCode: 'USD' }, 

  { key: 'stock_quantity', header: 'Skladem', type: 'text' },
  { key: 'is_active', header: 'Aktivní', type: 'boolean' }
];

export const PRODUCT_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID produktu', type: 'text' },
  { key: 'name', displayName: 'Název', type: 'text' },
  { key: 'slug', displayName: 'Slug (URL)', type: 'text' },
  { key: 'sku', displayName: 'SKU kód', type: 'text' },
  { key: 'category_name', displayName: 'Kategorie', type: 'text' },
  { key: 'supplier_name', displayName: 'Dodavatel', type: 'text' },
  { key: 'price_czk', displayName: 'Cena CZK (s DPH)', type: 'text' },
  { key: 'price_eur', displayName: 'Cena EUR (s DPH)', type: 'text' },
  { key: 'stock_quantity', displayName: 'Celkový sklad', type: 'text' },
  { key: 'description', displayName: 'Popis', type: 'text' },
  { key: 'is_active', displayName: 'Stav aktivace', type: 'boolean' },
  { key: 'is_featured', displayName: 'Doporučený produkt', type: 'boolean' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Naposledy upraveno', type: 'date', format: 'medium' }
];