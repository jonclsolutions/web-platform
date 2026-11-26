/**
 * @file export-format.ts
 * @path src/app/shared/interfaces/export-format.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared type and static metadata for the table export format picker
 * (ExportPopupBuilderComponent + TableBuilderComponent + ImportPopupBuilderComponent).
 */

import { AdminLocalizationService } from '../../core/services/admin-localization.service';
import type { AdminIconName } from '../../admin/components/admin-icon/admin-icon.component';

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'txt';

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  extension: string;
  description: string;
  /** Icon of AdminIconComponent (drawn by its template). */
  icon: AdminIconName;
}

const SECTION = 'export-format';

/**
 * @description The formats with their labels and icons (names of AdminIconComponent icons).
 */
export function createExportFormatOptions(i18n: AdminLocalizationService): ExportFormatOption[] {
  return [
    {
      value: 'csv',
      label: 'CSV',
      extension: '.csv',
      description: i18n.getValue(`${SECTION}.desc_csv`),
      icon: 'table',
    },
    {
      value: 'xlsx',
      label: 'Excel',
      extension: '.xlsx',
      description: i18n.getValue(`${SECTION}.desc_xlsx`),
      icon: 'file-lines',
    },
    {
      value: 'json',
      label: 'JSON',
      extension: '.json',
      description: i18n.getValue(`${SECTION}.desc_json`),
      icon: 'braces',
    },
    {
      value: 'txt',
      label: 'TXT',
      extension: '.txt',
      description: i18n.getValue(`${SECTION}.desc_txt`),
      icon: 'file-lines',
    },
  ];
}