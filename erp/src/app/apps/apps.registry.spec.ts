/**
 * @file apps.registry.spec.ts
 * @path src/app/apps/apps.registry.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the application registry of the frontend.
 * @dependencies apps.registry
 */

import { hasApp, INSTALLED_APPS } from './apps.registry';

describe('apps.registry', () => {
  /**
   * @description Every application of this build is installed and known by hasApp().
   * @input INSTALLED_APPS; hasApp of each id
   * @output ['web', 'shop', 'project-portal']; true for each
   */
  it('lists the installed applications', () => {
    expect([...INSTALLED_APPS]).toEqual(['web', 'shop', 'project-portal']);
    expect(INSTALLED_APPS.every(id => hasApp(id))).toBeTrue();
  });
});
