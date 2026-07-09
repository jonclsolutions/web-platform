export interface ColumnDefinition {
  key: string;
  header: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'image' | 'link';
  format?: string;
  hidden?: boolean;
  currencyCode?: 'CZK' | 'EUR' | 'USD' | 'GBP' | string; 
}