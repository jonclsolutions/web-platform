/**
 * @file support-tickets.config.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Configuration (buttons, form fields, table / filter / detail columns) of the
 * Helpdesk Support Tickets management page.
 * @note `category` / `state` / `priority` are English slugs ('business' / 'bug' / 'other',
 * 'new' / 'open' / 'closed', 'low' / 'medium' / 'high'), validated by `in:...` in
 * `Store/UpdateWebSupportTicketRequest`. Same recipe as `user-request.config.ts`:
 * 1) `..._VALUES` - canonical English slug, never translated.
 * 2) `..._LABEL_KEYS` - slug -> i18n key (not slug -> text).
 * 3) `mapLabeledOptions()` - `{value,label}` pairs shared by the form field
 *    (`InputDefinition.options`) and the filter (`FilterColumns.options`).
 * @note `TableBuilderComponent.getCellValue()` (default case) looks up `options` in
 * `inputDefinitions` by `column.key` - `category` / `priority` / `state` MUST have `options`
 * on the form field too (not only on the filter), otherwise the table shows the slug instead
 * of the label.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'support-tickets';

/**
 * @description Canonical (NOT translated) values - the real database values.
 */
export const SUPPORT_TICKET_CATEGORY_VALUES: string[] = ['it', 'business', 'bug', 'other'];
export const SUPPORT_TICKET_PRIORITY_VALUES: string[] = ['low', 'medium', 'high'];
export const SUPPORT_TICKET_STATE_VALUES: string[] = ['new', 'open', 'closed'];

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  it: 'category_it',
  business: 'category_business',
  bug: 'category_bug',
  other: 'category_other',
};
const PRIORITY_LABEL_KEYS: Record<string, string> = {
  low: 'priority_low',
  medium: 'priority_medium',
  high: 'priority_high',
};
const STATE_LABEL_KEYS: Record<string, string> = {
  new: 'state_new',
  open: 'state_open',
  closed: 'state_closed',
};

/**
 * @description `value` = canonical slug, `label` = translated text. Shared by the form-field
 * options and the filter-column options.
 */
function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createSupportTicketButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-support-tickets-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-support-tickets-delete', icon: 'delete' },
  ];
}

export function createSupportTicketToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'web-support-tickets-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-support-tickets-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createSupportTicketFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'user_name_plain',
      label: i18n.getValue(`${SECTION}.field_requester_name_label`),
      type: 'text',
      required: false,
      editable: false,
      show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'user_plain',
      label: i18n.getValue(`${SECTION}.field_reply_email_label`),
      type: 'text',
      required: false,
      editable: false,
      show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'subject',
      label: i18n.getValue(`${SECTION}.field_subject_label`),
      placeholder: i18n.getValue(`${SECTION}.field_subject_placeholder`),
      type: 'text',
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'category',
      label: i18n.getValue(`${SECTION}.field_category_label`),
      type: 'select',
      required: true,
      options: mapLabeledOptions(SUPPORT_TICKET_CATEGORY_VALUES, CATEGORY_LABEL_KEYS, i18n),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'priority',
      label: i18n.getValue(`${SECTION}.field_priority_label`),
      type: 'select',
      required: true,
      options: mapLabeledOptions(SUPPORT_TICKET_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'state',
      label: i18n.getValue(`${SECTION}.field_state_label`),
      type: 'select',
      required: false,
      options: mapLabeledOptions(SUPPORT_TICKET_STATE_VALUES, STATE_LABEL_KEYS, i18n),
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'description',
      label: i18n.getValue(`${SECTION}.field_description_label`),
      type: 'textarea',
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'attachment',
      label: i18n.getValue(`${SECTION}.field_attachment_label`),
      type: 'file',
      uploadProfile: 'support_ticket',
      required: false,
      show_in_edit: false,
      show_in_create: true,
    },
  ];
}

export function createSupportTicketColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'subject', header: i18n.getValue(`${SECTION}.col_subject`), type: 'text' },
    { key: 'user_name_plain', header: i18n.getValue(`${SECTION}.col_requester`), type: 'text' },
    { key: 'category', header: i18n.getValue(`${SECTION}.col_category`), type: 'text' },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'text' },
    { key: 'state', header: i18n.getValue(`${SECTION}.col_state`), type: 'text' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' },
  ];
}

export function createSupportTicketTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'subject', header: i18n.getValue(`${SECTION}.col_subject`), type: 'text' },
    { key: 'user_name_plain', header: i18n.getValue(`${SECTION}.col_requester`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

/**
 * @description `category` / `priority` / `state` use the `mapLabeledOptions()` `{value,label}`
 * pairs - the template of `FilterFormBuilderComponent` supports both
 * (`option?.value !== undefined ? option.value : option`).
 */
export function createSupportTicketFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'subject', header: i18n.getValue(`${SECTION}.col_subject`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_subject_placeholder`), canSort: true },
    { key: 'user_name_plain', header: i18n.getValue(`${SECTION}.col_requester`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_requester_placeholder`), canSort: true },
    { key: 'category', header: i18n.getValue(`${SECTION}.col_category`), type: 'select', options: mapLabeledOptions(SUPPORT_TICKET_CATEGORY_VALUES, CATEGORY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_category_placeholder`), canSort: true },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'select', options: mapLabeledOptions(SUPPORT_TICKET_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_priority_placeholder`), canSort: true },
    { key: 'state', header: i18n.getValue(`${SECTION}.col_state`), type: 'select', options: mapLabeledOptions(SUPPORT_TICKET_STATE_VALUES, STATE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_state_placeholder`), canSort: true },
  ];
}

/**
 * @note `chartPossibleValues` are canonical slugs - GraphBuilderComponent has no label mapping
 * yet (see user-request.config.ts).
 */
export function createSupportTicketDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'state', displayName: i18n.getValue(`${SECTION}.details_state`), type: 'text', importable: true, chartable: true, chartPossibleValues: SUPPORT_TICKET_STATE_VALUES },
    { key: 'subject', displayName: i18n.getValue(`${SECTION}.details_subject`), type: 'text', importable: true },
    { key: 'user_name_plain', displayName: i18n.getValue(`${SECTION}.details_requester`), type: 'text', importable: true },
    { key: 'user_plain', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text', importable: true },
    { key: 'category', displayName: i18n.getValue(`${SECTION}.details_category`), type: 'text', importable: true, chartable: true, chartPossibleValues: SUPPORT_TICKET_CATEGORY_VALUES },
    { key: 'priority', displayName: i18n.getValue(`${SECTION}.details_priority`), type: 'text', importable: true, chartable: true, chartPossibleValues: SUPPORT_TICKET_PRIORITY_VALUES },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text', importable: true },
    { key: 'attachments', displayName: i18n.getValue(`${SECTION}.details_attachments`), type: 'files' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
  ];
}