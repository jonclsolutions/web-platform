/**
 * @file export-format.ts
 * @path src/app/shared/interfaces/export-format.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared type and static metadata for the table export format picker
 * (ExportPopupBuilderComponent + TableBuilderComponent).
 */

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'txt';

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  extension: string;
  description: string;
  icon: string;
}

/**
 * @description Icons are inline SVG (stroke-based, 24x24, no viewBox - sized purely via
 * CSS), consistent with the rest of the admin UI (see CoreDashboardComponent /
 * WebDashboardComponent ICONS maps).
 */
export const EXPORT_FORMAT_OPTIONS: ExportFormatOption[] = [
  {
    value: 'csv',
    label: 'CSV',
    extension: '.csv',
    description: 'Čárkami oddělené hodnoty - Excel, Google Sheets',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  },
  {
    value: 'xlsx',
    label: 'Excel',
    extension: '.xlsx',
    description: 'Sešit aplikace Microsoft Excel',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  },
  {
    value: 'json',
    label: 'JSON',
    extension: '.json',
    description: 'Strukturovaná data pro vývojáře a integrace',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/></svg>`,
  },
  {
    value: 'txt',
    label: 'TXT',
    extension: '.txt',
    description: 'Prostý text, tabulátory mezi sloupci',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  },
];