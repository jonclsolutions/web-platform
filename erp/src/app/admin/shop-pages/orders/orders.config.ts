import * as Core from '../../../shared/imports/core-providers';

/**
 * ČÍSELNÍKY (OPTIONS)
 * Definováno jako objekty pro kompatibilitu s inteligentním Filter Form Builderem
 */
export const STATUS_OPTIONS = [
  { value: 'pending',    label: 'Přijata' },
  { value: 'confirmed',  label: 'Potvrzena' },
  { value: 'processing', label: 'Zpracovávána' },
  { value: 'shipped',    label: 'Odeslána' },
  { value: 'delivered',  label: 'Doručena' },
  { value: 'canceled',   label: 'Zruseno' },
  { value: 'returned',   label: 'Vraceno' }
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Čeká se na platbu' },
  { value: 'paid', label: 'Zaplacena' },
  { value: 'failed', label: 'Platba selhala' },
  { value: 'refunded', label: 'Vráceny peníze' },
  { value: 'cod', label: 'Dobírka' },
];

/**
 * TLAČÍTKA V LIŠTĚ (TOOLBAR)
 * Tlačítko pro Koš bylo odstraněno, protože bude součástí přepínače tabů
 */
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
    label: 'Nová objednávka',
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
  }
];

/**
 * TLAČÍTKA V TABULCE (AKCE)
 */
export const ORDER_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];

/**
 * SLOUPCE TABULKY (PŘEHLED)
 */
export const ORDER_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'order_number', header: 'Číslo objednávky', type: 'text' },
  { key: 'customer.full_name', header: 'Zákazník', type: 'text' },
  { key: 'status_label', header: 'Stav', type: 'text' },
  { key: 'payment_status_label', header: 'Platba', type: 'text' },
  { key: 'final_amount', header: 'Celkem', type: 'currency' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
];

/**
 * SLOUPCE V KOŠI
 */
export const TRASH_ORDER_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'order_number', header: 'Číslo objednávky', type: 'text' },
  { key: 'customer.full_name', header: 'Zákazník', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

/**
 * FILTRY (MATCHUJÍ S PHP ShopOrderController@index)
 */
export const FILTER_COLUMNS: Core.FilterColumns[] = [
  { 
    key: 'search', 
    header: 'Hledat', 
    type: 'text', 
    placeholder: 'Číslo, email, adresa...', 
    canSort: false 
  },
  { 
    key: 'status', 
    header: 'Stav objednávky', 
    type: 'select', 
    options: STATUS_OPTIONS, 
    placeholder: '-- Všechny stavy --', 
    canSort: true 
  },
  { 
    key: 'payment_status', 
    header: 'Stav platby', 
    type: 'select', 
    options: PAYMENT_STATUS_OPTIONS, 
    placeholder: '-- Všechny platby --', 
    canSort: true 
  },
  { 
    key: 'amount_from', 
    header: 'Cena od', 
    type: 'number', 
    placeholder: 'Min. částka', 
    canSort: false 
  },
  { 
    key: 'amount_to', 
    header: 'Cena do', 
    type: 'number', 
    placeholder: 'Max. částka', 
    canSort: false 
  },
  { 
    key: 'id', 
    header: 'ID', 
    type: 'number', 
    canSort: true, 
    placeholder: 'ID...' 
  },
  { 
    key: 'order_number', 
    header: 'Číslo objednávky', 
    type: 'text', 
    canSort: true, 
    placeholder: 'Číslo...' 
  },
  { 
    key: 'final_amount', 
    header: 'Celková částka', 
    type: 'number', 
    canSort: true, 
    placeholder: 'Částka...' 
  },
  { 
    key: 'created_at', 
    header: 'Datum vytvoření', 
    type: 'date', 
    canSort: true, 
    placeholder: '' 
  }
];

/**
 * DETAIL OBJEDNÁVKY (MODÁL)
 */
export const ORDER_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID objednávky', type: 'text' },
  { key: 'order_number', displayName: 'Číslo objednávky', type: 'text' },
  { key: 'customer.full_name', displayName: 'Zákazník', type: 'text' },
  { key: 'customer.email', displayName: 'Email', type: 'text' },
  { key: 'customer.phone', displayName: 'Telefon', type: 'text' },
  { key: 'status_label', displayName: 'Stav objednávky', type: 'text' },
  { key: 'payment_status_label', displayName: 'Stav platby', type: 'text' },
  { key: 'total_amount', displayName: 'Částka za zboží', type: 'text' },
  { key: 'shipping_amount', displayName: 'Doprava', type: 'text' },
  { key: 'discount_amount', displayName: 'Sleva', type: 'text' },
  { key: 'final_amount', displayName: 'Celkem k úhradě', type: 'text' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'paid_at', displayName: 'Zaplaceno', type: 'date', format: 'medium' },
  { key: 'shipped_at', displayName: 'Odesláno', type: 'date', format: 'medium' },
];

export const ORDER_TAB_BUTTONS: Core.Button[] = [
  { action: 'all', label: 'Všechny objednávky', icon: '📦', class: 'btn-filter', isActive: true },
  { action: 'pending_tasks', label: 'K vyřízení', icon: '⏳', class: 'btn-filter', isActive: false },
  { action: 'trash', label: 'Koš', icon: '🗑️', isActive: false, class: 'btn-trash', permission: 'view-deleted' }
];