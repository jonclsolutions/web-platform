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
 * toolbar button, bulk import/export importable columns, and the 2026-09 i18n factory
 * function rewrite are unchanged - see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-07) BACKLOG "enum hodnoty jako přeložitelné anglické slugy":
 * `USER_REQUEST_STATUS_VALUES`/`_PRIORITY_VALUES`/`_THEMA_VALUES` PŘEPSÁNY z českých
 * stringů ("Nově zadané", "Nízká", "Webový vývoj", ...) na anglické slugy ("new",
 * "low", "web", ...) - viz SQL migrace `003_status_slugs_web_raw_request_commissions.sql`
 * (přepsala existující DB data + column DEFAULT) a `Store/UpdateWebRawRequestCommissionRequest`
 * (přepsaly `in:...` validaci), obě SOUČASNĚ s touto změnou - žádný z kroků nesmí běžet
 * odděleně. `*_LABEL_KEYS` mapy překlíčovány na nové slugy, VÝZNAM/i18n klíče (`status_new`,
 * `priority_low`, `thema_web`, ...) se NEMĚNÍ - byly zavedeny už dřív a zůstávají stejné.
 *
 * DŮLEŽITÉ - toto je REFERENČNÍ IMPLEMENTACE "receptu" pro celý projekt (Core/Web/Shop):
 * 1) Canonical VALUES pole (`..._VALUES`) drží stabilní anglický slug - skutečná hodnota
 *    ukládaná do DB/posílaná na backend. NIKDY nepřekládat samotné pole.
 * 2) `..._LABEL_KEYS` mapuje slug -> i18n klíč (ne slug -> text přímo).
 * 3) `mapLabeledOptions(values, labelKeys, i18n)` vrací `{value: slug, label: přeložený text}`
 *    páry - použitelné JAK pro `InputDefinition.options` (select ve formuláři), TAK
 *    (nově, viz níže) pro `FilterColumns.options` (select ve filtru) - obě komponenty
 *    (`FormBuilderComponent`, `FilterFormBuilderComponent`) `{value,label}` pár už umí,
 *    ověřeno v `filter-form-builder.component.html`
 *    (`option?.value !== undefined ? option.value : option`).
 * 4) `TableBuilderComponent.getCellValue()` (default case) překládá zobrazenou hodnotu v
 *    tabulce automaticky - hledá `value` v `inputDefinitions` (které stránka stejně musí
 *    předat table-builderu kvůli formuláři), takže žádná zvláštní úprava tabulky není
 *    potřeba, pokud `[inputDefinitions]="formFields"` binding už existuje (zde ano).
 *
 * OTEVŘENÁ OTÁZKA Z PŘEDCHOZÍ VERZE VYŘEŠENA: `FilterColumns.options` skutečně podporuje
 * `{value,label}` páry (potvrzeno v šabloně filter-form-builderu) - `createUserRequestFilterColumns()`
 * proto teď používá `mapLabeledOptions()` stejně jako formulářová pole, MÍSTO dřívějšího
 * plochého `string[]` v češtině.
 *
 * @TODO-FOLLOWUP `GraphBuilderComponent` (viz `chartPossibleValues: USER_REQUEST_THEMA_VALUES`
 * v `createUserRequestDetailsColumns()`) vykresluje popisky grafu ze SUROVÉ API hodnoty
 * (`"ai (3×)"` místo `"AI vývoj (3×)"`), protože bucketuje přímo podle `row[col.key]`, ne
 * podle přeloženého labelu - graf teď po přechodu na slugy zobrazí anglické zkratky místo
 * plného českého názvu. Oprava vyžaduje zásah do `GraphBuilderComponent`
 * (`computeValueCatalog()`/`buildDistributionSection()`), aby uměl per-sloupec volitelnou
 * `labelMap: Record<string,string>` funkci - mimo rozsah TÉTO změny, ale je potřeba to
 * doplnit, než bude tenhle report administrátorům dávat smysl v obou jazycích.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'user-request';

/**
 * @description Canonical (NEPŘEKLÁDANÉ) hodnoty - VÝZNAM: skutečná hodnota ukládaná
 * do DB / posílaná na backend. Anglické slugy - viz refactor-note (2026-09-07) výše.
 */
export const USER_REQUEST_STATUS_VALUES: string[] = ['new', 'in_progress', 'done', 'cancelled'];
export const USER_REQUEST_PRIORITY_VALUES: string[] = ['low', 'neutral', 'high'];
export const USER_REQUEST_THEMA_VALUES: string[] = ['web', 'desktop', 'mobile', 'ai', 'other'];

/** @deprecated Zachováno pro zpětnou kompatibilitu s případnými dalšími importy - použij `..._VALUES`. */
export const USER_REQUEST_STATUS_OPTIONS = USER_REQUEST_STATUS_VALUES;
export const USER_REQUEST_PRIORITY_OPTIONS = USER_REQUEST_PRIORITY_VALUES;
export const USER_REQUEST_THEMA_OPTIONS = USER_REQUEST_THEMA_VALUES;

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
  web: 'thema_web',
  desktop: 'thema_desktop',
  mobile: 'thema_mobile',
  ai: 'thema_ai',
  other: 'thema_other',
};

/**
 * @description `value` = canonical slug (viz VALUES výše), `label` = přeložený text.
 * Sdíleno mezi form-field options a (nově) filter-column options.
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
  options: mapLabeledOptions(USER_REQUEST_THEMA_VALUES, THEMA_LABEL_KEYS, i18n), // NOVÉ
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
 * @refactor-note (2026-09-07) `thema`/`status`/`priority` teď používají `mapLabeledOptions()`
 * (`{value,label}` páry) MÍSTO dřívějšího plochého `string[]` v češtině - vyřešená
 * "otevřená otázka" z předchozí verze, viz hlavička souboru. `header`/`placeholder`
 * beze změny (byly přeložené už dřív).
 */
export function createUserRequestFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'select', placeholder: i18n.getValue(`${SECTION}.filter_thema_placeholder`), options: mapLabeledOptions(USER_REQUEST_THEMA_VALUES, THEMA_LABEL_KEYS, i18n), canSort: true },
    { key: 'contact_email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_email_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(USER_REQUEST_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'select', options: mapLabeledOptions(USER_REQUEST_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_priority_placeholder`), canSort: true },
  ];
}

/**
 * @description `chartPossibleValues` zůstává canonical VALUES pole (ne přeložené) -
 * GraphBuilderComponent s ním porovnává surové hodnoty z API při bucketování, ne
 * zobrazený text - viz @TODO-FOLLOWUP v hlavičce souboru pro známé omezení (graf
 * zatím zobrazuje anglický slug, ne přeložený label). `displayName` (nadpis sloupce
 * v detailu i grafu) PŘELOŽEN je.
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