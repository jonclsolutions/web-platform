/**
 * @file workspace-format.spec.ts
 * @path src/app/apps/js-creator/admin/shared/workspace-format.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the size and usage helpers of the workspace pages.
 * @dependencies none
 */

import { formatBytes, usageLevel, usagePercent } from './workspace-format';

describe('workspace-format', () => {
  /**
   * @description Sizes in B / kB / MB / GB with the decimal separator of the locale.
   * @input 512 B; 1536 B (cs); 5 MB (en); 1 GB
   * @output "512 B", "1,5 kB", "5 MB", "1 GB"
   */
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536, 'cs-CZ')).toBe('1,5 kB');
    expect(formatBytes(5 * 1024 * 1024, 'en-US')).toBe('5 MB');
    expect(formatBytes(1024 ** 3, 'en-US')).toBe('1 GB');
  });

  /**
   * @description Level and percent of the usage of a quota.
   * @input 10 / 100; 80 / 100; 100 / 100; 150 / 100; quota 0
   * @output ok 10; warning 80; full 100; full 100 (capped); full 100
   */
  it('rates the usage', () => {
    expect([usageLevel(10, 100), usagePercent(10, 100)]).toEqual(['ok', 10]);
    expect([usageLevel(80, 100), usagePercent(80, 100)]).toEqual(['warning', 80]);
    expect([usageLevel(100, 100), usagePercent(100, 100)]).toEqual(['full', 100]);
    expect([usageLevel(150, 100), usagePercent(150, 100)]).toEqual(['full', 100]);
    expect([usageLevel(0, 0), usagePercent(0, 0)]).toEqual(['full', 100]);
  });
});
