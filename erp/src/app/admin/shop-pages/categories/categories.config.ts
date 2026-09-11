/**
 * @file categories.config.ts
 * @path src/app/admin/shop-pages/categories/categories.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop category tree buttons.
 *
 * (Earlier bugfix-note 2026-09-07 for permission granularization, and icons-note
 * 2026-08-31 for emoji->SVG icons, are unchanged - see version history.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded
 * texty": kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace potřeba - žádné enum
 * sloupce, jen UI text tlačítek. `toggleStatus` dynamický label ("Aktivní"/
 * "Neaktivní") ZŮSTÁVÁ řešen v komponentě (`getRowButtons()`), ne tady - stejně jako
 * dřív, jen teď přes `t()`.
 */
import { Button } from '../../../shared/interfaces/button';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-categories';

export function createCategoryToolbarButtons(i18n: AdminLocalizationService): Button[] {
  return [
    {
      action: 'expandAll',
      label: i18n.getValue(`${SECTION}.toolbar_expand_all`),
      icon: 'folder-open',
      class: 'btn-filter'
    },
    {
      action: 'collapseAll',
      label: i18n.getValue(`${SECTION}.toolbar_collapse_all`),
      icon: 'folder',
      class: 'btn-filter'
    },
    {
      action: 'addMain',
      label: i18n.getValue(`${SECTION}.toolbar_add_main`),
      icon: 'sparkles',
      class: 'btn-create',
      permission: 'shop-categories-create'
    }
  ];
}

/**
 * @description `toggleStatus` label/class je přepsán v `CategoriesComponent.getRowButtons()`
 * (dynamický podle `node.is_active`) - hodnoty zde jsou jen výchozí/fallback.
 */
export function createCategoryRowButtons(i18n: AdminLocalizationService): Button[] {
  return [
    { action: 'addChild', label: i18n.getValue(`${SECTION}.row_btn_add_child`), icon: 'plus', class: 'btn-create', permission: 'shop-categories-create' },
    { action: 'edit', label: i18n.getValue(`${SECTION}.row_btn_edit`), icon: 'edit', class: 'btn-export', permission: 'shop-categories-update' },
    { action: 'toggleStatus', label: i18n.getValue(`${SECTION}.row_btn_active`), icon: 'circle', class: 'btn-filter', permission: 'shop-categories-update' },
    { action: 'delete', label: i18n.getValue(`${SECTION}.row_btn_delete`), icon: 'delete', class: 'btn-trash', permission: 'shop-categories-delete' }
  ];
}