/**
 * @file support-tickets.config.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration (buttons, form fields, table/filter/
 * detail columns) for the Helpdesk Support Tickets management page.
 *
 * (Earlier refactor-notes for permission granularization, bulk import/export
 * importable columns, and the openGraphBuilder permission fix are unchanged - see
 * version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded
 * texty" + "enum hodnoty jako přeložitelné anglické slugy": kompletní přepis na
 * FACTORY FUNKCE (create*), stejný vzor jako `user-request.config.ts` (viz jeho
 * hlavička pro plné odůvodnění vzoru - vyhodnocování při KAŽDÉM čtení `getValue()`
 * místo jednorázových konstant, kvůli přepínání admin jazyka za běhu).
 *
 * `category` PŘEPSÁNO z českých kódových slov ('obchod'/'chyba'/'ostatni') na
 * anglické slugy ('business'/'bug'/'other') - viz SQL migrace
 * `004_category_slugs_web_support_tickets.sql` a `Store/UpdateWebSupportTicketRequest`
 * (doplněna `in:...` validace, kterou `category` dřív vůbec neměla), obojí SOUČASNĚ
 * s touto změnou. `state`/`priority` byly už anglické slugy ('new'/'open'/'closed',
 * 'low'/'medium'/'high') - žádná DB migrace, jen převod na i18n factory vzor.
 *
 * Recept identický s `user-request.config.ts`:
 * 1) `..._VALUES` - canonical anglický slug, nikdy nepřekládat.
 * 2) `..._LABEL_KEYS` - slug -> i18n klíč (ne slug -> text přímo).
 * 3) `mapLabeledOptions()` - `{value,label}` páry, sdílené mezi formulářovým polem
 *    (`InputDefinition.options`) a filtrem (`FilterColumns.options`).
 *
 * `TableBuilderComponent.getCellValue()` (default case) hledá `options` v
 * `inputDefinitions` podle `column.key` - `category`/`priority`/`state` MUSÍ mít
 * `options` i na formulářovém poli (ne jen na filtru), jinak tabulka zobrazí slug
 * místo labelu, viz bugfix u `user-request`/`thema`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'support-tickets';

/**
 * @description Canonical (NEPŘEKLÁDANÉ) hodnoty - skutečné DB hodnoty. `category`
 * je od 2026-09-08 anglický slug (viz SQL migrace v hlavičce souboru), `priority`/
 * `state` byly anglické slugy odjakživa.
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
 * @description `value` = canonical slug, `label` = přeložený text. Sdíleno mezi
 * form-field options a filter-column options - viz enum-hodnoty-v-builder-
 * komponentach.md, sekce 2.
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
 * @description `category`/`priority`/`state` teď používají `mapLabeledOptions()`
 * `{value,label}` páry - `FilterFormBuilderComponent`'s šablona podporuje obojí
 * (`option?.value !== undefined ? option.value : option`), viz enum-hodnoty-v-
 * builder-komponentach.md, sekce 4.
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
 * @refactor-note (2026-08-23) `importable: true` beze změny - musí přesně sedět
 * s `WebSupportTicketController::IMPORTABLE_COLUMNS`. `id`, `user_id`, `attachments`,
 * `created_at` ZÁMĚRNĚ bez tohoto příznaku. `chartPossibleValues` zůstává canonical
 * VALUES pole (ne přeložené) - stejné omezení jako `user-request`/`thema`, viz
 * @TODO-FOLLOWUP v jeho config.ts (GraphBuilderComponent zatím neumí label mapping).
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