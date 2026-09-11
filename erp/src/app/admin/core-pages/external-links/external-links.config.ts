/**
 * @file external-links.config.ts
 * @path src/app/admin/core-pages/external-links/external-links.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration (buttons, form fields, table/filter/
 * detail columns) for the External Links management page.
 *
 * (Earlier refactor-notes for permission granularization, position/is_active removal,
 * and the openGraphBuilder permission fix are unchanged - see version history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE, stejný vzor jako web-pages stránky. Žádná enum-slug
 * DB migrace tady NEBYLA potřeba - `name`/`url` jsou volná textová pole, žádný uzavřený
 * seznam hodnot.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'external-links';

export function createExternalLinkButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'core-external-links-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'core-external-links-delete', icon: 'delete' },
  ];
}

export function createExternalLinkToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'core-external-links-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'core-external-links-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createExternalLinkFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'name',
      label: i18n.getValue(`${SECTION}.field_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_name_placeholder`),
      type: 'text',
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'url',
      label: i18n.getValue(`${SECTION}.field_url_label`),
      placeholder: i18n.getValue(`${SECTION}.field_url_placeholder`),
      type: 'text',
      required: true,
      pattern: '^https?:\\/\\/.+',
      errorMessage: i18n.getValue(`${SECTION}.field_url_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
  ];
}

export function createExternalLinkColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'url', header: i18n.getValue(`${SECTION}.col_url`), type: 'link' },
  ];
}

export function createExternalLinkTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'url', header: i18n.getValue(`${SECTION}.col_url`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createExternalLinkFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_name_placeholder`), canSort: true },
    { key: 'url', header: i18n.getValue(`${SECTION}.col_url`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_url_placeholder`), canSort: true },
  ];
}

export function createExternalLinkDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.details_name`), type: 'text' },
    { key: 'url', displayName: i18n.getValue(`${SECTION}.details_url`), type: 'text' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}