/**
 * @file labeled-options.spec.ts
 * @path src/app/admin/components/builders/labeled-options.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of mapLabeledOptions(): canonical values keep their order and are
 *   paired with the translation of their label key inside the page section.
 * @dependencies none
 */

import { mapLabeledOptions } from './labeled-options';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

describe('mapLabeledOptions', () => {
  /**
   * @description Values stay untranslated, labels come from `<section>.<labelKey>`.
   * @input  section 'user-request', values ['new', 'done'], keys new -> status_new, done -> status_done
   * @output [{ new, 'T:user-request.status_new' }, { done, 'T:user-request.status_done' }]
   */
  it('pairs the canonical values with translated labels', () => {
    const i18n = { getValue: (path: string) => `T:${path}` } as unknown as AdminLocalizationService;
    expect(mapLabeledOptions('user-request', ['new', 'done'], { new: 'status_new', done: 'status_done' }, i18n)).toEqual([
      { value: 'new', label: 'T:user-request.status_new' },
      { value: 'done', label: 'T:user-request.status_done' },
    ]);
  });
});
