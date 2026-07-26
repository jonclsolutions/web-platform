import * as Core from '../../../shared/imports/core-providers';

export const ROLE_OPTIONS = [
  { value: '1', label: 'sysadmin' },
  { value: '2', label: 'admin' },
];

export const TABLE_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🔑', header_name: 'Heslo', isActive: true, type: 'neutral_button', action: 'password_reset' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
];

export const TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtrovat', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Nový uživatel', icon: '➕', class: 'btn-create', showIf: true },
  { action: 'exportActiveTable', label: 'Export CSV', icon: '📥', class: 'btn-export', showIf: true },
  { action: 'toggleTable', label: 'Koš', icon: '🗑️', class: 'btn-trash', permission: 'view-deleted' }
];

export const RESET_PASSWORD_FORM_FIELDS: Core.InputDefinition[] = [
  { column_name: 'old_password', label: 'Vaše aktuální heslo (potvrzení)', placeholder: 'Zadejte své heslo', type: 'password', required: true, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'new_password', label: 'Nové heslo uživatele', placeholder: 'Minimálně 8 znaků', type: 'password', required: true, pattern: '^.{8,}$', errorMessage: 'Heslo musí mít 8 a více znaků', editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'new_password_confirmation', label: 'Potvrzení nového hesla', placeholder: 'Zadejte znovu nové heslo', type: 'password', required: true, pattern: '^.{8,}$', errorMessage: 'Heslo musí mít 8 a více znaků', editable: true, show_in_edit: true, show_in_create: true },
];

export const FORM_FIELDS: Core.InputDefinition[] = [
  { 
    column_name: 'user_email', 
    label: 'Přihlašovací e-mail', 
    placeholder: 'jmeno@firma.cz', 
    type: 'email', // Změněno na email pro správnou aktivaci form-builderu
    required: true, 
    pattern: '[^@]+@[^@]+\\.[^@]+', 
    errorMessage: 'Zadejte platný přihlašovací e-mail.', 
    editable: true, 
    show_in_edit: true, 
    show_in_create: true 
  },
  { 
    column_name: 'full_name', 
    label: 'Celé jméno', 
    placeholder: 'Zadejte jméno a příjmení', 
    type: 'text', 
    required: true, 
    errorMessage: 'Jméno je povinné', 
    editable: true, 
    show_in_edit: true, 
    show_in_create: true 
  },
  { 
    column_name: 'contact_email', 
    label: 'Kontaktní e-mail', 
    placeholder: 'soukromy@email.cz', 
    type: 'email', 
    required: false, 
    pattern: '[^@]+@[^@]+\\.[^@]+', 
    errorMessage: 'Neplatný e-mail', 
    editable: true, 
    show_in_edit: true, 
    show_in_create: true 
  },
  { 
    column_name: 'user_password_hash', 
    label: 'Heslo', 
    placeholder: 'Zadejte silné heslo', 
    type: 'confirm-password', 
    required: true, 
    pattern: '^.{8,}$', 
    errorMessage: 'Minimálně 8 znaků', 
    editable: true, 
    show_in_edit: false, 
    show_in_create: true 
  },
  { column_name: 'role_id', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true, errorMessage: 'Vyberte roli uživatele.', editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'phone_number', label: 'Telefon', placeholder: '+420 123 456 789', type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'birth_date', label: 'Datum narození', type: 'date', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'personal_id_num', label: 'Rodné číslo', type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'address', label: 'Trvalé bydliště', type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'bank_account', label: 'Bankovní účet', type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'commission_rate', label: 'Provize (%)', type: 'number', required: true, errorMessage: 'Sazba provize musí být v rozmezí 0 až 100 %.', editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'has_tax_declaration', label: 'Daňové prohlášení', type: 'checkbox', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'internal_note', label: 'Poznámka', type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
  
  { column_name: 'health_insurance', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  { column_name: 'dpp_hours_spent', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true }
];

export const TABLE_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'full_name', header: 'Jméno', type: 'text' },
  { key: 'user_email', header: 'E-mail (Login)', type: 'text' },
  { key: 'roles.0.role_name', header: 'Role', type: 'text' },
  { key: 'last_login_at', header: 'Poslední log', type: 'date', format: 'short' },
];

export const TRASH_TABLE_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'full_name', header: 'Jméno', type: 'text' },
  { key: 'user_email', header: 'E-mail (Login)', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' },
];

export const FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID', canSort: true },
  { key: 'full_name', header: 'Jméno', type: 'text', placeholder: 'Hledat jméno', canSort: true },
  { key: 'user_email', header: 'E-mail', type: 'text', placeholder: 'Hledat e-mail', canSort: true },
  { key: 'role_id', header: 'Role', type: 'select', placeholder: '-- Vyberte roli --', canSort: true, options: ROLE_OPTIONS.map(opt => opt.label) }
];

export const DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID uživatele', type: 'text' },
  { key: 'full_name', displayName: 'Celé jméno', type: 'text' },
  { key: 'user_email', displayName: 'Přihlašovací E-mail', type: 'text' },
  { key: 'roles.0.role_name', displayName: 'Přiřazená role', type: 'text' },
  { key: 'contact_email', displayName: 'Soukromý e-mail', type: 'text' },
  { key: 'phone_number', displayName: 'Telefon', type: 'text' },
  { key: 'birth_date', displayName: 'Datum narození', type: 'date', format: 'medium' },
  { key: 'personal_id_num', displayName: 'Rodné číslo', type: 'text' },
  { key: 'address', displayName: 'Trvalé bydliště', type: 'text' },
  { key: 'bank_account', displayName: 'Bankovní účet', type: 'text' },
  { key: 'commission_rate', displayName: 'Sazba provize', type: 'text' },
  { key: 'has_tax_declaration', displayName: 'Daňové prohlášení', type: 'text' },
  { key: 'internal_note', displayName: 'Interní poznámka', type: 'text' },
  { key: 'created_at', displayName: 'Účet vytvořen', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Poslední změna údajů', type: 'date', format: 'medium' }
];