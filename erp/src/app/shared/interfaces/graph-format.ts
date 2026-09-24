/**
 * @file graph-format.ts
 * @path src/app/shared/interfaces/graph-format.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared types and static UI metadata for the generic report/graph
 * builder (GraphBuilderComponent).
 * @dependencies
 * - AdminLocalizationService: i18n lookup for chart-mode labels/descriptions
 *   (section `graph-builder`), passed into the factory functions below.
 *
 * @refactor-note (2026-08-27v11) BACKLOG "graf neukazuje hodnoty, které se nikdy
 * nezvolily (0×) - např. hodnocení 1-5, kde nikdo nedal '5'": přidáno volitelné
 * `possibleValues?: string[]` na `GraphColumnOption`. Pochází z JIŽ EXISTUJÍCÍCH
 * konstant, které stránka stejně používá pro `<select>` v `USER_REQUEST_FORM_FIELDS`/
 * filtry (`USER_REQUEST_STATUS_OPTIONS` apod., viz user-request.config.ts) - žádný
 * nový zdroj pravdy, jen se ta samá konstanta navíc předá do grafu. Bez tohoto pole
 * (default `undefined`) je chování BEZE ZMĚNY - graf ukáže jen hodnoty reálně
 * přítomné v datech, přesně jako dřív.
 *
 * @refactor-note (2026-09-25) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * - BUGFIX "české názvy typů grafů i v EN": `COLUMN_CHART_MODE_OPTIONS` /
 * `METRIC_CHART_MODE_OPTIONS` (static constants with hardcoded Czech `label`/
 * `description`) REMOVED and replaced by the same recipe as user-request.config.ts:
 * 1) `..._VALUES` arrays hold the canonical (never translated) chart-mode keys,
 * 2) `..._LABEL_KEYS` / `..._DESCRIPTION_KEYS` map value -> i18n key (explicit, greppable),
 * 3) factory functions `createColumnChartModeOptions(i18n)` /
 *    `createMetricChartModeOptions(i18n)` return fully translated `ChartModeOption`s.
 * Icons are language-neutral and stay static in `CHART_MODE_ICONS`.
 * GraphBuilderComponent calls the factories inside its `translations$` subscribe, so
 * the options are rebuilt on JSON load and on every admin language switch.
 */

import type { AdminLocalizationService } from '../../core/services/admin-localization.service';

/** i18n section holding all chart-mode texts (shared with GraphBuilderComponent). */
const SECTION = 'graph-builder';

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
 * @description Canonical (NEVER translated) chart-mode keys offered to every
 * CATEGORICAL (`aggregation: 'count'`) column in the sidebar's per-column chart-type
 * picker. Order = order in the select.
 */
export const COLUMN_CHART_MODE_VALUES: ColumnChartMode[] = ['bar', 'pie', 'doughnut', 'radar', 'polarArea', 'trend'];

/**
 * @description Canonical chart-mode keys offered to every NUMERIC
 * (`aggregation: 'sum' | 'avg'`) column - such columns have no meaningful
 * "distribution" (they aren't categories), they are always a value plotted over time;
 * only the visual style (line vs bar) is a real choice.
 */
export const METRIC_CHART_MODE_VALUES: MetricChartMode[] = ['line', 'bar'];

/** @description value -> i18n key of the option LABEL (section `graph-builder`). */
const COLUMN_CHART_MODE_LABEL_KEYS: Record<ColumnChartMode, string> = {
  bar: 'column_mode_bar',
  pie: 'column_mode_pie',
  doughnut: 'column_mode_doughnut',
  radar: 'column_mode_radar',
  polarArea: 'column_mode_polarArea',
  trend: 'column_mode_trend',
};

/** @description value -> i18n key of the option DESCRIPTION / tooltip (section `graph-builder`). */
const COLUMN_CHART_MODE_DESCRIPTION_KEYS: Record<ColumnChartMode, string> = {
  bar: 'column_mode_bar_desc',
  pie: 'column_mode_pie_desc',
  doughnut: 'column_mode_doughnut_desc',
  radar: 'column_mode_radar_desc',
  polarArea: 'column_mode_polarArea_desc',
  trend: 'column_mode_trend_desc',
};

/** @description value -> i18n key of the option LABEL (section `graph-builder`). */
const METRIC_CHART_MODE_LABEL_KEYS: Record<MetricChartMode, string> = {
  line: 'metric_mode_line',
  bar: 'metric_mode_bar',
};

/** @description value -> i18n key of the option DESCRIPTION / tooltip (section `graph-builder`). */
const METRIC_CHART_MODE_DESCRIPTION_KEYS: Record<MetricChartMode, string> = {
  line: 'metric_mode_line_desc',
  bar: 'metric_mode_bar_desc',
};

/**
 * @description Icons follow the same inline-SVG, stroke-based convention as
 * EXPORT_FORMAT_OPTIONS (export-format.ts) - 24x24, no viewBox, sized purely via CSS.
 * Language-neutral, therefore static. Shared by column and metric modes with the same key.
 */
const CHART_MODE_ICONS: Record<ColumnChartMode | MetricChartMode, string> = {
  bar: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
  pie: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`,
  doughnut: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/></svg>`,
  radar: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 21 8.5 17.5 20 6.5 20 3 8.5"/><polygon points="12 7 16.5 10.2 14.8 15.5 9.2 15.5 7.5 10.2"/></svg>`,
  polarArea: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="3"/><line x1="12" y1="12" x2="19.5" y2="16.5"/><line x1="12" y1="12" x2="4.5" y2="16.5"/></svg>`,
  trend: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>`,
  line: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>`,
};

/**
 * @description Shared mapper: canonical values -> translated `ChartModeOption`s.
 * Missing i18n keys resolve to `'Cannot load text'` (AdminLocalizationService
 * convention), never to a hidden Czech fallback.
 */
function mapChartModeOptions<T extends ColumnChartMode | MetricChartMode>(
  values: T[],
  labelKeys: Record<T, string>,
  descriptionKeys: Record<T, string>,
  i18n: AdminLocalizationService
): ChartModeOption<T>[] {
  return values.map(value => ({
    value,
    label: i18n.getValue(`${SECTION}.${labelKeys[value]}`),
    description: i18n.getValue(`${SECTION}.${descriptionKeys[value]}`),
    icon: CHART_MODE_ICONS[value],
  }));
}

/**
 * @description Translated chart-type options for CATEGORICAL columns.
 * @usage Call inside a `translations$` subscribe and store the result in a plain field
 * (not a getter) - see GraphBuilderComponent.
 */
export function createColumnChartModeOptions(i18n: AdminLocalizationService): ChartModeOption<ColumnChartMode>[] {
  return mapChartModeOptions(COLUMN_CHART_MODE_VALUES, COLUMN_CHART_MODE_LABEL_KEYS, COLUMN_CHART_MODE_DESCRIPTION_KEYS, i18n);
}

/**
 * @description Translated chart-type options for NUMERIC (sum/avg) columns.
 * @usage Same as `createColumnChartModeOptions()`.
 */
export function createMetricChartModeOptions(i18n: AdminLocalizationService): ChartModeOption<MetricChartMode>[] {
  return mapChartModeOptions(METRIC_CHART_MODE_VALUES, METRIC_CHART_MODE_LABEL_KEYS, METRIC_CHART_MODE_DESCRIPTION_KEYS, i18n);
}

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