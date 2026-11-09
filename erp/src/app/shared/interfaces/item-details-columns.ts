/**
 */
export interface ItemDetailsColumns {
  key: string;
  displayName: string;
  /** 'avatar': the value is the signed URL of a profile photo (null = the default image). */
  type: 'text' | 'file' | 'files' | 'currency' | 'date' | 'boolean' | 'image' | 'array' | 'object' | 'avatar';
  format?: string;
  importable?: boolean;
  chartable?: boolean;
  chartAggregation?: 'count' | 'sum' | 'avg';
  chartPossibleValues?: string[];
}