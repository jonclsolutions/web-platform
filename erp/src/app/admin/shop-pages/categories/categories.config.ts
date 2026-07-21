import { Button } from '../../../shared/interfaces/button';

export const CATEGORY_TOOLBAR_BUTTONS: Button[] = [
  {
    action: 'expandAll',
    label: 'Rozbalit vše',
    icon: '📂',
    class: 'btn-filter' 
  },
  {
    action: 'collapseAll',
    label: 'Sbalit vše',
    icon: '📁',
    class: 'btn-filter'
  },
  {
    action: 'addMain',
    label: 'Hlavní kategorie',
    icon: '✨',
    class: 'btn-create'
  }
];

export const CATEGORY_ROW_BUTTONS: Button[] = [
  { action: 'addChild', label: '', icon: 'Podkategorie ➕', class: 'btn-create' },
  { action: 'edit', label: '', icon: 'Upravit 📝', class: 'btn-export' },
  { action: 'toggleStatus', label: '', icon: 'Aktivní 🟢', class: 'btn-filter' },
  { action: 'delete', label: '', icon: 'Smazat 🗑️', class: 'btn-trash' }
];