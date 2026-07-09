export interface ItemDetailsColumns {
  key: string;
  displayName: string;
  type: 'text' | 'file' | 'currency' | 'date' | 'boolean' | 'image' | 'array' | 'object';
  format?: string;
}
