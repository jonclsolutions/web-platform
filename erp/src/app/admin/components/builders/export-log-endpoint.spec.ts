/**
 * @file export-log-endpoint.spec.ts
 * @path src/app/admin/components/builders/export-log-endpoint.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of exportLogEndpoint(): the audit log of the module that owns the data.
 * @dependencies none
 */

import { exportLogEndpoint } from './export-log-endpoint';

describe('exportLogEndpoint', () => {
  /**
   * @description Web / e-shop / core data are logged into their own module log; anything else
   *   (other prefix, leading slash, empty) into the core log.
   * @input 'web/projects', 'shop/customers', '/shop/orders', 'core/users', 'legal/sections', 'webshop/x', '', null.
   * @output web/logs, shop/logs, shop/logs, core/logs, core/logs ×4.
   */
  it('returns the log of the data module', () => {
    expect(exportLogEndpoint('web/projects')).toBe('web/logs');
    expect(exportLogEndpoint('shop/customers')).toBe('shop/logs');
    expect(exportLogEndpoint('/shop/orders')).toBe('shop/logs');
    expect(exportLogEndpoint('core/users')).toBe('core/logs');
    expect(exportLogEndpoint('legal/sections')).toBe('core/logs');
    expect(exportLogEndpoint('webshop/x')).toBe('core/logs');
    expect(exportLogEndpoint('')).toBe('core/logs');
    expect(exportLogEndpoint(null)).toBe('core/logs');
  });
});
