/**
 * @file projects.config.ts
 * @path src/app/admin/web-pages/projects/projects.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for the customer Project management
 * page, including the cross-project customer threads sub-table.
 *
 * (Earlier refactor-notes for the projects/project-threads merge and the
 * openGraphBuilder permission fix are unchanged, see version history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * + "enum hodnoty jako přeložitelné anglické slugy": kompletní přepis na FACTORY
 * FUNKCE. Pět enum skupin, jen JEDNA vyžadovala SQL migraci:
 * - `platform` PŘEPSÁN z plného českého textu ('Web'/'Mobilní'/'Desktopová'/'AI'/
 *   'Jiné') na anglické slugy ('web'/'mobile'/'desktop'/'ai'/'other') - viz SQL
 *   migrace `008_platform_slugs_web_projects.sql` a `Store/UpdateWebProjectRequest`
 *   (doplněna `in:...` validace, kterou `platform` dřív vůbec neměl).
 * - `status` (projekt), `visibility`, checkpoint `status`, thread `status`, thread
 *   `priority` UŽ BYLY anglické slugy - žádná SQL migrace, jen `mapLabeledOptions()`
 *   místo natvrdo psaných českých labelů přímo v `{value,label}` párech.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'projects';

export const PROJECT_PLATFORM_VALUES: string[] = ['web', 'mobile', 'desktop', 'ai', 'other'];
export const PROJECT_STATUS_VALUES: string[] = ['new', 'development', 'finished'];
export const PROJECT_VISIBILITY_VALUES: string[] = ['private', 'public'];
export const CHECKPOINT_STATUS_VALUES: string[] = ['new', 'active', 'done'];
export const PROJECT_THREAD_STATUS_VALUES: string[] = ['active', 'closed'];
export const PROJECT_THREAD_PRIORITY_VALUES: string[] = ['low', 'medium', 'high', 'critic'];

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
const THREAD_STATUS_LABEL_KEYS: Record<string, string> = {
  active: 'thread_status_active', closed: 'thread_status_closed',
};
const THREAD_PRIORITY_LABEL_KEYS: Record<string, string> = {
  low: 'thread_priority_low', medium: 'thread_priority_medium', high: 'thread_priority_high', critic: 'thread_priority_critic',
};

/** @description Checkpoint stav se cyklicky posouvá kliknutím - beze změny, canonical slugy. */
export const CHECKPOINT_STATUS_CYCLE: Record<string, string> = {
  new: 'active',
  active: 'done',
  done: 'new',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

/** @description Sdílená čitelná mapa pro checkpoint badge text v šabloně (`checkpointStatusLabels[cp.status]`). */
export function createCheckpointStatusLabels(i18n: AdminLocalizationService): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of CHECKPOINT_STATUS_VALUES) result[v] = i18n.getValue(`${SECTION}.${CHECKPOINT_STATUS_LABEL_KEYS[v]}`);
  return result;
}

export function createProjectButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_manage`), isActive: true, type: 'neutral_button', action: 'generate_form', icon: 'settings' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-projects-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-projects-delete', icon: 'delete' },
  ];
}

export function createProjectToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'web-projects-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-projects-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

/** @description `— Bez realizace (samostatný projekt) —` sdíleno s `loadOrderOptions()` v komponentě - stejný `t()` klíč na obou místech. */
export function createNoOrderOptionLabel(i18n: AdminLocalizationService): string {
  return i18n.getValue(`${SECTION}.field_order_none_option`);
}

export function createProjectFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'order_id',
      label: i18n.getValue(`${SECTION}.field_order_label`),
      type: 'select',
      options: [{ value: '', label: createNoOrderOptionLabel(i18n) }],
      required: false,
      editable: true, show_in_edit: false, show_in_create: true,
    },
    { column_name: 'name', label: i18n.getValue(`${SECTION}.field_name_label`), type: 'text', required: true, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'description', label: i18n.getValue(`${SECTION}.field_description_label`), type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'platform', label: i18n.getValue(`${SECTION}.field_platform_label`), type: 'select', options: mapLabeledOptions(PROJECT_PLATFORM_VALUES, PLATFORM_LABEL_KEYS, i18n), required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'project_lead', label: i18n.getValue(`${SECTION}.field_lead_label`), type: 'text', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'contact_phone', label: i18n.getValue(`${SECTION}.field_phone_label`), type: 'tel', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'contact_email', label: i18n.getValue(`${SECTION}.field_email_label`), type: 'email', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'technologies', label: i18n.getValue(`${SECTION}.field_technologies_label`), type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'visibility', label: i18n.getValue(`${SECTION}.field_visibility_label`), type: 'select', options: mapLabeledOptions(PROJECT_VISIBILITY_VALUES, VISIBILITY_LABEL_KEYS, i18n), required: true, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'status', label: i18n.getValue(`${SECTION}.field_status_label`), type: 'select', options: mapLabeledOptions(PROJECT_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), required: false, editable: true, show_in_edit: true, show_in_create: true },
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
    { key: 'visibility', header: i18n.getValue(`${SECTION}.col_visibility`), type: 'select', options: mapLabeledOptions(PROJECT_VISIBILITY_VALUES, VISIBILITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_visibility_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(PROJECT_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'platform', header: i18n.getValue(`${SECTION}.col_platform`), type: 'select', options: mapLabeledOptions(PROJECT_PLATFORM_VALUES, PLATFORM_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_platform_placeholder`), canSort: true },
  ];
}

export function createProjectDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.details_name`), type: 'text' },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text' },
    { key: 'platform', displayName: i18n.getValue(`${SECTION}.details_platform`), type: 'text', chartable: true, chartPossibleValues: PROJECT_PLATFORM_VALUES },
    { key: 'project_lead', displayName: i18n.getValue(`${SECTION}.details_lead`), type: 'text' },
    { key: 'contact_phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text' },
    { key: 'contact_email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text' },
    { key: 'technologies', displayName: i18n.getValue(`${SECTION}.details_technologies`), type: 'text' },
    { key: 'visibility', displayName: i18n.getValue(`${SECTION}.details_visibility`), type: 'text', chartable: true, chartPossibleValues: PROJECT_VISIBILITY_VALUES },
    { key: 'status', displayName: i18n.getValue(`${SECTION}.details_status`), type: 'text', chartable: true, chartPossibleValues: PROJECT_STATUS_VALUES },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
  ];
}

// ── Cross-project tabulka požadavků ──────────────────────────────────────

export function createProjectThreadColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'project_name', header: i18n.getValue(`${SECTION}.thread_col_project`), type: 'text' },
    { key: 'subject', header: i18n.getValue(`${SECTION}.thread_col_subject`), type: 'text' },
    { key: 'priority', header: i18n.getValue(`${SECTION}.thread_col_priority`), type: 'text' },
    { key: 'status', header: i18n.getValue(`${SECTION}.thread_col_status`), type: 'text' },
    { key: 'last_message_at', header: i18n.getValue(`${SECTION}.thread_col_last_message`), type: 'date', format: 'short' },
  ];
}

export function createProjectThreadButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.thread_btn_open`), isActive: true, type: 'info_button', action: 'details', icon: 'chat' },
  ];
}

export function createProjectThreadToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleThreadsFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'exportThreadsTable', label: i18n.getValue(`${SECTION}.thread_toolbar_export`), icon: '', class: 'btn-export', showIf: true },
  ];
}

export function createProjectThreadFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'project_id', header: i18n.getValue(`${SECTION}.thread_filter_project_id_label`), type: 'text', placeholder: i18n.getValue(`${SECTION}.thread_filter_project_id_placeholder`), canSort: false },
    { key: 'priority', header: i18n.getValue(`${SECTION}.thread_col_priority`), type: 'select', options: mapLabeledOptions(PROJECT_THREAD_PRIORITY_VALUES, THREAD_PRIORITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.thread_filter_priority_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.thread_col_status`), type: 'select', options: mapLabeledOptions(PROJECT_THREAD_STATUS_VALUES, THREAD_STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.thread_filter_status_placeholder`), canSort: true },
  ];
}

export function createProjectThreadDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'project_name', displayName: i18n.getValue(`${SECTION}.thread_col_project`), type: 'text', chartable: true },
    { key: 'subject', displayName: i18n.getValue(`${SECTION}.thread_col_subject`), type: 'text' },
    { key: 'priority', displayName: i18n.getValue(`${SECTION}.thread_col_priority`), type: 'text', chartable: true, chartPossibleValues: PROJECT_THREAD_PRIORITY_VALUES },
    { key: 'status', displayName: i18n.getValue(`${SECTION}.thread_col_status`), type: 'text', chartable: true, chartPossibleValues: PROJECT_THREAD_STATUS_VALUES },
  ];
}