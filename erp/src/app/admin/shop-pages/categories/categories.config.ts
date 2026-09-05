/**
 * @bugfix-note (2026-09-07) BACKLOG "granularizace shop permissions": žádné
 * tlačítko v tomto souboru dosud nemělo permission vůbec - kdokoliv s přístupem
 * do e-shop sekce mohl přidávat, upravovat i mazat kategorie bez ohledu na svá
 * oprávnění. Doplněno `shop-categories-create/-update/-delete` - viz
 * 002_shop_permissions_granularization.sql. `expandAll`/`collapseAll` zůstávají
 * bez permission - jde o čistě UI přepínač zobrazení stromu, nic nemutují ani
 * nenačítají navíc.
 */
import { Button } from '../../../shared/interfaces/button';

export const CATEGORY_TOOLBAR_BUTTONS: Button[] = [
  {
    action: 'expandAll',
    label: 'Rozbalit vše',
    icon: 'folder-open',
    class: 'btn-filter'
  },
  {
    action: 'collapseAll',
    label: 'Sbalit vše',
    icon: 'folder',
    class: 'btn-filter'
  },
  {
    action: 'addMain',
    label: 'Hlavní kategorie',
    icon: 'sparkles',
    class: 'btn-create',
    permission: 'shop-categories-create'
  }
];

/**
 * @icons-note (2026-08-31) EMOJI -> SVG: `icon` teď nese IconName klíč (SVG), NE
 * text s emoji přilepeným za sebou jako dřív (`icon: 'Podkategorie ➕'`). Skutečný
 * popisek tlačítka patří do `label` - `getRowButtons()` v categories.component.ts
 * ho renderoval jako prázdný `label: ''`, protože text byl schovaný v `icon`; to je
 * teď opraveno, `label` nese viditelný text vedle ikony.
 */
export const CATEGORY_ROW_BUTTONS: Button[] = [
  { action: 'addChild', label: 'Podkategorie', icon: 'plus', class: 'btn-create', permission: 'shop-categories-create' },
  { action: 'edit', label: 'Upravit', icon: 'edit', class: 'btn-export', permission: 'shop-categories-update' },
  { action: 'toggleStatus', label: 'Aktivní', icon: 'circle', class: 'btn-filter', permission: 'shop-categories-update' },
  { action: 'delete', label: 'Smazat', icon: 'delete', class: 'btn-trash', permission: 'shop-categories-delete' }
];