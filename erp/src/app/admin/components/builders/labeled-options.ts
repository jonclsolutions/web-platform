/**
 * @file labeled-options.ts
 * @path src/app/admin/components/builders/labeled-options.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Builds the `{ value, label }` options of select fields and filters from the
 * canonical values stored in the database (English slugs, never translated) and the
 * translation keys of their labels - the one recipe shared by every page config.
 * @dependencies
 * - AdminLocalizationService: synchronous `getValue()` of the label.
 */

import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** @description One option of a select field / filter. */
export interface LabeledOption {
  value: string;
  label: string;
}

/**
 * @description Maps the canonical values to options with translated labels.
 * @param section i18n section of the page (e.g. 'user-request').
 * @param values Canonical values in display order.
 * @param labelKeys value -> translation key inside `section`.
 * @param i18n Admin localization service.
 * @returns `{ value, label }` pairs.
 * @usage `options: mapLabeledOptions(SECTION, STATUS_VALUES, STATUS_LABEL_KEYS, i18n)`
 */
export function mapLabeledOptions(
  section: string,
  values: string[],
  labelKeys: Record<string, string>,
  i18n: AdminLocalizationService,
): LabeledOption[] {
  return values.map(v => ({ value: v, label: i18n.getValue(`${section}.${labelKeys[v]}`) }));
}
