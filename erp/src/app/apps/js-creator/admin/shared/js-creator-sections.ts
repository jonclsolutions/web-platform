/**
 * @file js-creator-sections.ts
 * @path src/app/apps/js-creator/admin/shared/js-creator-sections.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sections of JS Creator - kinds of output with their own templates and permissions
 *   (`js-creator-<section>-view|create|update|delete`). The parts shared by every section
 *   (folders, outputs, library, fonts, trash) need the action in ANY section.
 * @usage `anySectionPermission('create')` in a route / nav item, `can(permissions, 'delete')` in
 *   a page.
 * @note A new section (videos, gifs) = one entry in JS_CREATOR_SECTIONS and its permissions in the
 *   API (the same list: api/app/Apps/JsCreator/Support/JsCreatorSections.php).
 */

import { PermissionService } from '../../../../core/auth/services/permission.service';

/** Ids of the sections. */
export type JsCreatorSectionId = 'images';

/** Action of a section permission. */
export type JsCreatorAction = 'view' | 'create' | 'update' | 'delete';

/** Sections in the order of the menu. */
export const JS_CREATOR_SECTIONS: readonly JsCreatorSectionId[] = ['images'];

/**
 * @description Permission of one action in one section.
 * @param section Section id.
 * @param action Action.
 * @returns E.g. `js-creator-images-view`.
 */
export function sectionPermission(section: JsCreatorSectionId, action: JsCreatorAction): string {
  return `js-creator-${section}-${action}`;
}

/**
 * @description Permission expression "the action in any section" (`a|b` = any of them).
 * @param action Action.
 * @returns E.g. `js-creator-images-create`.
 */
export function anySectionPermission(action: JsCreatorAction): string {
  return JS_CREATOR_SECTIONS.map(section => sectionPermission(section, action)).join('|');
}

/**
 * @description Whether the signed-in account may do the action in any section.
 * @param permissions Permission service of the admin.
 * @param action Action.
 * @returns true when at least one section permission is held.
 */
export function can(permissions: PermissionService, action: JsCreatorAction): boolean {
  return anySectionPermission(action).split('|').some(key => permissions.hasPermission(key));
}
