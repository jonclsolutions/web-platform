/**
 * @file sales-orders.config.ts
 * @path src/app/admin/web-pages/sales-orders/sales-orders.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static-turned-dynamic configuration (buttons, form fields, table/filter/detail
 * columns) for the Sales Orders (realizace zakázek) management page.
 *
 * (Earlier refactor-note 2026-08-5 for permission granularization - "Přidat" tlačítko
 * záměrně chybí, realizace vznikají automaticky ze Sales Leadů - unchanged, see version
 * history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * přepis na FACTORY FUNKCE (create*), stejný vzor jako `support-tickets.config.ts`/
 * `user-request.config.ts`. ŽÁDNÁ enum-slug DB migrace tady NEBYLA potřeba - tenhle
 * resource nemá žádný `status`/`priority` sloupec (realizace nemají vlastní workflow
 * stav, jen `data_processing_agreement`/`tos_agreement` booleany, které už řeší
 * centrální `shared.yes`/`shared.no` mechanismus přes `type: 'boolean'`, viz
 * enum-hodnoty-v-builder-komponentach.md sekce 7 - žádná `options` mapa pro ně
 * není potřeba).
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'sales-orders';

export function createSalesOrderButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_project`), isActive: true, type: 'neutral_button', action: 'generate_form', permission: 'web-projects-create', icon: 'folder' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-sales-orders-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'web-sales-orders-delete', icon: 'delete' },
  ];
}

export function createSalesOrderToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-sales-orders-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createSalesOrderFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'client_name',
      label: i18n.getValue(`${SECTION}.field_client_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_client_name_placeholder`),
      type: 'text',
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_client_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'ico',
      label: i18n.getValue(`${SECTION}.field_ico_label`),
      placeholder: i18n.getValue(`${SECTION}.field_ico_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'client_email',
      label: i18n.getValue(`${SECTION}.field_email_label`),
      placeholder: i18n.getValue(`${SECTION}.field_email_placeholder`),
      type: 'email',
      required: true,
      pattern: '[^@]+@[^@]+\\.[^@]+',
      errorMessage: i18n.getValue(`${SECTION}.field_email_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'client_phone',
      label: i18n.getValue(`${SECTION}.field_phone_label`),
      placeholder: i18n.getValue(`${SECTION}.field_phone_placeholder`),
      type: 'tel',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'client_address',
      label: i18n.getValue(`${SECTION}.field_address_label`),
      placeholder: i18n.getValue(`${SECTION}.field_address_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'order_description',
      label: i18n.getValue(`${SECTION}.field_description_label`),
      placeholder: i18n.getValue(`${SECTION}.field_description_placeholder`),
      type: 'textarea',
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_description_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'attachments',
      label: i18n.getValue(`${SECTION}.field_attachments_label`),
      type: 'files',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
  ];
}

export function createSalesOrderColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'client_name', header: i18n.getValue(`${SECTION}.col_client`), type: 'text' },
    { key: 'salesman_name', header: i18n.getValue(`${SECTION}.col_salesman`), type: 'text' },
    { key: 'ico', header: i18n.getValue(`${SECTION}.col_ico`), type: 'text' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' },
  ];
}

export function createSalesOrderTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'client_name', header: i18n.getValue(`${SECTION}.col_client`), type: 'text' },
    { key: 'salesman_name', header: i18n.getValue(`${SECTION}.col_salesman`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createSalesOrderFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'client_name', header: i18n.getValue(`${SECTION}.col_client`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_client_placeholder`), canSort: true },
    { key: 'salesman_name', header: i18n.getValue(`${SECTION}.col_salesman`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_salesman_placeholder`), canSort: true },
    { key: 'ico', header: i18n.getValue(`${SECTION}.col_ico`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_ico_placeholder`), canSort: true },
  ];
}

/**
 * @description `data_processing_agreement`/`tos_agreement` zůstávají `chartPossibleValues:
 * ['1','0']` - canonical (NEpřekládané) hodnoty pro GraphBuilderComponent bucketing,
 * stejná logika jako enum sloupce jinde (viz @TODO-FOLLOWUP v user-request.config.ts) -
 * boolean sloupce navíc automaticky dostávají Ano/Ne text v tabulce/detailu přes
 * `shared.yes`/`shared.no`, viz hlavička souboru.
 */
export function createSalesOrderDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'client_name', displayName: i18n.getValue(`${SECTION}.details_client`), type: 'text' },
    { key: 'ico', displayName: i18n.getValue(`${SECTION}.details_ico`), type: 'text' },
    { key: 'salesman_name', displayName: i18n.getValue(`${SECTION}.details_salesman`), type: 'text', chartable: true },
    { key: 'client_email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text' },
    { key: 'client_phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text' },
    { key: 'client_address', displayName: i18n.getValue(`${SECTION}.details_address`), type: 'text' },
    { key: 'order_description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text' },
    { key: 'data_processing_agreement', displayName: i18n.getValue(`${SECTION}.details_gdpr_agreement`), type: 'boolean', chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'tos_agreement', displayName: i18n.getValue(`${SECTION}.details_tos_agreement`), type: 'boolean', chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'attachments', displayName: i18n.getValue(`${SECTION}.details_attachments`), type: 'files' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}