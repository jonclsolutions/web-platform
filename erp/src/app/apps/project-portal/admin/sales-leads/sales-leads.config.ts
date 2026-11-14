/**
 * @file sales-leads.config.ts
 * @path src/app/apps/project-portal/admin/sales-leads/sales-leads.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Configuration (buttons, form fields, table / filter / detail columns) of the
 * Sales Leads (CRM) management page.
 * @note Same recipe as `user-request.config.ts`:
 * 1) `..._VALUES` - canonical English slug, never translated.
 * 2) `..._LABEL_KEYS` - slug -> i18n key.
 * 3) `mapLabeledOptions(SECTION, )` - `{value,label}` pairs shared by the form and the filter.
 */
import * as Core from '../../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { mapLabeledOptions } from '../../../../admin/components/builders/labeled-options';

const SECTION = 'sales-leads';

export const SALES_LEAD_STATUS_VALUES: string[] = [
  'new', 'in_communication', 'preparing_offer', 'offer_sent', 'inquiry_form_sent',
  'negotiating', 'on_hold', 'handed_to_dev_team', 'closed_won', 'awaiting_invoicing',
  'awaiting_payment', 'paid_project_started', 'closed_lost', 'other',
];

export const SALES_LEAD_PRIORITY_VALUES: string[] = ['low', 'below_average', 'neutral', 'high', 'critical'];

export const SALES_LEAD_SOURCE_CHANNEL_VALUES: string[] = [
  'linkedin_dm', 'linkedin_post', 'facebook_group', 'facebook_dm', 'instagram_dm',
  'x_twitter', 'whatsapp', 'telegram', 'web_form', 'email_cold', 'email_newsletter',
  'phone_cold_call', 'phone_inbound', 'in_person_meeting', 'networking_event',
  'referral', 'former_client', 'inquiry_portal', 'google_business', 'paid_ads_ppc',
  'partner_affiliate', 'other_online', 'other_offline',
];

const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'status_new',
  in_communication: 'status_in_communication',
  preparing_offer: 'status_preparing_offer',
  offer_sent: 'status_offer_sent',
  inquiry_form_sent: 'status_inquiry_form_sent',
  negotiating: 'status_negotiating',
  on_hold: 'status_on_hold',
  handed_to_dev_team: 'status_handed_to_dev_team',
  closed_won: 'status_closed_won',
  awaiting_invoicing: 'status_awaiting_invoicing',
  awaiting_payment: 'status_awaiting_payment',
  paid_project_started: 'status_paid_project_started',
  closed_lost: 'status_closed_lost',
  other: 'status_other',
};

const PRIORITY_LABEL_KEYS: Record<string, string> = {
  low: 'priority_low',
  below_average: 'priority_below_average',
  neutral: 'priority_neutral',
  high: 'priority_high',
  critical: 'priority_critical',
};

const SOURCE_CHANNEL_LABEL_KEYS: Record<string, string> = {
  linkedin_dm: 'source_linkedin_dm',
  linkedin_post: 'source_linkedin_post',
  facebook_group: 'source_facebook_group',
  facebook_dm: 'source_facebook_dm',
  instagram_dm: 'source_instagram_dm',
  x_twitter: 'source_x_twitter',
  whatsapp: 'source_whatsapp',
  telegram: 'source_telegram',
  web_form: 'source_web_form',
  email_cold: 'source_email_cold',
  email_newsletter: 'source_email_newsletter',
  phone_cold_call: 'source_phone_cold_call',
  phone_inbound: 'source_phone_inbound',
  in_person_meeting: 'source_in_person_meeting',
  networking_event: 'source_networking_event',
  referral: 'source_referral',
  former_client: 'source_former_client',
  inquiry_portal: 'source_inquiry_portal',
  google_business: 'source_google_business',
  paid_ads_ppc: 'source_paid_ads_ppc',
  partner_affiliate: 'source_partner_affiliate',
  other_online: 'source_other_online',
  other_offline: 'source_other_offline',
};

export function createSalesLeadButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'project-portal-sales-leads-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_link`), isActive: true, type: 'neutral_button', action: 'generate_form', permission: 'project-portal-sales-leads-update', icon: 'link' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'project-portal-sales-leads-delete', icon: 'delete' },
  ];
}

export function createSalesLeadToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'project-portal-sales-leads-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'project-portal-sales-leads-view' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createSalesLeadFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'subject_name',
      label: i18n.getValue(`${SECTION}.field_subject_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_subject_name_placeholder`),
      type: 'text',
      required: true,
      pattern: '^.{2,255}$',
      errorMessage: i18n.getValue(`${SECTION}.field_subject_name_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    { column_name: 'user_id', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
    { column_name: 'salesman_name', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
    { column_name: 'contact_other', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
    { column_name: 'source_url', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
    {
      column_name: 'first_contact_date',
      label: i18n.getValue(`${SECTION}.field_first_contact_date_label`),
      placeholder: i18n.getValue(`${SECTION}.field_first_contact_date_placeholder`),
      type: 'date',
      required: false,
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
      column_name: 'contact_email',
      label: i18n.getValue(`${SECTION}.field_email_label`),
      placeholder: i18n.getValue(`${SECTION}.field_email_placeholder`),
      type: 'email',
      required: false,
      pattern: '[^@]+@[^@]+\\.[^@]+',
      errorMessage: i18n.getValue(`${SECTION}.field_email_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'contact_phone',
      label: i18n.getValue(`${SECTION}.field_phone_label`),
      placeholder: '+420 123 456 789',
      type: 'tel',
      required: false,
      pattern: '^(\\+?[0-9]{1,3})?[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}$',
      errorMessage: i18n.getValue(`${SECTION}.field_phone_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'location',
      label: i18n.getValue(`${SECTION}.field_location_label`),
      placeholder: i18n.getValue(`${SECTION}.field_location_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'source_channel',
      label: i18n.getValue(`${SECTION}.field_source_channel_label`),
      placeholder: i18n.getValue(`${SECTION}.field_source_channel_placeholder`),
      type: 'select',
      options: mapLabeledOptions(SECTION, SALES_LEAD_SOURCE_CHANNEL_VALUES, SOURCE_CHANNEL_LABEL_KEYS, i18n),
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_source_channel_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'status',
      label: i18n.getValue(`${SECTION}.field_status_label`),
      placeholder: i18n.getValue(`${SECTION}.field_status_placeholder`),
      type: 'select',
      options: mapLabeledOptions(SECTION, SALES_LEAD_STATUS_VALUES, STATUS_LABEL_KEYS, i18n),
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_status_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'priority',
      label: i18n.getValue(`${SECTION}.field_priority_label`),
      placeholder: i18n.getValue(`${SECTION}.field_priority_placeholder`),
      type: 'select',
      options: mapLabeledOptions(SECTION, SALES_LEAD_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n),
      required: true,
      errorMessage: i18n.getValue(`${SECTION}.field_priority_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'last_contact_date',
      label: i18n.getValue(`${SECTION}.field_last_contact_date_label`),
      placeholder: i18n.getValue(`${SECTION}.field_last_contact_date_placeholder`),
      type: 'date',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'next_step',
      label: i18n.getValue(`${SECTION}.field_next_step_label`),
      placeholder: i18n.getValue(`${SECTION}.field_next_step_placeholder`),
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'description',
      label: i18n.getValue(`${SECTION}.field_description_label`),
      placeholder: i18n.getValue(`${SECTION}.field_description_placeholder`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'rejection_reason',
      label: i18n.getValue(`${SECTION}.field_rejection_reason_label`),
      placeholder: i18n.getValue(`${SECTION}.field_rejection_reason_placeholder`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
  ];
}

export function createSalesLeadColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'subject_name', header: i18n.getValue(`${SECTION}.col_subject`), type: 'text' },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'text' },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'text' },
    { key: 'salesman_name', header: i18n.getValue(`${SECTION}.col_salesman`), type: 'text' },
    { key: 'last_contact_date', header: i18n.getValue(`${SECTION}.col_last_contact`), type: 'date', format: 'd.M.yyyy' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'd.M.yyyy H:mm' },
  ];
}

export function createSalesLeadTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'subject_name', header: i18n.getValue(`${SECTION}.col_subject`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'd.M.yyyy H:mm' },
  ];
}

export function createSalesLeadFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'subject_name', header: i18n.getValue(`${SECTION}.col_subject`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_subject_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(SECTION, SALES_LEAD_STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'priority', header: i18n.getValue(`${SECTION}.col_priority`), type: 'select', options: mapLabeledOptions(SECTION, SALES_LEAD_PRIORITY_VALUES, PRIORITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_priority_placeholder`), canSort: true },
    { key: 'salesman_name', header: i18n.getValue(`${SECTION}.col_salesman`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_salesman_placeholder`), canSort: true },
  ];
}

/**
 * @description `importable: true` must match `SalesLeadController::IMPORTABLE_COLUMNS`.
 * `chartPossibleValues` stay the canonical VALUES arrays - same known limitation as elsewhere
 * (see the @note in `user-request.config.ts`).
 */
export function createSalesLeadDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'subject_name', displayName: i18n.getValue(`${SECTION}.details_subject`), type: 'text', importable: true },
    { key: 'contact_person', displayName: i18n.getValue(`${SECTION}.details_contact_person`), type: 'text', importable: true },
    { key: 'contact_email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text', importable: true },
    { key: 'contact_phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text', importable: true },
    { key: 'contact_other', displayName: i18n.getValue(`${SECTION}.details_contact_other`), type: 'text', importable: true },
    { key: 'location', displayName: i18n.getValue(`${SECTION}.details_location`), type: 'text', importable: true },
    { key: 'salesman_name', displayName: i18n.getValue(`${SECTION}.details_salesman`), type: 'text', importable: true, chartable: true },
    { key: 'source_channel', displayName: i18n.getValue(`${SECTION}.details_source_channel`), type: 'text', importable: true, chartable: true, chartPossibleValues: SALES_LEAD_SOURCE_CHANNEL_VALUES },
    { key: 'source_url', displayName: i18n.getValue(`${SECTION}.details_source_url`), type: 'text', importable: true },
    { key: 'status', displayName: i18n.getValue(`${SECTION}.details_status`), type: 'text', importable: true, chartable: true, chartPossibleValues: SALES_LEAD_STATUS_VALUES },
    { key: 'priority', displayName: i18n.getValue(`${SECTION}.details_priority`), type: 'text', importable: true, chartable: true, chartPossibleValues: SALES_LEAD_PRIORITY_VALUES },
    { key: 'first_contact_date', displayName: i18n.getValue(`${SECTION}.details_first_contact`), type: 'date', format: 'd.M.yyyy', importable: true },
    { key: 'last_contact_date', displayName: i18n.getValue(`${SECTION}.details_last_contact`), type: 'date', format: 'd.M.yyyy', importable: true },
    { key: 'next_step', displayName: i18n.getValue(`${SECTION}.details_next_step`), type: 'text', importable: true },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text', importable: true },
    { key: 'rejection_reason', displayName: i18n.getValue(`${SECTION}.details_rejection_reason`), type: 'text', importable: true },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'd.M.yyyy H:mm' },
  ];
}