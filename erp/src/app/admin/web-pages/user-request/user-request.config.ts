/**
 * @file user-request.config.ts
 * @path src/app/admin/web-pages/user-request/user-request.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the User Request (raw commission requests) management page.
 *
 * (Earlier refactor-notes for permission granularization, editable email template
 * toolbar button, and bulk import/export importable columns are unchanged - see
 * version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * Tenhle config soubor byl PŮVODNĚ pole statických konstant s natvrdo českým textem,
 * vyhodnocených JEDNOU při načtení modulu (import time) - takže žádné přepnutí admin
 * jazyka za běhu by se do TableBuilderComponent/ActionMenuBuilderComponent/
 * FormBuilderComponent (které tyhle konfigurace dostávají jako @Input()) nikdy
 * nepropsalo. Přepsáno na FACTORY FUNKCE (create*), které berou `AdminLocalizationService`
 * a vrací pole přeložené podle AKTUÁLNĚ zvoleného jazyka. Volající komponenta
 * (user-request.component.ts) je volá přes GETTERY, ne přes jednorázové přiřazení v
 * konstruktoru - gettery se přepočítají při každém change detection cyklu, takže po
 * přepnutí jazyka (`AdminLocalizationService.translations$` → `markForCheck()`,
 * zděděné z BaseDataComponent) dostanou child komponenty čerstvě přeložená data
 * automaticky. Stejný vzor lze replikovat na zbylé *.config.ts soubory v adminu.
 *
 * DŮLEŽITÉ - STATUS/PRIORITY/THEMA: canonical VALUES (`USER_REQUEST_STATUS_VALUES` atd.)
 * ZŮSTÁVAJÍ nepřeložené české stringy - jsou to zároveň skutečné hodnoty ukládané do
 * DB/posílané na backend (`formData[status] = 'Nově zadané'`), takže jejich překlad by
 * rozbil ukládání i filtrování. Přeložen je jen LABEL (zobrazený text) v `{value,label}`
 * párech pro `select` form pole - `value` zůstává stabilní VŽDY, nezávisle na
 * zvoleném jazyce administrace. Přechod na anglické slugy (`new`/`in_progress`/...)
 * je plánován jako SAMOSTATNÝ backendový task (DB migrace + validace), zatím se
 * nedotýká.
 *
 * OTEVŘENÁ OTÁZKA: filtr-dropdown `options` je dnes plochý `string[]`, kde stejný
 * string slouží jako filtr-hodnota (poslaná do API) i jako zobrazený text. PONECHÁNO
 * ZÁMĚRNĚ V ČEŠTINĚ, dokud se nepotvrdí, že `FilterColumns.options`/
 * `FilterFormBuilderComponent` umí `{value,label}` pár stejně jako
 * `InputDefinition.options` - překlad by jinak rozbil filtrování.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'user-request';

/**
 * @description Canonical (nepřekládané) hodnoty stavu - VÝZNAM: skutečná hodnota
 * ukládaná do DB. NEPŘEKLÁDAT.
 */
export const USER_REQUEST_STATUS_VALUES: string[] = ['Nově zadané', 'Zpracovává se', 'Dokončeno', 'Zrušeno'];
export const USER_REQUEST_PRIORITY_VALUES: string[] = ['Nízká', 'Neutrální', 'Vysoká'];
export const USER_REQUEST_THEMA_VALUES: string[] = ['Webový vývoj', 'Desktopový vývoj', 'Mobilní vývoj', 'AI vývoj', 'Jiné'];

/** @deprecated Zachováno pro zpětnou kompatibilitu s případnými dalšími importy - použij `..._VALUES`. */
export const USER_REQUEST_STATUS_OPTIONS = USER_REQUEST_STATUS_VALUES;
export const USER_REQUEST_PRIORITY_OPTIONS = USER_REQUEST_PRIORITY_VALUES;
export const USER_REQUEST_THEMA_OPTIONS = USER_REQUEST_THEMA_VALUES;

const STATUS_LABEL_KEYS: Record<string, string> = {
  'Nově zadané': 'status_new',
  'Zpracovává se': 'status_in_progress',
  'Dokončeno': 'status_done',
  'Zrušeno': 'status_cancelled',
};
const PRIORITY_LABEL_KEYS: Record<string, string> = {
  'Nízká': 'priority_low',
  'Neutrální': 'priority_neutral',
  'Vysoká': 'priority_high',
};
const THEMA_LABEL_KEYS: Record<string, string> = {
  'Webový vývoj': 'thema_web',
  'Desktopový vývoj': 'thema_desktop',
  'Mobilní vývoj': 'thema_mobile',
  'AI vývoj': 'thema_ai',
  'Jiné': 'thema_other',
};

/**
 * @description `value` zůstává canonical český string (viz VALUES výše), `label` je
 * přeložený text pro zobrazení v `<select>`/tabulce. Sdíleno mezi form-field options
 * a odkudkoliv jinde, kde je potřeba stejný pár.
 */
function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createUserRequestButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: i18n.getValue(`${SECTION}.btn_details`), header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: i18n.getValue(`${SECTION}.btn_edit`), header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-user-requests-update', icon: 'edit' },
    { display_name: i18n.getValue(`${SECTION}.btn_delete`), header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-user-requests-delete', icon: 'delete' },
  ];
}

/**
 * @description `label` zde jsou VÝCHOZÍ hodnoty - `toggleFilters`/`toggleTable` je
 * stejně přepisuje dynamicky v `UserRequestComponent.toolbarButtons` getteru podle
 * aktuálního stavu (`isFilterVisible`/`showTrashTable`), takže tenhle label se
 * prakticky nikdy nezobrazí, ale musí být přítomný a přeložený pro konzistenci.
 */
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
      placeholder: i18n.getValue(`${SECTION}.field_thema_placeholder`),
      type: 'text',
      required: true,
      pattern: '^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\\s\\.\\-]{3,255}$',
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
      options: mapLabeledOptions(USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: true
    },
    {
      column_name: 'priority',
      label: i18n.getValue(`${SECTION}.field_priority_label`),
      type: 'select',
      options: mapLabeledOptions(USER_REQUEST_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n),
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

/**
 * @description `options` je ZÁMĚRNĚ ponecháno v češtině (viz OTEVŘENÁ OTÁZKA v
 * hlavičce souboru) - `FilterColumns.options` je plochý `string[]`, kde stejný
 * string je poslaný jako filtr-hodnota do API i zobrazen jako text. Přeložit label
 * bez odpovídajícího `value` páru by rozbilo filtrování dat podle stavu/priority.
 * Header/placeholder textům to nevadí (jsou to čistě UI popisky), ty PŘELOŽENY jsou.
 */
export function createUserRequestFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'select', placeholder: i18n.getValue(`${SECTION}.filter_thema_placeholder`), options: USER_REQUEST_THEMA_VALUES, canSort: true },
    { key: 'contact_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_email_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: USER_REQUEST_STATUS_VALUES, placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'select', options: USER_REQUEST_PRIORITY_VALUES, placeholder: i18n.getValue(`${SECTION}.filter_priority_placeholder`), canSort: true },
  ];
}

/**
 * @description `chartPossibleValues` zůstává canonical VALUES pole (ne přeložené) -
 * GraphBuilderComponent s ním pravděpodobně porovnává surové hodnoty z API při
 * bucketování, ne zobrazený text. `displayName` (nadpis sloupce v detailu i grafu)
 * PŘELOŽEN je.
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