/**
 * @file requires-apps.ts
 * @path src/testing/requires-apps.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Guard of a test that checks the core together with particular applications (their
 *   real manifests, routes or texts): without them installed the test is skipped (pending), not
 *   failed - so the removal check of an application (tests/module_removal/check.sh) runs every
 *   spec, and a skipped test names the application it needs. Used only by *.spec.ts files.
 * @usage `it('…', () => { requiresApps('shop'); … })`
 * @dependencies jasmine (global `pending`), apps.registry.
 */

import { AppId, hasApp } from '../app/apps/apps.registry';

/**
 * @description Skips the current test when one of the applications is not installed.
 * @param ids Applications the test needs.
 */
export function requiresApps(...ids: AppId[]): void {
  const missing = ids.filter(id => !hasApp(id));
  if (missing.length) {
    pending(`needs the application(s) ${missing.join(', ')}`);
  }
}
