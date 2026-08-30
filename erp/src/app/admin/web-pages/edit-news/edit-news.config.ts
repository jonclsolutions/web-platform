/**
 * @file edit-news.config.ts
 * @path src/app/admin/web-pages/edit-news/edit-news.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static configuration (buttons, form fields, table/filter/detail columns) for
 * the News management page.
 * @refactor-note (2026-08-5) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php,
 *      table-buttons.ts a table-builder.component.ts stejné datum): doplněny reálné
 *      permission klíče na tlačítka, která dřív žádnou kontrolu neměla:
 *      - NEWS_TOOLBAR_BUTTONS: "Přidat novinku" dostalo `permission: 'web-news-create'`
 *        (dřív viditelné pro kohokoliv s přístupem na stránku, tedy i pro uživatele bez
 *        práva cokoliv vytvářet - jen se mu po odeslání formuláře vrátil 403 z API).
 *      - NEWS_BUTTONS (řádková tlačítka v tabulce): "Edit" -> `web-news-update`,
 *        "Smazat" -> `web-news-delete`. "Detaily" zůstává bez permission (čtení detailu
 *        je pokryté už tím, že se uživatel vůbec dostal na stránku, která vyžaduje
 *        `web-news-view`).
 *      TENTO SOUBOR JE VZOR pro granularizaci zbytku modulů (sales-leads, sales-orders,
 *      support-tickets, job-applications, administrators, external-links...) - stejný
 *      princip: `create`/`update`/`delete` klíče doplnit podle konvence
 *      `{resource}-{akce}` zavedené v api.php.
 *
 * @refactor-note (2026-08-23) BULK IMPORT/EXPORT: `NEWS_DETAILS_COLUMNS` má u VŠECH
 *      8 obsahových polí `importable: true` - odpovídá 1:1
 *      `WebNewsController::IMPORTABLE_COLUMNS`. Jen `id`/`created_at`/`updated_at`
 *      (systémová pole) importable NEDOSTÁVAJÍ - nejjednodušší dosavadní import ze
 *      všech resources, žádná výjimka jako u support_tickets (`state`) nebo
 *      raw_request_commissions (bez e-mailu/přílohy).
 */
import * as Core from '../../../shared/imports/core-providers';

export const NEWS_THEMA_OPTIONS: string[] = [
  'Milník', 
  'Update', 
  'Info', 
  'Novinka', 
  'Upozornění', 
  'Error', 
  'Údržba', 
  'Akce'
];

export const NEWS_TOOLBAR_BUTTONS: Core.Button[] = [
  {
    action: 'toggleFilters',
    label: 'Filtry',
    icon: '🔍',
    class: 'btn-filter',
    isActive: false
  },
  {
    action: 'handleCreateFormOpened',
    label: 'Přidat novinku',
    icon: '➕',
    class: 'btn-create',
    showIf: true,
    permission: 'web-news-create'
  },
  {
    action: 'exportActiveTable',
    label: 'Export',
    icon: '📥',
    class: 'btn-export',
    showIf: true
  },
   { action: 'triggerImport', label: 'Import', icon: '📤', class: 'btn-neutral', showIf: true },
   { action: 'openGraphBuilder', label: 'Grafy a reporty', icon: '📊', class: 'btn-neutral', showIf: true, permission: 'web-user-requests-view' },
  {
    action: 'toggleTable',
    label: 'Koš',
    icon: '🗑️',
    class: 'btn-trash',
    permission: 'view-deleted'
  }
];

export const NEWS_BUTTONS: Core.TableButtons[] = [
  { display_name: '🔎', header_name: 'Detaily', isActive: true, type: 'info_button', action: 'details' },
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit', permission: 'web-news-update' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete', permission: 'web-news-delete' },
];

export const NEWS_FORM_FIELDS: Core.InputDefinition[] = [
  {
    column_name: 'title',
    label: 'Titulek novinky',
    placeholder: 'Např. Nová verze systému 2.0',
    type: 'text',
    required: true,
    pattern: '^.{3,255}$',
    errorMessage: 'Titulek musí mít 3 až 255 znaků.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'thema',
    label: 'Téma / Kategorie',
    type: 'select',
    options: NEWS_THEMA_OPTIONS.map(t => ({ value: t, label: t })),
    required: true,
    errorMessage: 'Vyberte téma novinky.',
    editable: true,
    show_in_edit: true,
    show_in_create: true,
  },
  {
    column_name: 'author',
    label: 'Autor',
    placeholder: 'Jméno nebo oddělení',
    type: 'text',
    required: true,
    pattern: '^.{1,255}$',
    errorMessage: 'Autor musí být vyplněn (max. 255 znaků).',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
{
  column_name: 'message',
  label: 'Hlavní text zprávy',
  placeholder: 'Detailní popis novinky...',
  type: 'textarea',
  required: true,
  pattern: '^[\\s\\S]{1,10000}$',
  errorMessage: 'Obsah novinky může mít maximálně 10 000 znaků.',
  editable: true,
  show_in_edit: true,
  show_in_create: true
},
  {
    column_name: 'bullet_1',
    label: 'Důležitý bod 1',
    placeholder: 'Klíčová informace...',
    type: 'text',
    required: false,
    pattern: '^.{0,255}$',
    errorMessage: 'Maximální délka je 255 znaků.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'bullet_2',
    label: 'Důležitý bod 2',
    type: 'text',
    required: false,
    pattern: '^.{0,255}$',
    errorMessage: 'Maximální délka je 255 znaků.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'bullet_3',
    label: 'Důležitý bod 3',
    type: 'text',
    required: false,
    pattern: '^.{0,255}$',
    errorMessage: 'Maximální délka je 255 znaků.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  },
  {
    column_name: 'bullet_4',
    label: 'Důležitý bod 4',
    type: 'text',
    required: false,
    pattern: '^.{0,255}$',
    errorMessage: 'Maximální délka je 255 znaků.',
    editable: true,
    show_in_edit: true,
    show_in_create: true
  }
];

export const NEWS_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'title', header: 'Titulek', type: 'text' },
  { key: 'thema', header: 'Téma', type: 'text' },
  { key: 'author', header: 'Autor', type: 'text' },
  { key: 'created_at', header: 'Vytvořeno', type: 'date', format: 'short' }
];

export const NEWS_TRASH_COLUMNS: Core.ColumnDefinition[] = [
  { key: 'id', header: 'ID', type: 'text' },
  { key: 'title', header: 'Titulek', type: 'text' },
  { key: 'deleted_at', header: 'Smazáno', type: 'date', format: 'short' }
];

export const NEWS_FILTER_COLUMNS: Core.FilterColumns[] = [
  { key: 'id', header: 'ID', type: 'text', placeholder: 'Hledat ID', canSort: true },
  { key: 'title', header: 'Titulek', type: 'text', placeholder: 'Hledat v titulku', canSort: true },
  { key: 'author', header: 'Autor', type: 'text', placeholder: 'Hledat autora', canSort: true },
  { key: 'thema', header: 'Téma', type: 'select', options: NEWS_THEMA_OPTIONS, placeholder: '-- Vybrat téma --', canSort: true }
];

/**
 * @refactor-note (2026-08-23) `importable: true` u VŠECH 8 obsahových polí - viz
 * refactor-note v hlavičce souboru. `id`/`created_at`/`updated_at` ZÁMĚRNĚ bez
 * příznaku (systémová pole).
 */
export const NEWS_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID záznamu', type: 'text' },
  { key: 'title', displayName: 'Titulek', type: 'text', importable: true },
  {
    key: 'thema', displayName: 'Kategorie', type: 'text', importable: true,
    chartable: true, chartPossibleValues: NEWS_THEMA_OPTIONS,
  },
  { key: 'author', displayName: 'Autor', type: 'text', importable: true, chartable: true },
  { key: 'message', displayName: 'Hlavní zpráva', type: 'text', importable: true },
  { key: 'bullet_1', displayName: 'Bod 1', type: 'text', importable: true },
  { key: 'bullet_2', displayName: 'Bod 2', type: 'text', importable: true },
  { key: 'bullet_3', displayName: 'Bod 3', type: 'text', importable: true },
  { key: 'bullet_4', displayName: 'Bod 4', type: 'text', importable: true },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Upraveno', type: 'date', format: 'medium' }
];