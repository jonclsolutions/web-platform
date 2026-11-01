/**
 * @file generic-form-column-definiton.ts
 * @path src/app/shared/interfaces/generic-form-column-definiton.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Shape of a single column configuration consumed by `TableBuilderComponent`
 * (table rendering, cell-value resolution) and its export pipeline.
 * @note This file defines ONLY the shape of the column configuration - `exportable` is enforced
 * (filtered on export) by `TableBuilderComponent.buildExportRows()`, not by this interface.
 */
export interface ColumnDefinition {
  key: string;
  header: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'image' | 'link';
  format?: string;
  hidden?: boolean;
  currencyCode?: 'CZK' | 'EUR' | 'USD' | 'GBP' | string;
  exportable?: boolean;
  importable?: boolean;
}