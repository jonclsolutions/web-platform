/**
 * @file badge-tones.spec.ts
 * @path src/app/admin/components/builders/badge-tones.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the tones of the coloured labels: the shared importance scale and
 *   the tone of a value.
 * @dependencies none
 */

import { IMPORTANCE_TONES, badgeToneOf } from './badge-tones';

describe('badge tones', () => {
  /**
   * @description Importance (priority of inquiries / leads, severity of security events): only
   *   what needs attention has a colour; unknown values are neutral, empty values have no label.
   * @input  low, neutral, info, high, warning, critical, 'custom', '', null
   * @output neutral ×3, warning ×2, danger, neutral, null, null
   */
  it('maps importance to calm tones', () => {
    expect(['low', 'neutral', 'info', 'high', 'warning', 'critical'].map(v => badgeToneOf(IMPORTANCE_TONES, v)))
      .toEqual(['neutral', 'neutral', 'neutral', 'warning', 'warning', 'danger']);
    expect(badgeToneOf(IMPORTANCE_TONES, 'custom')).toBe('neutral');
    expect(badgeToneOf(IMPORTANCE_TONES, '')).toBeNull();
    expect(badgeToneOf(IMPORTANCE_TONES, null)).toBeNull();
  });
});
