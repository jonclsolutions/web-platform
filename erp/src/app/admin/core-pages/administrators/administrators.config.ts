/**
 * @file administrators.config.ts
 * @path src/app/admin/core-pages/administrators/administrators.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the Administrators (core user account) management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU - permission klíče na
 *      toolbar/table tlačítkách.
 * @refactor-note (2026-08-16) BACKLOG "captcha + 2FA na mail", body 2+3+4: FORM_FIELDS
 * rozděleno na DVĚ samostatná 2FA pole:
 * - `enable_2fa` ("Zapnout 2FA") - self-service styl, editovatelné kýmkoliv s
 *   core-administrators-update, ale AdministratorsComponent ho dynamicky disabluje,
 *   pokud je cílová role vynucená (admin/sysadmin/forces_2fa role) - viz
 *   computeFieldsForTarget() v komponentě. Backend navíc vždy vynucuje true a vrací
 *   422 při pokusu explicitně vypnout (červená notifikace).
 * - `two_fa_forced_by_admin` ("Vynutit 2FA") - VIDITELNÉ pouze pro sysadmin (filtrováno
 *   v komponentě, ne staticky zde), umožňuje vynutit 2FA konkrétnímu účtu nezávisle na
 *   jeho vlastní volbě. `show_in_create: false` - nelze nastavit při vytváření účtu
 *   (backend to explicitně odmítá, dává smysl jen jako následná úprava).
 * @refactor-note (2026-08-24) BACKLOG "workflow zakládání účtů z adminu":
 * - Pole `user_password_hash` ÚPLNĚ ODSTRANĚNO z `FORM_FIELDS` - formulář na vytvoření
 *   účtu už heslo nesbírá vůbec. Uživatel si ho nastaví sám přes aktivační e-mail (viz
 *   info banner v administrators.component.html).
 * - Přidáno `is_blocked` ("Blokovat účet") - `show_in_create: false` (nový účet nikdy
 *   nevzniká rovnou zablokovaný), editovatelnost u chráněných rolí (admin/sysadmin)
 *   řeší dynamicky komponenta stejným vzorem jako `enable_2fa` (viz
 *   computeFieldsForTarget() - `isNeverBlockableRole()`).
 * - `TABLE_BUTTONS` doplněno o "Aktivace" (resend_activation) - vždy viditelné (klient
 *   i backend samostatně kontrolují, že dává smysl jen pro neaktivované účty).
 * - `TABLE_COLUMNS`/`DETAILS_COLUMNS` doplněny o `is_blocked`/`activated_at`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { PASSWORD_PATTERN, PASSWORD_ERROR_MESSAGE } from '../../../shared/constants/password-policy';

export const ROLE_OPTIONS: { value: string; label: string }[] = [];

export const TABLE_BUTTONS: Core.TableButtons[] = [
  { display_name: 'Detaily', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  { display_name: 'Edit', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'core-administrators-update', icon: 'edit' },
  { display_name: 'Heslo', header_name: 'Heslo', isActive: true, type: 'neutral_button', action: 'password_reset', permission: 'core-administrators-update', icon: 'key' },
  {
    display_name: 'Aktivace', header_name: 'Aktivace', isActive: true, type: 'neutral_button',
    action: 'resend_activation', permission: 'core-administrators-update', icon: 'mail',
    visibleWhen: (item: any) => !item.activated_at,
  },
  { display_name: 'Smazat', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'core-administrators-delete', icon: 'delete' },
];

export const TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true, permission: 'core-administrators-create' },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },
  // NOVÉ (2026-08-25): BACKLOG "core-admin-email-domain-restriction" - VÝHRADNĚ
  // sysadmin (žádné `permission` pole zde - viditelnost řídí komponenta přes
  // `this.isSysadmin` v toolbarButtons getteru, stejný vzor jako filtrování
  // `two_fa_forced_by_admin` pole ve formuláři).
  { action: 'openEmailAccessPolicy', label: 'Domény e-mailů', icon: '🌐', class: 'btn-neutral', showIf: true },
  { action: 'openGraphBuilder', label: 'Grafy a reporty', icon: '📊', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
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
 * @refactor-note (2026-08-24) `user_password_hash` pole SMAZÁNO celé - účet vzniká bez
 * hesla, viz hlavička souboru. Přidáno `is_blocked`.
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
  { column_name: 'role_id', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true, errorMessage: 'Vyberte roli uživatele.', editable: true, show_in_edit: true, show_in_create: true },
  {
    column_name: 'enable_2fa',
    label: 'Zapnout 2FA',
    type: 'checkbox',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'two_fa_forced_by_admin',
    label: 'Vynutit 2FA (sysadmin)',
    type: 'checkbox',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: false
  },
  {
    column_name: 'is_blocked',
    label: 'Blokovat účet',
    type: 'checkbox',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: false
  },
  { column_name: 'internal_note', label: 'Poznámka', type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
  { column_name: 'dpp_hours_spent', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true }
];

export const TABLE_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'full_name', header: 'Jméno', type: 'text' },
  { key: 'user_email', header: 'E-mail (Login)', type: 'text' },
  { key: 'roles.0.role_name', header: 'Role', type: 'text' },
  { key: 'is_blocked', header: 'Blokován', type: 'boolean' },
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
  { key: 'is_blocked', displayName: 'Účet zablokován', type: 'text', chartable: true },
  { key: 'activated_at', displayName: 'Aktivováno', type: 'date', format: 'medium' },
  { key: 'enable_2fa', displayName: 'Dvoufaktorové ověření (vlastní volba)', type: 'text', chartable: true },
  { key: 'two_fa_forced_by_admin', displayName: '2FA vynuceno sysadminem', type: 'text', chartable: true },
  { key: 'internal_note', displayName: 'Interní poznámka', type: 'text' },
  { key: 'created_at', displayName: 'Účet vytvořen', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Poslední změna údajů', type: 'date', format: 'medium' }
];