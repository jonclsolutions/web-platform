/**
 * @file unsaved-template.guard.ts
 * @path src/app/apps/js-creator/admin/images/editor/unsaved-template.guard.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Leaving the template editor with unsaved changes asks first (route
 *   `canDeactivate`); closing or reloading the tab is guarded by the editor itself
 *   (`beforeunload`).
 * @usage `canDeactivate: [unsavedTemplateGuard]` on the editor route.
 * @dependencies TemplateEditorComponent.canLeave().
 */

import { CanDeactivateFn } from '@angular/router';

/** Page that can refuse to be left. */
export interface LeavablePage {
  /** @description true = may leave (no changes, or the user confirmed). */
  canLeave(): boolean | Promise<boolean>;
}

/**
 * @description Asks the editor whether it may be left.
 * @param component The editor.
 */
export const unsavedTemplateGuard: CanDeactivateFn<LeavablePage> = component => component?.canLeave ? component.canLeave() : true;
