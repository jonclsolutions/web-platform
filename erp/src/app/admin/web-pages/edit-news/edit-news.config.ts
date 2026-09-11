/**
 * @file edit-news.config.ts
 * @path src/app/admin/web-pages/edit-news/edit-news.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration (buttons, form fields, table/filter/
 * detail columns) for the News management page.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * + "enum hodnoty jako přeložitelné anglické slugy": kompletní přepis na FACTORY
 * FUNKCE, stejný vzor jako ostatní web-pages stránky. `thema` PŘEPSÁN z plného
 * českého textu ('Milník'/'Update'/'Info'/'Novinka'/'Upozornění'/'Error'/'Údržba'/
 * 'Akce') na anglické slugy ('milestone'/'update'/'info'/'feature'/'warning'/
 * 'error'/'maintenance'/'event') - viz SQL migrace `007_thema_slugs_web_news.sql`
 * a `Store/UpdateWebNewsRequest`, obojí SOUČASNĚ s touto změnou. Poznámka:
 * 'Update'/'Info'/'Error' vypadaly latinkou anglicky, ALE nešlo o stabilní kód,
 * jen o česky zvolené kategorie bez diakritiky - migrovány stejně jako ostatní,
 * žádná výjimka.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'edit-news';

export const NEWS_THEMA_VALUES: string[] = [
  'milestone', 'update', 'info', 'feature', 'warning', 'error', 'maintenance', 'event',
];

const THEMA_LABEL_KEYS: Record<string, string> = {
  milestone: 'thema_milestone',
  update: 'thema_update',
  info: 'thema_info',
  feature: 'thema_feature',
  warning: 'thema_warning',
  error: 'thema_error',
  maintenance: 'thema_maintenance',
  event: 'thema_event',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createNewsButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-news-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-news-delete', icon: 'delete' },
  ];
}

export function createNewsToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'web-news-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-news-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createNewsFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'title',
      label: i18n.getValue(`${SECTION}.field_title_label`),
      placeholder: i18n.getValue(`${SECTION}.field_title_placeholder`),
      type: 'text',
      required: true,
      pattern: '^.{3,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_title_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'thema',
      label: i18n.getValue(`${SECTION}.field_thema_label`),
      type: 'select',
      options: mapLabeledOptions(NEWS_THEMA_VALUES, THEMA_LABEL_KEYS, i18n),
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_thema_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'author',
      label: i18n.getValue(`${SECTION}.field_author_label`),
      placeholder: i18n.getValue(`${SECTION}.field_author_placeholder`),
      type: 'text',
      required: true,
      pattern: '^.{1,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_author_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'message',
      label: i18n.getValue(`${SECTION}.field_message_label`),
      placeholder: i18n.getValue(`${SECTION}.field_message_placeholder`),
      type: 'textarea',
      required: true,
      pattern: '^[\\s\\S]{1,10000}$',
      errorMessage: i18n.getValue(`${SECTION}.field_message_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'bullet_1',
      label: i18n.getValue(`${SECTION}.field_bullet_1_label`),
      placeholder: i18n.getValue(`${SECTION}.field_bullet_placeholder`),
      type: 'text',
      required: false,
      pattern: '^.{0,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_bullet_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'bullet_2',
      label: i18n.getValue(`${SECTION}.field_bullet_2_label`),
      type: 'text',
      required: false,
      pattern: '^.{0,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_bullet_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'bullet_3',
      label: i18n.getValue(`${SECTION}.field_bullet_3_label`),
      type: 'text',
      required: false,
      pattern: '^.{0,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_bullet_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'bullet_4',
      label: i18n.getValue(`${SECTION}.field_bullet_4_label`),
      type: 'text',
      required: false,
      pattern: '^.{0,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_bullet_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
  ];
}

export function createNewsColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'title', header: i18n.getValue(`${SECTION}.col_title`), type: 'text' },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'text' },
    { key: 'author', header: i18n.getValue(`${SECTION}.col_author`), type: 'text' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' },
  ];
}

export function createNewsTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'title', header: i18n.getValue(`${SECTION}.col_title`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createNewsFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'title', header: i18n.getValue(`${SECTION}.col_title`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_title_placeholder`), canSort: true },
    { key: 'author', header: i18n.getValue(`${SECTION}.col_author`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_author_placeholder`), canSort: true },
    { key: 'thema', header: i18n.getValue(`${SECTION}.col_thema`), type: 'select', options: mapLabeledOptions(NEWS_THEMA_VALUES, THEMA_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_thema_placeholder`), canSort: true },
  ];
}

/**
 * @description `importable: true` beze změny oproti předchozí verzi - musí sedět s
 * `WebNewsController::IMPORTABLE_COLUMNS`. `id`/`created_at`/`updated_at` (systémová
 * pole) importable nedostávají. `chartPossibleValues` zůstává canonical VALUES pole -
 * stejné známé omezení jako u ostatních (viz @TODO-FOLLOWUP v `user-request.config.ts`).
 */
export function createNewsDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'title', displayName: i18n.getValue(`${SECTION}.details_title`), type: 'text', importable: true },
    { key: 'thema', displayName: i18n.getValue(`${SECTION}.details_thema`), type: 'text', importable: true, chartable: true, chartPossibleValues: NEWS_THEMA_VALUES },
    { key: 'author', displayName: i18n.getValue(`${SECTION}.details_author`), type: 'text', importable: true, chartable: true },
    { key: 'message', displayName: i18n.getValue(`${SECTION}.details_message`), type: 'text', importable: true },
    { key: 'bullet_1', displayName: i18n.getValue(`${SECTION}.details_bullet_1`), type: 'text', importable: true },
    { key: 'bullet_2', displayName: i18n.getValue(`${SECTION}.details_bullet_2`), type: 'text', importable: true },
    { key: 'bullet_3', displayName: i18n.getValue(`${SECTION}.details_bullet_3`), type: 'text', importable: true },
    { key: 'bullet_4', displayName: i18n.getValue(`${SECTION}.details_bullet_4`), type: 'text', importable: true },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}