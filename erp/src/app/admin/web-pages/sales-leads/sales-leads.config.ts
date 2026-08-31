/**
 * @file sales-leads.config.ts
 * @path src/app/admin/web-pages/sales-leads/sales-leads.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the Sales Leads (CRM) management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTEMU: SALES_LEAD_TOOLBAR_BUTTONS
 * "Pridat lead" -> permission web-sales-leads-create; SALES_LEAD_BUTTONS Edit/Link/Smazat
 * -> web-sales-leads-update/-delete.
 *
 * @refactor-note (2026-08-23) BULK IMPORT/EXPORT: importable: true u VSECH poli ze
 * StoreWebSalesLeadRequest KROME user_id - viz WebSalesLeadController::IMPORTABLE_COLUMNS.
 * user_id zustava vzdy null u importovanych leadu, salesman_name se PREBIRA ZE SOUBORU
 * (ne automaticky podle importujiciho admina, jak to dela store()).
 */
import * as Core from '../../../shared/imports/core-providers';

export const SALES_LEAD_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-sales-leads-update' },
  { display_name: '🔗', header_name: 'Link', isActive: true, type: 'neutral_button', action: 'generate_form', permission: 'web-sales-leads-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-sales-leads-delete' },
];

export const SALES_LEAD_TOOLBAR_BUTTONS: Core.Button[] = [
  { action: 'toggleFilters', label: 'Otevřít filtry', icon: '', class: 'btn-filter', isActive: false },
  { action: 'handleCreateFormOpened', label: 'Přidat záznam', icon: '', class: 'btn-create', showIf: true, permission: 'web-sales-leads-create' },
  { action: 'exportActiveTable', label: 'Exportovat data', icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: 'Importovat data', icon: '', class: 'btn-neutral', showIf: true },
    { action: 'openGraphBuilder', label: 'Generovat grafy a reporty', icon: '', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  { action: 'toggleTable', label: 'Zobrazit koš', icon: '', class: 'btn-trash', permission: 'view-deleted' }
];

export const SALES_LEAD_STATUS_OPTIONS: string[] = [
  'Nové', 'Probíhá komunikace', 'Příprava nabídky', 'Nabídka odeslána', 
  'Poptávkový formulář odeslán', 'Vyjednávání', 'Pozastaveno', 'Přebírá si dev team',
  'Uzavřeno - Získáno', 'Čeká se na fakturaci', 'Čeká se na zaplacení',
  'Uhrazeno - Projekt spuštěn', 'Uzavřeno - Ztraceno', 'Jiné'
];

export const SALES_LEAD_PRIORITY_OPTIONS: string[] = [
  'Nízká', 'Podprůměrná', 'Neutrální', 'Vysoká', 'Kritická'
];

export const SALES_LEAD_SOURCE_CHANNELS: string[] = [
  'LinkedIn - Direct Message', 'LinkedIn - Komentář/Post', 'Facebook - Skupina',
  'Facebook - Direct Message', 'Instagram - DM', 'X (Twitter)', 'WhatsApp',
  'Telegram', 'Webový formulář', 'Email - Studený (Cold Email)', 'Email - Newsletter',
  'Telefon - Studený (Cold Call)', 'Telefon - Příchozí poptávka', 'Osobní setkání',
  'Networking / Akce / Konference', 'Doporučení (Referral)', 'Bývalý klient',
  'Poptávkový portál', 'Google Moje Firma', 'Inzerát / Placená reklama (PPC)',
  'Partner / Affiliate', 'Jiný online kanál', 'Jiný offline kanál'
];

export const SALES_LEAD_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'subject_name',
    label: 'Název subjektu / Firmy',
    placeholder: 'Zadejte název firmy nebo jméno',
    type: 'text',
    required: true,
    pattern: '^.{2,255}$',
    errorMessage: 'Název subjektu musí mít alespoň 2 znaky.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  { column_name: 'user_id', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  { column_name: 'salesman_name', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  { column_name: 'contact_other', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  { column_name: 'source_url', label: '', type: 'hidden', required: false, editable: false, show_in_edit: true, show_in_create: true },
  {
    column_name: 'first_contact_date',
    label: 'První kontakt',
    placeholder: 'Vyberte datum prvního kontaktu',
    type: 'date',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'contact_person',
    label: 'Kontaktní osoba',
    placeholder: 'Celé jméno osoby',
    type: 'text',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'contact_email',
    label: 'Email',
    placeholder: 'priklad@firma.cz',
    type: 'email',
    required: false,
    pattern: '[^@]+@[^@]+\\.[^@]+',
    errorMessage: 'Zadejte platnou e-mailovou adresu.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'contact_phone',
    label: 'Telefon',
    placeholder: '+420 123 456 789',
    type: 'tel',
    required: false,
    pattern: '^(\\+?[0-9]{1,3})?[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}[\\s.-]?[0-9]{3,4}$',
    errorMessage: 'Zadejte platné telefonní číslo.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'location',
    label: 'Lokalita (Město/Region)',
    placeholder: 'Např. Praha, Jihomoravský kraj...',
    type: 'text',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'source_channel',
    label: 'Zdroj oslovení',
    placeholder: '-- Vyberte zdroj --',
    type: 'select',
    options: SALES_LEAD_SOURCE_CHANNELS.map(opt => ({ value: opt, label: opt })),
    required: true,
    errorMessage: 'Vyberte zdroj oslovení.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'status',
    label: 'Aktuální stav',
    placeholder: '-- Vyberte stav --',
    type: 'select',
    options: SALES_LEAD_STATUS_OPTIONS.map(opt => ({ value: opt, label: opt })),
    required: true,
    errorMessage: 'Vyberte aktuální stav leadu.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'priority',
    label: 'Priorita',
    placeholder: '-- Vyberte prioritu --',
    type: 'select',
    options: SALES_LEAD_PRIORITY_OPTIONS.map(opt => ({ value: opt, label: opt })),
    required: true,
    errorMessage: 'Vyberte prioritu leadu.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'last_contact_date',
    label: 'Naposledy kontaktováno',
    placeholder: 'Datum poslední interakce',
    type: 'date',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'next_step',
    label: 'Další krok',
    placeholder: 'Co je potřeba udělat dál?',
    type: 'text',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'description',
    label: 'Poznámka k případu',
    placeholder: 'Podrobnosti o leadu, specifické požadavky...',
    type: 'textarea',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'rejection_reason',
    label: 'Důvod zamítnutí',
    placeholder: 'Proč byl lead uzavřen jako ztracený?',
    type: 'textarea',
    required: false,
    editable: true,
    show_in_edit: true,
    show_in_create: false
  }
];

export const SALES_LEAD_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'subject_name', header: 'Subjekt / Firma', type: 'text' },
  { key: 'status', header: 'Stav', type: 'text' },
  { key: 'priority', header: 'Priorita', type: 'text' },
  { key: 'salesman_name', header: 'Obchodník', type: 'text' },
  { key: 'last_contact_date', header: 'Posl. kontakt', type: 'date', format: 'd.M.yyyy' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'd.M.yyyy H:mm' }
];

export const SALES_LEAD_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'subject_name', header: 'Subjekt', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'd.M.yyyy H:mm' }
];

export const SALES_LEAD_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'ID...', canSort: true },
  { key: 'subject_name', header: 'Subjekt', type: 'text', placeholder: 'Hledat firmu...', canSort: true },
  { key: 'status', header: 'Stav', type: 'select', options: SALES_LEAD_STATUS_OPTIONS, placeholder: '-- Stav --', canSort: true },
  { key: 'priority', header: 'Priorita', type: 'select', options: SALES_LEAD_PRIORITY_OPTIONS, placeholder: '-- Priorita --', canSort: true },
  { key: 'salesman_name', header: 'Obchodník', type: 'text', placeholder: 'Jméno...', canSort: true },
];

/**
 * @refactor-note (2026-08-23) importable: true u VSECH poli krome user_id - viz
 * refactor-note v hlavicce souboru. id/created_at (systemova pole) importable
 * nedostavaji.
 */
export const SALES_LEAD_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID Leadů', type: 'text' },
  { key: 'subject_name', displayName: 'Název subjektu', type: 'text', importable: true },
  { key: 'contact_person', displayName: 'Kontaktní osoba', type: 'text', importable: true },
  { key: 'contact_email', displayName: 'Email', type: 'text', importable: true },
  { key: 'contact_phone', displayName: 'Telefon', type: 'text', importable: true },
  { key: 'contact_other', displayName: 'Jiný kontakt', type: 'text', importable: true },
  { key: 'location', displayName: 'Lokalita', type: 'text', importable: true },
  { key: 'salesman_name', displayName: 'Obchodník', type: 'text', importable: true, chartable: true },
  {
    key: 'source_channel', displayName: 'Zdroj oslovení', type: 'text', importable: true,
    chartable: true, chartPossibleValues: SALES_LEAD_SOURCE_CHANNELS,
  },
  { key: 'source_url', displayName: 'Zdrojová URL', type: 'text', importable: true },
  {
    key: 'status', displayName: 'Stav', type: 'text', importable: true,
    chartable: true, chartPossibleValues: SALES_LEAD_STATUS_OPTIONS,
  },
  {
    key: 'priority', displayName: 'Priorita', type: 'text', importable: true,
    chartable: true, chartPossibleValues: SALES_LEAD_PRIORITY_OPTIONS,
  },
  { key: 'first_contact_date', displayName: 'První oslovení', type: 'date', format: 'd.M.yyyy', importable: true },
  { key: 'last_contact_date', displayName: 'Poslední kontakt', type: 'date', format: 'd.M.yyyy', importable: true },
  { key: 'next_step', displayName: 'Následný krok', type: 'text', importable: true },
  { key: 'description', displayName: 'Popis/Poznámka', type: 'text', importable: true },
  { key: 'rejection_reason', displayName: 'Důvod zamítnutí', type: 'text', importable: true },
  { key: 'created_at', displayName: 'Vytvořeno v systému', type: 'date', format: 'd.M.yyyy H:mm' }
];