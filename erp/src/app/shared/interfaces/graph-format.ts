/**
 * @file graph-format.ts
 * @path src/app/shared/interfaces/graph-format.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared types and static UI metadata for the generic report/graph
 * builder (GraphBuilderComponent).
 *
 * @refactor-note (2026-08-27v11) BACKLOG "graf neukazuje hodnoty, které se nikdy
 * nezvolily (0×) - např. hodnocení 1-5, kde nikdo nedal '5'": přidáno volitelné
 * `possibleValues?: string[]` na `GraphColumnOption`. Pochází z JIŽ EXISTUJÍCÍCH
 * konstant, které stránka stejně používá pro `<select>` v `USER_REQUEST_FORM_FIELDS`/
 * filtry (`USER_REQUEST_STATUS_OPTIONS` apod., viz user-request.config.ts) - žádný
 * nový zdroj pravdy, jen se ta samá konstanta navíc předá do grafu. Bez tohoto pole
 * (default `undefined`) je chování BEZE ZMĚNY - graf ukáže jen hodnoty reálně
 * přítomné v datech, přesně jako dřív.
 */

export type DistributionChartType = 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea';
export type ColumnChartMode = DistributionChartType | 'trend';
export type MetricChartMode = 'bar' | 'line';

export interface ChartModeOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: string;
}

/**
 * @description Icons follow the same inline-SVG, stroke-based convention as
 * EXPORT_FORMAT_OPTIONS (export-format.ts) - 24x24, no viewBox, sized purely via CSS.
 * Offered to every CATEGORICAL (`aggregation: 'count'`) column in the sidebar's
 * per-column chart-type picker.
 */
export const COLUMN_CHART_MODE_OPTIONS: ChartModeOption<ColumnChartMode>[] = [
  {
    value: 'bar',
    label: 'Sloupcový',
    description: 'Porovnání počtu záznamů podle hodnoty.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
  },
  {
    value: 'pie',
    label: 'Koláčový',
    description: 'Podíl jednotlivých hodnot na celku. Hodnoty s 0 výskyty nelze zobrazit (nulová výseč nemá geometrický smysl).',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`,
  },
  {
    value: 'doughnut',
    label: 'Prstencový',
    description: 'Jako koláčový, s prázdným středem. Hodnoty s 0 výskyty nelze zobrazit.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/></svg>`,
  },
  {
    value: 'radar',
    label: 'Radar',
    description: 'Hodnoty rozmístěné po obvodu paprsků - umí zobrazit i hodnoty s 0 výskyty.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 21 8.5 17.5 20 6.5 20 3 8.5"/><polygon points="12 7 16.5 10.2 14.8 15.5 9.2 15.5 7.5 10.2"/></svg>`,
  },
  {
    value: 'polarArea',
    label: 'Polární',
    description: 'Kruhové výseče se stejným úhlem, velikost podle počtu - umí zobrazit i hodnoty s 0 výskyty.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="3"/><line x1="12" y1="12" x2="19.5" y2="16.5"/><line x1="12" y1="12" x2="4.5" y2="16.5"/></svg>`,
  },
  {
    value: 'trend',
    label: 'Vývoj v čase',
    description: 'Jedna barevná čára pro každou hodnotu, v čase - umí zobrazit i hodnoty s 0 výskyty.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>`,
  },
];

/**
 * @description Offered to every NUMERIC (`aggregation: 'sum' | 'avg'`) column - such
 * columns have no meaningful "distribution" (they aren't categories), they are always
 * a value plotted over time; only the visual style (bar vs line) is a real choice.
 */
export const METRIC_CHART_MODE_OPTIONS: ChartModeOption<MetricChartMode>[] = [
  {
    value: 'line',
    label: 'Spojnicový',
    description: 'Hodnota metriky v čase jako křivka.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>`,
  },
  {
    value: 'bar',
    label: 'Sloupcový',
    description: 'Hodnota metriky v čase jako sloupce.',
    icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
  },
];

/**
 * @description Reduced column shape offered to the report builder's sidebar.
 * @property possibleValues Volitelný ÚPLNÝ seznam hodnot, které pole může nabývat
 * (typicky stejná konstanta jako u `<select>` formulářového pole/filtru - viz
 * refactor-note 2026-08-27v11 výše). Když je vyplněný, `GraphBuilderComponent`
 * doplní do katalogu hodnot i ty, které se v datech vůbec nevyskytly (s počtem 0) -
 * bez tohoto pole se zobrazí jen reálně pozorované hodnoty (dosavadní chování).
 */
export interface GraphColumnOption {
  key: string;
  label: string;
  aggregation: 'count' | 'sum' | 'avg';
  possibleValues?: string[];
}