/**
 * @file export-format.ts
 * @path src/app/shared/interfaces/export-format.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared type and static metadata for the table export format picker
 * (ExportPopupBuilderComponent + TableBuilderComponent + ImportPopupBuilderComponent).
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * `EXPORT_FORMAT_OPTIONS` byla PŮVODNĚ statická konstanta vyhodnocená JEDNOU při
 * načtení modulu s natvrdo českým `description` textem - žádné přepnutí admin
 * jazyka za běhu by se do konzumentů nikdy nepropsalo. Přepsáno na FACTORY FUNKCI
 * `createExportFormatOptions(i18n)`, kterou volající komponenta čte přes GETTER (ne
 * jednorázové přiřazení), stejný vzor jako user-request.config.ts.
 * `label`/`extension`/`icon` zůstávají beze změny (technické/značkové názvy jako
 * "CSV"/"Excel"/".xlsx", ne popisný text) - překládá se jen `description`.
 *
 * @refactor-note (2026-09v2) BACKLOG "žádný český fallback": statická
 * `EXPORT_FORMAT_OPTIONS` konstanta (deprecated fallback s natvrdo českým textem)
 * ODSTRANĚNA - i jako "záložní" varianta porušovala pravidlo, že chybějící překlad
 * se má projevit jako 'Cannot load text', nikdy ne tichým pádem na češtinu.
 * VŠICHNI konzumenti (ExportPopupBuilderComponent, ImportPopupBuilderComponent)
 * přešli na `createExportFormatOptions(i18n)`. Pokud tenhle soubor po odstranění
 * hlásí TS chybu "Cannot find name 'EXPORT_FORMAT_OPTIONS'" někde jinde v projektu,
 * je to signál, že daný soubor ještě nebyl migrován na factory funkci - dohledej ho
 * a oprav stejným vzorem.
 */

import { AdminLocalizationService } from '../../core/services/admin-localization.service';

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'txt';

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  extension: string;
  description: string;
  icon: string;
}

const SECTION = 'export-format';

/**
 * @description Icons are inline SVG (stroke-based, 24x24, no viewBox - sized purely via
 * CSS), consistent with the rest of the admin UI (see CoreDashboardComponent /
 * WebDashboardComponent ICONS maps).
 */
export function createExportFormatOptions(i18n: AdminLocalizationService): ExportFormatOption[] {
  return [
    {
      value: 'csv',
      label: 'CSV',
      extension: '.csv',
      description: i18n.getValue(`${SECTION}.desc_csv`),
      icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
    },
    {
      value: 'xlsx',
      label: 'Excel',
      extension: '.xlsx',
      description: i18n.getValue(`${SECTION}.desc_xlsx`),
      icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    },
    {
      value: 'json',
      label: 'JSON',
      extension: '.json',
      description: i18n.getValue(`${SECTION}.desc_json`),
      icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/></svg>`,
    },
    {
      value: 'txt',
      label: 'TXT',
      extension: '.txt',
      description: i18n.getValue(`${SECTION}.desc_txt`),
      icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    },
  ];
}