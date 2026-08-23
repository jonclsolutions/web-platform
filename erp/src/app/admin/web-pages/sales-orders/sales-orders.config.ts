/**
 * @file sales-orders.config.ts
 * @path src/app/admin/web-pages/sales-orders/sales-orders.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the Sales Orders (realizace zakázek) management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php a
 *      edit-news.config.ts stejné datum): doplněny reálné permission klíče:
 *      - SALES_ORDER_BUTTONS: "Edit" -> `web-sales-orders-update`,
 *        "Smazat" -> `web-sales-orders-delete`. "Detaily" zůstává bez permission.
 *      - SALES_ORDER_TOOLBAR_BUTTONS NEMÁ tlačítko "Přidat" (žádný
 *        `handleCreateFormOpened` v HTML ani `(createFormOpened)` output na
 *        app-table-builder - realizace vznikají automaticky ze Sales Leadů, viz
 *        info-banner v šabloně). Backend permission `web-sales-orders-create` proto
 *        existuje (pro interní API endpoint), ale ve UI zatím není co gatovat -
 *        nic tu tedy NEBYLO přidáno, aby nevznikl mrtvý/neviditelný permission check.
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA (GDPR): Odstraněn mrtvý `FORM_FIELDS` záznam
 * `dataProcessingAgreement` (`show_in_create:true` bez jakéhokoliv create tlačítka v UI,
 * `show_in_edit:false` - nikdy se nezobrazil vůbec nikde) a nahrazen READ-ONLY
 * zobrazením obou reálně existujících souhlasů (`data_processing_agreement`,
 * `tos_agreement`) v `SALES_ORDER_DETAILS_COLUMNS`. Backend teď tyto hodnoty skutečně
 * ukládá (viz WebSalesOrderController::store() a WebSalesOrder.php) - patří do Detailů,
 * kde admin/compliance audit reálně kontroluje, jestli klient souhlas dal, ne do
 * needitovatelného formuláře.
 */
import * as Core from '../../../shared/imports/core-providers';

export const SALES_ORDER_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-sales-orders-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-sales-orders-delete' },
];

export const SALES_ORDER_TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Filtry',
    icon: '🔍',
    class: 'btn-filter',
    isActive: false
  },
  {
    action: 'exportActiveTable',
    label: 'Export',
    icon: '📥',
    class: 'btn-export',
    showIf: true
  },
  { action: 'triggerImport', label: 'Import', icon: '📤', class: 'btn-neutral', showIf: true },
  {
    action: 'toggleTable',
    label: 'Koš',
    icon: '🗑️',
    class: 'btn-trash',
    permission: 'view-deleted'
  }
];

/**
 * @refactor-note (2026-08-2) `attachment` (jednosouborové pole, type: 'file') nahrazeno
 * `attachments` (type: 'files', vícenásobný upload) - sedí s backendem, který teď ukládá
 * přílohy do `web_attachments` (viz WebSalesOrderController). `show_in_edit` nastaveno na
 * `true` (dřív `false`) - backend `update()` teď umí přílohy přidávat i při editaci
 * záznamu, ne jen při vytvoření (přidávají se k existujícím, nenahrazují je).
 * @bugfix-note (2026-08-15) Mrtvý `dataProcessingAgreement` field odstraněn - viz
 * hlavička souboru. Souhlas se nyní zobrazuje jen v DETAILS_COLUMNS (read-only).
 */
export const SALES_ORDER_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'client_name',
    label: 'Název klienta / Jméno',
    placeholder: 'Zadejte název firmy nebo jméno',
    type: 'text',
    required: true,
    errorMessage: 'Jméno klienta je povinné.',
    editable: true, show_in_edit: true, show_in_create: true,
  },
  {
    column_name: 'ico',
    label: 'IČO',
    placeholder: 'Zadejte IČO',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'client_email',
    label: 'E-mail klienta',
    placeholder: 'email@klient.cz',
    type: 'email',
    required: true, 
    pattern: '[^@]+@[^@]+\\.[^@]+',
    errorMessage: 'Neplatný formát e-mailu.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'client_phone',
    label: 'Telefon',
    placeholder: 'Telefonní číslo',
    type: 'tel',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'client_address',
    label: 'Adresa klienta',
    placeholder: 'Ulice, město, PSČ',
    type: 'text',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'order_description',
    label: 'Popis realizace',
    placeholder: 'Specifikace objednávky...',
    type: 'textarea',
    required: true,
    errorMessage: 'Popis realizace je povinný.',
    editable: true, show_in_edit: true, show_in_create: true
  },
  {
    column_name: 'attachments',
    label: 'Přílohy / Smlouva',
    type: 'files',
    required: false,
    editable: true, show_in_edit: true, show_in_create: true
  }
];

export const SALES_ORDER_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'client_name', header: 'Klient', type: 'text' },
  { key: 'salesman_name', header: 'Obchodník', type: 'text' },
  { key: 'ico', header: 'IČO', type: 'text' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
];

export const SALES_ORDER_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'client_name', header: 'Klient', type: 'text' },
  { key: 'salesman_name', header: 'Obchodník', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const SALES_ORDER_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID', canSort: true },
  { key: 'client_name', header: 'Klient', type: 'text', placeholder: 'Hledat klienta', canSort: true },
  { key: 'salesman_name', header: 'Obchodník', type: 'text', placeholder: 'Hledat obchodníka', canSort: true },
  { key: 'ico', header: 'IČO', type: 'text', placeholder: 'Hledat IČO', canSort: true }
];

/**
 * @refactor-note (2026-08-2) `attachment_url` (type: 'file') nahrazeno `attachments`
 * (type: 'files') - detail teď vypíše VŠECHNY přílohy záznamu, ne jen jednu.
 * @bugfix-note (2026-08-15) Doplněny `data_processing_agreement` a `tos_agreement`
 * (read-only, typ boolean) - viz hlavička souboru. Umístěny hned za `order_description`,
 * ať jsou v detailu vidět pohromadě s obsahem objednávky, kterého se souhlas týká.
 */
export const SALES_ORDER_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Objednávky', type: 'text' },
  { key: 'client_name', displayName: 'Klient', type: 'text' },
  { key: 'ico', displayName: 'IČO', type: 'text' },
  { key: 'salesman_name', displayName: 'Obchodník', type: 'text' },
  { key: 'client_email', displayName: 'Email', type: 'text' },
  { key: 'client_phone', displayName: 'Telefon', type: 'text' },
  { key: 'client_address', displayName: 'Adresa', type: 'text' },
  { key: 'order_description', displayName: 'Popis realizace', type: 'text' },
  { key: 'data_processing_agreement', displayName: 'Souhlas se zpracováním údajů (GDPR)', type: 'boolean' },
  { key: 'tos_agreement', displayName: 'Souhlas s obchodními podmínkami', type: 'boolean' },
  { key: 'attachments', displayName: 'Přílohy / Smlouva', type: 'files' },
  { key: 'created_at', displayName: 'Datum vytvoření', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Poslední změna', type: 'date', format: 'medium' }
];