/**
 * @file button.ts
 * @path src/app/shared/interfaces/button.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Config of a toolbar button of an admin list page - shared by ButtonBuilderComponent
 *   and ActionMenuBuilderComponent (the "Actions" menu).
 * @dependencies none
 */

export interface Button {
  action: string;
  label: string;
  icon?: string;
  class: string;
  isActive?: boolean; 
  disabled?: boolean;
  showIf?: boolean;   
  permission?: string; 
  /**
   * Something behind the action needs attention (e.g. the confirmation e-mail lacks texts): an
   * orange dot on the item and on the trigger of the Actions menu.
   */
  attention?: boolean;
  /** Tooltip / screen reader text of the attention dot. */
  attentionTitle?: string;
  /**
   * Colour of the attention dot: 'attention' (default, orange - a problem visitors / customers
   * see) or 'preparing' (grey - only a switched off language being prepared lacks something).
   */
  attentionTone?: 'attention' | 'preparing';
  toggleStates?: {     
    activeLabel: string;
    activeIcon: string;
    activeClass: string;
  };
}