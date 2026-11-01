/**
 */
export interface ItemDetailsColumns {
  key: string;
  displayName: string;
  type: 'text' | 'file' | 'files' | 'currency' | 'date' | 'boolean' | 'image' | 'array' | 'object';
  format?: string;
  importable?: boolean;
  chartable?: boolean;
  chartAggregation?: 'count' | 'sum' | 'avg';
  chartPossibleValues?: string[];
}