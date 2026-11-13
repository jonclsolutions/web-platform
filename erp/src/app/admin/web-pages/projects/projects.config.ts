/**
 * @file projects.config.ts
 * @path src/app/admin/web-pages/projects/projects.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Static-turned-dynamic configuration for the customer Project management
 * list (table, filters, form). The project page itself lives in ../project-detail.
 * @note The order select of the create form exists only while the web application is installed
 *   (hasApp('web')) - a project of a web order.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { mapLabeledOptions } from '../../components/builders/labeled-options';
import { hasApp } from '../../../apps/apps.registry';

const SECTION = 'projects';

export const PROJECT_PLATFORM_VALUES: string[] = ['web', 'mobile', 'desktop', 'ai', 'other'];
export const PROJECT_STATUS_VALUES: string[] = ['new', 'development', 'finished'];
export const PROJECT_VISIBILITY_VALUES: string[] = ['private', 'public'];
export const CHECKPOINT_STATUS_VALUES: string[] = ['new', 'active', 'done'];

const PLATFORM_LABEL_KEYS: Record<string, string> = {
  web: 'platform_web', mobile: 'platform_mobile', desktop: 'platform_desktop',
  ai: 'platform_ai', other: 'platform_other',
};
const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'status_new', development: 'status_development', finished: 'status_finished',
};
const VISIBILITY_LABEL_KEYS: Record<string, string> = {
  private: 'visibility_private', public: 'visibility_public',
};
export const CHECKPOINT_STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'checkpoint_status_new', active: 'checkpoint_status_active', done: 'checkpoint_status_done',
};


/** @description Shared readable map for the checkpoint badge text in the template (`checkpointStatusLabels[cp.status]`). */
export function createCheckpointStatusLabels(i18n: AdminLocalizationService): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of CHECKPOINT_STATUS_VALUES) result[v] = i18n.getValue(`${SECTION}.${CHECKPOINT_STATUS_LABEL_KEYS[v]}`);
  return result;
}

export function createProjectButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_manage`), isActive: true, type: 'neutral_button', action: 'generate_form', icon: 'folder-open' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-projects-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-projects-delete', icon: 'delete' },
  ];
}

export function createProjectToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'web-projects-create' },
    { action: 'openTemplates', label: i18n.getValue(`${SECTION}.toolbar_templates`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-projects-view' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-projects-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

/** @description `— No order (standalone project) —` shared with `loadOrderOptions()` of the component - the same `t()` key in both places. */
export function createNoOrderOptionLabel(i18n: AdminLocalizationService): string {
  return i18n.getValue(`${SECTION}.field_order_none_option`);
}

/** @description `— Nobody —` option of the assignee select (project without a responsible administrator). */
export function createNoAssigneeOptionLabel(i18n: AdminLocalizationService): string {
  return i18n.getValue(`${SECTION}.field_assignee_none_option`);
}

export function createProjectFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  const orderField: Core.InputDefinition[] = hasApp('web') ? [{
    column_name: 'order_id',
    label: i18n.getValue(`${SECTION}.field_order_label`),
    type: 'select',
    options: [{ value: '', label: createNoOrderOptionLabel(i18n) }],
    required: false,
    editable: true, show_in_edit: false, show_in_create: true,
  }] : [];
  return [
    ...orderField,
    {
      column_name: 'template_id',
      label: i18n.getValue(`${SECTION}.field_template_label`),
      type: 'select',
      // Filled by the component from GET project-portal/projects/templates (create only - its checkpoints are copied).
      options: [{ value: '', label: i18n.getValue(`${SECTION}.field_template_none_option`) }],
      required: false,
      editable: true, show_in_edit: false, show_in_create: true,
    },
    { column_name: 'name', label: i18n.getValue(`${SECTION}.field_name_label`), type: 'text', required: true, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'description', label: i18n.getValue(`${SECTION}.field_description_label`), type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'platform', label: i18n.getValue(`${SECTION}.field_platform_label`), type: 'select', options: mapLabeledOptions(SECTION, PROJECT_PLATFORM_VALUES, PLATFORM_LABEL_KEYS, i18n), required: false, editable: true, show_in_edit: true, show_in_create: true },
    {
      column_name: 'assignee_id',
      label: i18n.getValue(`${SECTION}.field_assignee_label`),
      type: 'select',
      // Filled by the component from GET project-portal/projects/assignees (applyAssigneeOptions).
      options: [{ value: '', label: createNoAssigneeOptionLabel(i18n) }],
      required: false, editable: true, show_in_edit: true, show_in_create: true,
    },
    { column_name: 'project_lead', label: i18n.getValue(`${SECTION}.field_lead_label`), type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'contact_phone', label: i18n.getValue(`${SECTION}.field_phone_label`), type: 'tel', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'contact_email', label: i18n.getValue(`${SECTION}.field_email_label`), type: 'email', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'technologies', label: i18n.getValue(`${SECTION}.field_technologies_label`), type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'estimated_completion_from', label: i18n.getValue(`${SECTION}.field_estimated_from_label`), type: 'date', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'estimated_completion_to', label: i18n.getValue(`${SECTION}.field_estimated_to_label`), type: 'date', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'visibility', label: i18n.getValue(`${SECTION}.field_visibility_label`), type: 'select', options: mapLabeledOptions(SECTION, PROJECT_VISIBILITY_VALUES, VISIBILITY_LABEL_KEYS, i18n), required: true, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'status', label: i18n.getValue(`${SECTION}.field_status_label`), type: 'select', options: mapLabeledOptions(SECTION, PROJECT_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), required: false, editable: true, show_in_edit: true, show_in_create: true },
  ];
}

export function createProjectColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'platform', header: i18n.getValue(`${SECTION}.col_platform`), type: 'text' },
    { key: 'visibility', header: i18n.getValue(`${SECTION}.col_visibility`), type: 'text' },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'text' },
    { key: 'project_lead', header: i18n.getValue(`${SECTION}.col_lead`), type: 'text' },
    { key: 'assignee_name', header: i18n.getValue(`${SECTION}.col_assignee`), type: 'text' },
    { key: 'unread_messages_count', header: i18n.getValue(`${SECTION}.col_unread`), type: 'count' },
    { key: 'waiting_threads_count', header: i18n.getValue(`${SECTION}.col_waiting`), type: 'count' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' },
  ];
}

export function createProjectTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createProjectFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_name_placeholder`), canSort: true },
    { key: 'visibility', header: i18n.getValue(`${SECTION}.col_visibility`), type: 'select', options: mapLabeledOptions(SECTION, PROJECT_VISIBILITY_VALUES, VISIBILITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_visibility_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(SECTION, PROJECT_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'platform', header: i18n.getValue(`${SECTION}.col_platform`), type: 'select', options: mapLabeledOptions(SECTION, PROJECT_PLATFORM_VALUES, PLATFORM_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_platform_placeholder`), canSort: true },
    { key: 'unread', header: i18n.getValue(`${SECTION}.filter_unread_label`), type: 'select', options: [{ value: '1', label: i18n.getValue(`${SECTION}.filter_unread_yes`) }], placeholder: i18n.getValue(`${SECTION}.filter_unread_placeholder`), canSort: false },
    { key: 'assigned_to_me', header: i18n.getValue(`${SECTION}.filter_mine_label`), type: 'select', options: [{ value: '1', label: i18n.getValue(`${SECTION}.filter_mine_yes`) }], placeholder: i18n.getValue(`${SECTION}.filter_mine_placeholder`), canSort: false },
  ];
}

export function createProjectDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.details_name`), type: 'text' },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text' },
    { key: 'platform', displayName: i18n.getValue(`${SECTION}.details_platform`), type: 'text', chartable: true, chartPossibleValues: PROJECT_PLATFORM_VALUES },
    { key: 'assignee_name', displayName: i18n.getValue(`${SECTION}.details_assignee`), type: 'text' },
    { key: 'project_lead', displayName: i18n.getValue(`${SECTION}.details_lead`), type: 'text' },
    { key: 'contact_phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text' },
    { key: 'contact_email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text' },
    { key: 'technologies', displayName: i18n.getValue(`${SECTION}.details_technologies`), type: 'text' },
    { key: 'estimated_completion_from', displayName: i18n.getValue(`${SECTION}.details_estimated_from`), type: 'date', format: 'medium' },
    { key: 'estimated_completion_to', displayName: i18n.getValue(`${SECTION}.details_estimated_to`), type: 'date', format: 'medium' },
    { key: 'visibility', displayName: i18n.getValue(`${SECTION}.details_visibility`), type: 'text', chartable: true, chartPossibleValues: PROJECT_VISIBILITY_VALUES },
    { key: 'status', displayName: i18n.getValue(`${SECTION}.details_status`), type: 'text', chartable: true, chartPossibleValues: PROJECT_STATUS_VALUES },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
  ];
}
