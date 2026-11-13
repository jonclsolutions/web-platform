/**
 * @file user-request.config.ts
 * @path src/app/apps/web/admin/user-request/user-request.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the User Request (raw commission requests) management page.
 *
 * @note REFERENCE IMPLEMENTATION of the enum "recipe" of the whole project (Core / Web / Shop):
 * 1) The canonical VALUES array (`..._VALUES`) holds the stable English slug - the real value
 *    stored in the database / sent to the backend. NEVER translate the array itself.
 * 2) `..._LABEL_KEYS` maps slug -> i18n key (not slug -> text).
 * 3) `mapLabeledOptions(SECTION, values, labelKeys, i18n)` returns `{value: slug, label: translated text}`
 *    pairs - usable both for `InputDefinition.options` (form select) and for
 *    `FilterColumns.options` (filter select); `FormBuilderComponent` and
 *    `FilterFormBuilderComponent` both support the `{value,label}` pair
 *    (`option?.value !== undefined ? option.value : option`).
 * 4) `TableBuilderComponent.getCellValue()` (default case) translates the shown table value
 *    automatically - it looks up `value` in `inputDefinitions`, so no table change is needed
 *    while the `[inputDefinitions]="formFields"` binding exists (it does here).
 *
 * @note Known limitation: `GraphBuilderComponent` (see `chartPossibleValues:
 * USER_REQUEST_THEMA_VALUES` in `createUserRequestDetailsColumns()`) renders the chart labels
 * from the RAW API value (`"ai (3×)"` instead of the translated label), because it buckets by
 * `row[col.key]`. A fix needs an optional per-column `labelMap` in `GraphBuilderComponent`
 * (`computeValueCatalog()` / `buildDistributionSection()`).
 */
import * as Core from '../../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { mapLabeledOptions } from '../../../../admin/components/builders/labeled-options';

const SECTION = 'user-request';

/**
 * @description Canonical (NOT translated) values - the real value stored in the database / sent
 * to the backend. English slugs.
 */
export const USER_REQUEST_STATUS_VALUES: string[] = ['new', 'in_progress', 'done', 'cancelled'];
export const USER_REQUEST_PRIORITY_VALUES: string[] = ['low', 'neutral', 'high'];
export const USER_REQUEST_THEMA_VALUES: string[] = ['new_project', 'support', 'careers', 'other'];

const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'status_new',
  in_progress: 'status_in_progress',
  done: 'status_done',
  cancelled: 'status_cancelled',
};
const PRIORITY_LABEL_KEYS: Record<string, string> = {
  low: 'priority_low',
  neutral: 'priority_neutral',
  high: 'priority_high',
};
const THEMA_LABEL_KEYS: Record<string, string> = {
  new_project: 'thema_new_project',
  support: 'thema_support',
  careers: 'thema_careers',
  other: 'thema_other',
};

export function createUserRequestButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: i18n.getValue(`${SECTION}.btn_details`), header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: i18n.getValue(`${SECTION}.btn_edit`), header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-user-requests-update', icon: 'edit' },
    { display_name: i18n.getValue(`${SECTION}.btn_delete`), header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-user-requests-delete', icon: 'delete' },
  ];
}

export function createUserRequestToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'web-user-requests-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true },
    { action: 'openEmailTemplateEditor', label: i18n.getValue(`${SECTION}.toolbar_edit_email_template`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-update' },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' }
  ];
}

export function createUserRequestFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
     {
      column_name: 'thema',
      label: i18n.getValue(`${SECTION}.field_thema_label`),
      type: 'select',
      options: mapLabeledOptions(SECTION, USER_REQUEST_THEMA_VALUES, THEMA_LABEL_KEYS, i18n),
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_thema_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    }, {
      column_name: 'contact_email',
      label: i18n.getValue(`${SECTION}.field_email_label`),
      placeholder: i18n.getValue(`${SECTION}.field_email_placeholder`),
      type: 'email',
      required: true,
      pattern: '[^@]+@[^@]+\\.[^@]+',
      errorMessage: i18n.getValue(`${SECTION}.field_email_error`),
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'contact_phone',
      label: i18n.getValue(`${SECTION}.field_phone_label`),
      placeholder: '+420 123 456 789',
      type: 'tel',
      required: false,
      pattern: '^(\\+?[0-9]{1,3})?[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}$',
      errorMessage: i18n.getValue(`${SECTION}.field_phone_error`),
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'status',
      label: i18n.getValue(`${SECTION}.field_status_label`),
      type: 'select',
      options: mapLabeledOptions(SECTION, USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'priority',
      label: i18n.getValue(`${SECTION}.field_priority_label`),
      type: 'select',
      options: mapLabeledOptions(SECTION, USER_REQUEST_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'order_description',
      label: i18n.getValue(`${SECTION}.field_description_label`),
      placeholder: i18n.getValue(`${SECTION}.field_description_placeholder`),
      type: 'textarea',
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_description_error`),
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'note',
      label: i18n.getValue(`${SECTION}.field_note_label`),
      placeholder: i18n.getValue(`${SECTION}.field_note_placeholder`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'attachments',
      label: i18n.getValue(`${SECTION}.field_attachments_label`),
      type: 'files',
      uploadProfile: 'raw_request_commission',
      required: false,
      show_in_edit: true,
      show_in_create: true
    }
  ];
}

export function createUserRequestColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'text' },
    { key: 'contact_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'text' },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'text' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' }
  ];
}

export function createUserRequestTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'text' },
    { key: 'contact_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' }
  ];
}

export function createUserRequestFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'select', placeholder: i18n.getValue(`${SECTION}.filter_thema_placeholder`), options: mapLabeledOptions(SECTION, USER_REQUEST_THEMA_VALUES, THEMA_LABEL_KEYS, i18n), canSort: true },
    { key: 'contact_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_email_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(SECTION, USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'select', options: mapLabeledOptions(SECTION, USER_REQUEST_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_priority_placeholder`), canSort: true },
  ];
}

/**
 * @description `chartPossibleValues` stays the canonical VALUES array (not translated) -
 * GraphBuilderComponent compares it with the raw API values when bucketing, not with the shown
 * text - see the known limitation in the file header (the chart shows the English slug, not
 * the translated label). `displayName` (column title in the detail and the chart) IS
 * translated.
 */
export function createUserRequestDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'thema', displayName: i18n.getValue(`${SECTION}.details_thema`), type: 'text', importable: true, chartable: true, chartPossibleValues: USER_REQUEST_THEMA_VALUES },
    { key: 'contact_email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text', importable: true },
    { key: 'contact_phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text', importable: true },
    { key: 'status', displayName: i18n.getValue(`${SECTION}.details_status`), type: 'text', importable: true, chartable: true, chartPossibleValues: USER_REQUEST_STATUS_VALUES },
    { key: 'priority', displayName: i18n.getValue(`${SECTION}.details_priority`), type: 'text', importable: true, chartable: true, chartPossibleValues: USER_REQUEST_PRIORITY_VALUES },
    { key: 'order_description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text', importable: true },
    { key: 'note', displayName: i18n.getValue(`${SECTION}.details_note`), type: 'text', importable: true },
    { key: 'attachments', displayName: i18n.getValue(`${SECTION}.details_attachments`), type: 'files' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}