/**
 * @file administrators.config.ts
 * @path src/app/admin/core-pages/administrators/administrators.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static-turned-dynamic configuration (buttons, form fields, table/filter/
 * detail columns) for the Administrators (core user account) management page.
 *
 * (Earlier refactor-notes for 2FA split, account-creation workflow, and explicit
 * permission grants are unchanged - see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. `ROLE_OPTIONS`/`PERMISSION_OPTIONS` (dřív
 * exportované MUTABILNÍ pole, prakticky nevyužívané - `AdministratorsComponent` je
 * stejně přepisovalo vlastními `this.roleOptions`/`this.permissionOptions`) ODSTRANĚNY -
 * `createFormFields()`/`createFilterColumns()` vrací `role_id`/`permission_ids` s
 * `options: []`, komponenta je po načtení dat sama doplní (viz `rebuildFormFields()`
 * v `administrators.component.ts`). Role/permission NEJSOU enum hodnoty ve smyslu
 * `mapLabeledOptions()` receptu - jsou to DYNAMICKÁ DATA z DB (názvy rolí, popisy
 * oprávnění), ne pevná sada canonical slugů, takže se nepřekládají.
 *
 * @bugfix-note (2026-09-08) BACKLOG "permission audit napříč core stránkami":
 * `openGraphBuilder` používal `permission: 'web-user-requests-view'` - permission
 * z úplně jiné domény, stejná chyba jako dřív opravená u `sales-leads`/
 * `job-applications`/`external-links`. Opraveno na `core-administrators-view`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { PASSWORD_PATTERN, PASSWORD_ERROR_MESSAGE } from '../../../shared/constants/password-policy';

const SECTION = 'administrators';

export function createTableButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'core-administrators-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_password`), isActive: true, type: 'neutral_button', action: 'password_reset', permission: 'core-administrators-update', icon: 'key' },
    {
      display_name: '', header_name: i18n.getValue(`${SECTION}.btn_activate`), isActive: true, type: 'neutral_button',
      action: 'resend_activation', permission: 'core-administrators-update', icon: 'mail',
      visibleWhen: (item: any) => !item.activated_at,
    },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'core-administrators-delete', icon: 'delete' },
  ];
}

export function createToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'core-administrators-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    // Sysadmin-only (visibility gated in the component via `this.isSysadmin`).
    { action: 'openEmailAccessPolicy', label: i18n.getValue(`${SECTION}.toolbar_email_domains`), icon: '', class: 'btn-neutral', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'core-administrators-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createResetPasswordFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'old_password',
      label: i18n.getValue(`${SECTION}.reset_old_password_label`),
      placeholder: i18n.getValue(`${SECTION}.reset_old_password_placeholder`),
      type: 'password', required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'new_password',
      label: i18n.getValue(`${SECTION}.reset_new_password_label`),
      placeholder: `8-16 ${i18n.getValue(`${SECTION}.reset_new_password_chars_suffix`)}`,
      type: 'confirm-password',
      required: true,
      pattern: PASSWORD_PATTERN,
      errorMessage: PASSWORD_ERROR_MESSAGE,
      editable: true, show_in_edit: true, show_in_create: true,
    },
  ];
}

/**
 * @description `role_id`/`permission_ids` mají `options: []` - komponenta je po
 * async načtení dat sama doplní (viz `rebuildFormFields()` v `.component.ts`), viz
 * refactor-note v hlavičce souboru.
 */
export function createFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'user_email',
      label: i18n.getValue(`${SECTION}.field_email_label`),
      placeholder: i18n.getValue(`${SECTION}.field_email_placeholder`),
      type: 'email', required: true,
      pattern: '[^@]+@[^@]+\\.[^@]+',
      errorMessage: i18n.getValue(`${SECTION}.field_email_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'full_name',
      label: i18n.getValue(`${SECTION}.field_full_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_full_name_placeholder`),
      type: 'text', required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_full_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'role_id', label: i18n.getValue(`${SECTION}.field_role_label`),
      type: 'select', options: [], required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_role_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'permission_ids',
      label: i18n.getValue(`${SECTION}.field_permissions_label`),
      type: 'multiselect', options: [], required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'enable_2fa', label: i18n.getValue(`${SECTION}.field_enable_2fa_label`),
      type: 'checkbox', required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'two_fa_forced_by_admin', label: i18n.getValue(`${SECTION}.field_force_2fa_label`),
      type: 'checkbox', required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'is_blocked', label: i18n.getValue(`${SECTION}.field_is_blocked_label`),
      type: 'checkbox', required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'internal_note', label: i18n.getValue(`${SECTION}.field_internal_note_label`),
      type: 'textarea', required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    { column_name: 'dpp_hours_spent', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  ];
}

export function createTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'full_name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'user_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'roles.0.role_name', header: i18n.getValue(`${SECTION}.col_role`), type: 'text' },
    { key: 'is_blocked', header: i18n.getValue(`${SECTION}.col_blocked`), type: 'boolean' },
    { key: 'last_login_at', header: i18n.getValue(`${SECTION}.col_last_login`), type: 'date', format: 'short' },
  ];
}

export function createTrashTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'full_name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'user_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

/** @description `role_id` má `options: []` - komponenta je po `loadRoleOptions()` doplní (viz `rebuildFormFields()`).
 * @refactor-note (2026-09-08) BACKLOG "chybí filtr na blokované účty": doplněn
 * `is_blocked` select filtr - viz UserController::index() bugfix-note stejné datum
 * (backend `role_id` filtr byl navíc už dřív nefunkční, opraveno zároveň).
 */
export function createFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'full_name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_name_placeholder`), canSort: true },
    { key: 'user_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_email_placeholder`), canSort: true },
    { key: 'role_id', header: i18n.getValue(`${SECTION}.col_role`), type: 'select', placeholder: i18n.getValue(`${SECTION}.filter_role_placeholder`), canSort: true, options: [] },
    {
      key: 'is_blocked', header: i18n.getValue(`${SECTION}.col_blocked`), type: 'select',
      options: [
        { value: '1', label: i18n.getValue('shared.yes') },
        { value: '0', label: i18n.getValue('shared.no') },
      ],
      placeholder: i18n.getValue(`${SECTION}.filter_blocked_placeholder`), canSort: true,
    },
  ];
}

export function createDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'full_name', displayName: i18n.getValue(`${SECTION}.details_full_name`), type: 'text' },
    { key: 'user_email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text' },
    { key: 'roles.0.role_name', displayName: i18n.getValue(`${SECTION}.details_role`), type: 'text' },
    { key: 'user_permissions', displayName: i18n.getValue(`${SECTION}.details_extra_permissions`), type: 'text' },
    { key: 'is_blocked', displayName: i18n.getValue(`${SECTION}.details_blocked`), type: 'text', chartable: true },
    { key: 'activated_at', displayName: i18n.getValue(`${SECTION}.details_activated`), type: 'date', format: 'medium' },
    { key: 'enable_2fa', displayName: i18n.getValue(`${SECTION}.details_2fa_own`), type: 'text', chartable: true },
    { key: 'two_fa_forced_by_admin', displayName: i18n.getValue(`${SECTION}.details_2fa_forced`), type: 'text', chartable: true },
    { key: 'internal_note', displayName: i18n.getValue(`${SECTION}.details_note`), type: 'text' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}