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
    showIf: true
  },
  {
    action: 'exportActiveTable',
    label: 'Export CSV',
    icon: '📥',
    class: 'btn-export',
    showIf: true
  },
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
  { display_name: '✒️', header_name: 'Edit', isActive: true, type: 'neutral_button', action: 'edit' },
  { display_name: '🗑️', header_name: 'Smazat', isActive: true, type: 'delete_button', action: 'delete' },
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
    errorMessage: 'Obsah novinky nemůže být prázdný.',
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

export const NEWS_DETAILS_COLUMNS: Core.ItemDetailsColumns[] = [
  { key: 'id', displayName: 'ID záznamu', type: 'text' },
  { key: 'title', displayName: 'Titulek', type: 'text' },
  { key: 'thema', displayName: 'Kategorie', type: 'text' },
  { key: 'author', displayName: 'Autor', type: 'text' },
  { key: 'message', displayName: 'Hlavní zpráva', type: 'text' },
  { key: 'bullet_1', displayName: 'Bod 1', type: 'text' },
  { key: 'bullet_2', displayName: 'Bod 2', type: 'text' },
  { key: 'bullet_3', displayName: 'Bod 3', type: 'text' },
  { key: 'bullet_4', displayName: 'Bod 4', type: 'text' },
  { key: 'created_at', displayName: 'Vytvořeno', type: 'date', format: 'medium' },
  { key: 'updated_at', displayName: 'Upraveno', type: 'date', format: 'medium' }
];