/**
 * @file job-applications.config.ts
 * @path src/app/admin/web-pages/job-applications/job-applications.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static-turned-dynamic configuration (buttons, form fields, table/filter/
 * detail columns) for the Job Applications (nábor) management page.
 *
 * (Earlier refactor-notes for permission granularization - no "create" button, no
 * `handleCreateFormOpened` - and the openGraphBuilder permission fix are unchanged, see
 * version history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * + "enum hodnoty jako přeložitelné anglické slugy": kompletní přepis na FACTORY
 * FUNKCE, stejný vzor jako ostatní web-pages stránky. `state` PŘEPSÁN z plného
 * českého textu ('Nový'/'Pohovor'/'Vybrán'/'Zamítnut'/'Zásobník') na anglické slugy
 * ('new'/'interview'/'selected'/'rejected'/'pool') - viz SQL migrace
 * `006_state_slugs_web_job_applications.sql` a `UpdateWebJobApplicationRequest`
 * (doplněna `in:...` validace, kterou `state` dřív vůbec neměl), obojí SOUČASNĚ s
 * touto změnou.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'job-applications';

export const JOB_APPLICATION_STATE_VALUES: string[] = ['new', 'interview', 'selected', 'rejected', 'pool'];

const STATE_LABEL_KEYS: Record<string, string> = {
  new: 'state_new',
  interview: 'state_interview',
  selected: 'state_selected',
  rejected: 'state_rejected',
  pool: 'state_pool',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createJobApplicationButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-job-applications-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-job-applications-delete', icon: 'delete' },
  ];
}

export function createJobApplicationToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-job-applications-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createJobApplicationFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'state',
      label: i18n.getValue(`${SECTION}.field_state_label`),
      type: 'select',
      options: mapLabeledOptions(JOB_APPLICATION_STATE_VALUES, STATE_LABEL_KEYS, i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'internal_note',
      label: i18n.getValue(`${SECTION}.field_internal_note_label`),
      placeholder: i18n.getValue(`${SECTION}.field_internal_note_placeholder`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'first_name',
      label: i18n.getValue(`${SECTION}.field_first_name_label`),
      type: 'text',
      editable: false, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'last_name',
      label: i18n.getValue(`${SECTION}.field_last_name_label`),
      type: 'text',
      editable: false, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'position_name',
      label: i18n.getValue(`${SECTION}.field_position_label`),
      type: 'text',
      editable: false, show_in_edit: true, show_in_create: false,
    },
  ];
}

export function createJobApplicationColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'full_name', header: i18n.getValue(`${SECTION}.col_applicant`), type: 'text' },
    { key: 'position_name', header: i18n.getValue(`${SECTION}.col_position`), type: 'text' },
    { key: 'state', header: i18n.getValue(`${SECTION}.col_state`), type: 'text' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_received`), type: 'date', format: 'short' },
  ];
}

export function createJobApplicationTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'full_name', header: i18n.getValue(`${SECTION}.col_applicant`), type: 'text' },
    { key: 'position_name', header: i18n.getValue(`${SECTION}.col_position`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createJobApplicationFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'last_name', header: i18n.getValue(`${SECTION}.filter_last_name_label`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_last_name_placeholder`), canSort: true },
    { key: 'position_name', header: i18n.getValue(`${SECTION}.col_position`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_position_placeholder`), canSort: true },
    { key: 'state', header: i18n.getValue(`${SECTION}.col_state`), type: 'select', options: mapLabeledOptions(JOB_APPLICATION_STATE_VALUES, STATE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_state_placeholder`), canSort: true },
  ];
}

export function createJobApplicationDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'full_name', displayName: i18n.getValue(`${SECTION}.details_full_name`), type: 'text' },
    { key: 'position_name', displayName: i18n.getValue(`${SECTION}.details_position`), type: 'text', chartable: true },
    { key: 'email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text' },
    { key: 'phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text' },
    { key: 'state', displayName: i18n.getValue(`${SECTION}.details_state`), type: 'text', chartable: true, chartPossibleValues: JOB_APPLICATION_STATE_VALUES },
    { key: 'message', displayName: i18n.getValue(`${SECTION}.details_message`), type: 'text' },
    { key: 'internal_note', displayName: i18n.getValue(`${SECTION}.details_internal_note`), type: 'text' },
    { key: 'attachments', displayName: i18n.getValue(`${SECTION}.details_attachments`), type: 'files' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
  ];
}