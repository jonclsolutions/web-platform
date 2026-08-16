/**
 * @file administrators.config.ts
 * @path src/app/admin/core-pages/administrators/administrators.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the Administrators (core user account) management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php a
 *      edit-news.config.ts stejné datum): doplněny reálné permission klíče:
 *      - TOOLBAR_BUTTONS: "Nový uživatel" -> `permission: 'core-administrators-create'`.
 *      - TABLE_BUTTONS: "Edit" -> `core-administrators-update`, "Smazat" ->
 *        `core-administrators-delete`. "Heslo" (password_reset) -> rovněž
 *        `core-administrators-update`, protože na backendu `PUT
 *        /core/users/{id}/change-password` sdílí STEJNÝ permission klíč jako běžný
 *        update (`core-administrators-update,id` - viz api.php), ne samostatný klíč.
 *        "Detaily" zůstává bez permission.
 *      @note Klíče přejmenovány z historického `web-manage-administrators` na
 *      `core-administrators-*`, protože stránka reálně žije pod `/core` routou - viz
 *      admin-routing.module.ts stejné datum.
 */
import * as Core from '../../../shared/imports/core-providers';
import { PASSWORD_PATTERN, PASSWORD_ERROR_MESSAGE } from '../../../shared/constants/password-policy';

/**
 * @description Výchozí (prázdný) seznam rolí pro select pole ve formuláři a filtru.
 * @note Dříve bylo natvrdo `[{sysadmin},{admin}]` - teď, když jsou role dynamické
 *       (viz /admin/edit-roles), by to znamenalo, že nově vytvořené custom role
 *       by v tomto formuláři nešlo vůbec vybrat/přiřadit.
 *       Skutečné hodnoty se doplňují za běhu v AdministratorsComponent.loadRoleOptions()
 *       (GET core/roles?no_pagination=true), tohle prázdné pole je jen bezpečný
 *       výchozí stav, než se ten požadavek stihne vrátit.
 */
export const ROLE_OPTIONS: { value: string; label: string }[] = [];

export const TABLE_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'core-administrators-update' },
  { display_name: '🔑', header_name: 'Heslo', isActive: true, type: 'neutral_button', action: 'password_reset', permission: 'core-administrators-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'core-administrators-delete' },
];

export const TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Filtrovat', icon: '🔍', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Nový uživatel', icon: '➕', class: 'btn-create', showIf: true, permission: 'core-administrators-create' },
  { action: 'exportActiveTable', label: 'Export', icon: '📥', class: 'btn-export', showIf: true },
  { action: 'toggleTable', label: 'Koš', icon: '🗑️', class: 'btn-trash', permission: 'view-deleted' }
];

export const RESET_PASSWORD_FORM_FIELDS: Core.InputDefinition[] = [
  { column_name: 'old_password', label: 'Vaše aktuální heslo (potvrzení)', placeholder: 'Zadejte své heslo', type: 'password', required: true, editable: true, show_in_edit: true, show_in_create: true },
  {
    column_name: 'new_password',
    label: 'Nové heslo uživatele',
    placeholder: `${8}-${16} znaků`,
    type: 'confirm-password',
    required: true,
    pattern: PASSWORD_PATTERN,
    errorMessage: PASSWORD_ERROR_MESSAGE,
    editable: true, show_in_edit: true, show_in_create: true
  },
];

/**
 * @refactor-note (2026-08) Odstraněna legacy HR/osobní pole + `commission_rate` /
 * `has_tax_declaration` - viz User.php. `enable_2fa` zůstává ve formuláři/detailu,
 * ale byl odebrán z `TABLE_COLUMNS` (hlavní přehledová tabulka) na žádost - kdo má
 * 2FA zapnuté není informace důležitá na první pohled v přehledu, stačí v detailu
 * záznamu (`DETAILS_COLUMNS`).
 */
export const FORM_FIELDS: Core.InputDefinition[] = [
  { 
    column_name: 'user_email', 
    label: 'Přihlašovací e-mail', 
    placeholder: 'jmeno@firma.cz', 
    type: 'email',
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
    column_name: 'user_password_hash',
    label: 'Heslo',
    placeholder: 'Zadejte silné heslo',
    type: 'confirm-password',
    required: true,
    pattern: PASSWORD_PATTERN,
    errorMessage: PASSWORD_ERROR_MESSAGE,
    editable: true,
    show_in_edit: false,
    show_in_create: true
  },
  // Options se doplňují za běhu (viz ROLE_OPTIONS výše) - toto pole tu zůstává
  // prázdné, dokud AdministratorsComponent nedokončí loadRoleOptions().
  { column_name: 'role_id', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true, errorMessage: 'Vyberte roli uživatele.', editable: true, show_in_edit: true, show_in_create: true },
  { 
    column_name: 'enable_2fa', 
    label: 'Dvoufaktorové ověření (2FA)', 
    type: 'checkbox', 
    required: false, 
    editable: true, 
    show_in_edit: true, 
    show_in_create: true 
  },
  { column_name: 'internal_note', label: 'Poznámka', type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },

  { column_name: 'dpp_hours_spent', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true }
];

// enable_2fa záměrně NENÍ v TABLE_COLUMNS - viz @refactor-note výše, dostupné jen
// ve formuláři a v DETAILS_COLUMNS.
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

// Options se doplňují za běhu (viz ROLE_OPTIONS výše).
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
  { key: 'enable_2fa', displayName: 'Dvoufaktorové ověření', type: 'text' },
  { key: 'two_fa_forced_by_admin', displayName: '2FA vynuceno sysadminem', type: 'text' },
  { key: 'internal_note', displayName: 'Interní poznámka', type: 'text' },
  { key: 'created_at', displayName: 'Účet vytvořen', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Poslední změna údajů', type: 'date', format: 'medium' }
];