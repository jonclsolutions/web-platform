/**
 * @file suppliers.config.ts
 * @path src/app/admin/shop-pages/suppliers/suppliers.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop supplier management.
 *
 * (Earlier bugfix-note 2026-09-07 for shop permissions granularization is unchanged
 * - see version history.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace potřeba - `is_active` je
 * boolean-jako-select (`'1'`/`'0'` canonical hodnoty), labely řešeny přes centrální
 * `shared.yes`/`shared.no` - STEJNÝ mechanismus jako `type: 'boolean'` sloupce jinde,
 * jen tady je pole `type: 'select'` (ne `checkbox`), protože je `required` a nesmí
 * mít žádný "prázdný"/neurčitý stav.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-suppliers';

export function createSupplierButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-suppliers-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-suppliers-delete', icon: 'delete' },
  ];
}

export function createSupplierToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'shop-suppliers-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-suppliers-create' },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createSupplierFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'name',
      label: i18n.getValue(`${SECTION}.field_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_name_placeholder`),
      type: 'text',
      required: true,
      pattern: '^[a-zA-Z0-9ěščřžýáíéóúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ\\s\\.\\-]{2,200}$',
      errorMessage: i18n.getValue(`${SECTION}.field_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'ico',
      label: i18n.getValue(`${SECTION}.field_ico_label`),
      placeholder: i18n.getValue(`${SECTION}.field_ico_placeholder`),
      type: 'text',
      required: false,
      errorMessage: i18n.getValue(`${SECTION}.field_ico_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'contact_person',
      label: i18n.getValue(`${SECTION}.field_contact_person_label`),
      placeholder: i18n.getValue(`${SECTION}.field_contact_person_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'email',
      label: i18n.getValue(`${SECTION}.field_email_label`),
      placeholder: i18n.getValue(`${SECTION}.field_email_placeholder`),
      type: 'email',
      required: false,
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      errorMessage: i18n.getValue(`${SECTION}.field_email_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'phone',
      label: i18n.getValue(`${SECTION}.field_phone_label`),
      placeholder: '+420 123 456 789',
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'address',
      label: i18n.getValue(`${SECTION}.field_address_label`),
      placeholder: i18n.getValue(`${SECTION}.field_address_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'city',
      label: i18n.getValue(`${SECTION}.field_city_label`),
      placeholder: i18n.getValue(`${SECTION}.field_city_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'postal_code',
      label: i18n.getValue(`${SECTION}.field_postal_code_label`),
      placeholder: i18n.getValue(`${SECTION}.field_postal_code_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'country',
      label: i18n.getValue(`${SECTION}.field_country_label`),
      placeholder: i18n.getValue(`${SECTION}.field_country_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'payment_terms',
      label: i18n.getValue(`${SECTION}.field_payment_terms_label`),
      placeholder: i18n.getValue(`${SECTION}.field_payment_terms_placeholder`),
      type: 'text',
      required: false,
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
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'notes',
      label: i18n.getValue(`${SECTION}.field_notes_label`),
      placeholder: i18n.getValue(`${SECTION}.field_notes_placeholder`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
  ];
}

export function createSupplierColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_company_name`), type: 'text' },
    { key: 'ico', header: i18n.getValue(`${SECTION}.col_ico`), type: 'text' },
    { key: 'email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'is_active', header: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' },
  ];
}

export function createSupplierTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_company_name`), type: 'text' },
    { key: 'email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createSupplierFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'name', header: i18n.getValue(`${SECTION}.filter_company_label`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_name_placeholder`), canSort: true },
    { key: 'ico', header: i18n.getValue(`${SECTION}.col_ico`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_ico_placeholder`), canSort: true },
    { key: 'email', header: i18n.getValue(`${SECTION}.col_email`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_email_placeholder`), canSort: true },
    {
      key: 'is_active', header: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'select',
      options: [
        { value: '1', label: i18n.getValue('shared.yes') },
        { value: '0', label: i18n.getValue('shared.no') },
      ],
      placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true,
    },
  ];
}

export function createSupplierDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.col_company_name`), type: 'text' },
    { key: 'ico', displayName: i18n.getValue(`${SECTION}.col_ico`), type: 'text' },
    { key: 'contact_person', displayName: i18n.getValue(`${SECTION}.field_contact_person_label`), type: 'text' },
    { key: 'email', displayName: i18n.getValue(`${SECTION}.col_email`), type: 'text' },
    { key: 'phone', displayName: i18n.getValue(`${SECTION}.field_phone_label`), type: 'text' },
    { key: 'address', displayName: i18n.getValue(`${SECTION}.details_address`), type: 'text' },
    { key: 'city', displayName: i18n.getValue(`${SECTION}.field_city_label`), type: 'text', chartable: true },
    { key: 'postal_code', displayName: i18n.getValue(`${SECTION}.field_postal_code_label`), type: 'text' },
    { key: 'country', displayName: i18n.getValue(`${SECTION}.field_country_label`), type: 'text', chartable: true },
    { key: 'payment_terms', displayName: i18n.getValue(`${SECTION}.field_payment_terms_label`), type: 'text' },
    { key: 'is_active', displayName: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'text', chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'notes', displayName: i18n.getValue(`${SECTION}.field_notes_label`), type: 'text' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}