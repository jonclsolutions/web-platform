/**
 * @file export-log-endpoint.ts
 * @path src/app/admin/components/builders/export-log-endpoint.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log endpoint of an export / report of the table and graph builders: the log
 *   of the module that owns the data (`web/logs`, `shop/logs`, `core/logs`), taken from the first
 *   segment of the builder's API endpoint. Anything else (e.g. `legal/...`) goes to the core log.
 * @usage `new EntityCrudService(dataHandler, () => exportLogEndpoint(this.apiEndpoint), destroy$)`
 * @dependencies none
 */

/** Modules with their own audit log (`POST {module}/logs`). */
const LOG_MODULES = ['web', 'shop', 'core'];

/**
 * @description Audit log endpoint of the module of an API endpoint.
 * @param apiEndpoint API endpoint of the exported data (e.g. `shop/customers`).
 * @returns `{module}/logs`, or `core/logs` for an endpoint of no module.
 */
export function exportLogEndpoint(apiEndpoint: string | null | undefined): string {
  const module = (apiEndpoint ?? '').replace(/^\/+/, '').split('/')[0];
  return LOG_MODULES.includes(module) ? `${module}/logs` : 'core/logs';
}
