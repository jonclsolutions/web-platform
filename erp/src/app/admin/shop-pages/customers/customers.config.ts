/**
 * @file customers.config.ts
 * @path src/app/admin/shop-pages/customers/customers.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop customer management.
 *
 * (Earlier bugfix-note 2026-09-07 for shop permissions granularization is unchanged
 * - see version history.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace potřeba - `is_active` je
 * boolean-jako-select (`'1'`/`'0'`), řešeno přes centrální `shared.yes`/`shared.no`
 * - stejný mechanismus jako `shop-suppliers.config.ts`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-customers';

export function createCustomerButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-customers-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_orders`), isActive: true, type: 'neutral_button', action: 'customer_orders', permission: 'shop-orders-view', icon: 'package' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-customers-delete', icon: 'delete' },
  ];
}

export function createCustomerToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'shop-customers-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-customers-create' },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createCustomerFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'first_name',
      label: i18n.getValue(`${SECTION}.field_first_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_first_name_placeholder`),
      type: 'text',
      required: true,
      pattern: '^.{1,100}$',
      errorMessage: i18n.getValue(`${SECTION}.field_first_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'last_name',
      label: i18n.getValue(`${SECTION}.field_last_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_last_name_placeholder`),
      type: 'text',
      required: true,
      pattern: '^.{1,100}$',
      errorMessage: i18n.getValue(`${SECTION}.field_last_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'email',
      label: i18n.getValue(`${SECTION}.field_email_label`),
      placeholder: i18n.getValue(`${SECTION}.field_email_placeholder`),
      type: 'email',
      required: true,
      pattern: '[^@]+@[^@]+\\.[^@]+',
      errorMessage: i18n.getValue(`${SECTION}.field_email_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'phone',
      label: i18n.getValue(`${SECTION}.field_phone_label`),
      placeholder: '+420...',
      type: 'tel',
      required: false,
      pattern: '^(\\+?[0-9]{1,3})?[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}$',
      errorMessage: i18n.getValue(`${SECTION}.field_phone_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'company',
      label: i18n.getValue(`${SECTION}.field_company_label`),
      placeholder: i18n.getValue(`${SECTION}.field_company_placeholder`),
      type: 'text',
      required: false,
      pattern: '^.{0,150}$',
      errorMessage: i18n.getValue(`${SECTION}.field_company_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'address',
      label: i18n.getValue(`${SECTION}.field_address_label`),
      placeholder: i18n.getValue(`${SECTION}.field_address_placeholder`),
      type: 'text',
      required: false,
      pattern: '^.{0,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_address_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'city',
      label: i18n.getValue(`${SECTION}.field_city_label`),
      placeholder: i18n.getValue(`${SECTION}.field_city_placeholder`),
      type: 'text',
      required: false,
      pattern: '^.{0,100}$',
      errorMessage: i18n.getValue(`${SECTION}.field_city_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'postal_code',
      label: i18n.getValue(`${SECTION}.field_postal_code_label`),
      placeholder: '123 45',
      type: 'text',
      required: false,
      pattern: '^.{0,10}$',
      errorMessage: i18n.getValue(`${SECTION}.field_postal_code_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'is_active',
      label: i18n.getValue(`${SECTION}.field_is_active_label`),
      type: 'select',
      options: [
        { value: '1', label: i18n.getValue('shared.yes') },
        { value: '0', label: i18n.getValue('shared.no') },
      ],
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_is_active_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'notes',
      label: i18n.getValue(`${SECTION}.field_notes_label`),
      placeholder: i18n.getValue(`${SECTION}.field_notes_placeholder`),
      type: 'textarea',
      required: false,
      pattern: '^.{0,1000}$',
      errorMessage: i18n.getValue(`${SECTION}.field_notes_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },

    // Skrytá systémová pole
    { column_name: 'user_id', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
    { column_name: 'country', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  ];
}

export function createCustomerColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'last_name', header: i18n.getValue(`${SECTION}.col_last_name`), type: 'text' },
    { key: 'first_name', header: i18n.getValue(`${SECTION}.col_first_name`), type: 'text' },
    { key: 'email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'phone', header: i18n.getValue(`${SECTION}.col_phone`), type: 'text' },
    { key: 'total_spent', header: i18n.getValue(`${SECTION}.col_total_spent`), type: 'text' },
    { key: 'is_active', header: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean' },
  ];
}

export function createCustomerTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createCustomerFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'search', header: i18n.getValue(`${SECTION}.filter_search_label`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_search_placeholder`), canSort: false },
    {
      key: 'is_active', header: i18n.getValue(`${SECTION}.filter_status_label`), type: 'select',
      options: [
        { value: '1', label: i18n.getValue('shared.yes') },
        { value: '0', label: i18n.getValue('shared.no') },
      ],
      placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true,
    },
  ];
}

export function createCustomerDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'first_name', displayName: i18n.getValue(`${SECTION}.col_first_name`), type: 'text', importable: true },
    { key: 'last_name', displayName: i18n.getValue(`${SECTION}.col_last_name`), type: 'text', importable: true },
    { key: 'email', displayName: i18n.getValue(`${SECTION}.col_email`), type: 'text', importable: true },
    { key: 'phone', displayName: i18n.getValue(`${SECTION}.col_phone`), type: 'text', importable: true },
    { key: 'company', displayName: i18n.getValue(`${SECTION}.details_company`), type: 'text', importable: true },
    { key: 'address', displayName: i18n.getValue(`${SECTION}.field_address_label`), type: 'text', importable: true },
    { key: 'city', displayName: i18n.getValue(`${SECTION}.field_city_label`), type: 'text', importable: true },
    { key: 'postal_code', displayName: i18n.getValue(`${SECTION}.field_postal_code_label`), type: 'text', importable: true },
    { key: 'country', displayName: i18n.getValue(`${SECTION}.details_country`), type: 'text', importable: true, chartable: true },
    { key: 'total_spent', displayName: i18n.getValue(`${SECTION}.col_total_spent`), type: 'text', importable: true },
    {
      key: 'is_active', displayName: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'text', importable: true,
      chartable: true, chartPossibleValues: ['1', '0'],
    },
    { key: 'notes', displayName: i18n.getValue(`${SECTION}.field_notes_label`), type: 'text', importable: true },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_registration`), type: 'date', format: 'medium' },
  ];
}