/**
 * @file apps.registry.ts
 * @path src/app/apps/apps.registry.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The applications built into this frontend - the only place that lists them.
 *   Code of one application never imports another one; when it offers something of another
 *   application (a link, a button), it asks here first, so removing an application leaves no
 *   broken link behind.
 * @usage `hasApp('shop')` before showing a link to the e-shop.
 * @note Removing an application = deleting its folders and its id here.
 */

/** Ids of the applications (the same ids as the API registry, config/apps.php). */
export type AppId = 'web' | 'shop' | 'project-portal';

/** Applications present in this build. */
export const INSTALLED_APPS: readonly AppId[] = ['web', 'shop', 'project-portal'];

/**
 * @description Whether an application is part of this build.
 * @param id Application id.
 * @returns true when installed.
 */
export function hasApp(id: AppId): boolean {
  return INSTALLED_APPS.includes(id);
}
