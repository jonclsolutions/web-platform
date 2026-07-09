export interface Button {
  action: string;
  label: string;
  icon?: string;
  class: string;
  isActive?: boolean; 
  disabled?: boolean;
  showIf?: boolean;   
  permission?: string; 
  toggleStates?: {     
    activeLabel: string;
    activeIcon: string;
    activeClass: string;
  };
}