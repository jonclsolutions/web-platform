/**
 * @file unsaved-texts.guard.ts
 * @path src/app/admin/components/translation-editor/unsaved-texts.guard.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Leaving a page of the texts (the list of the texts, the visual text editor) with
 *   unsaved edits asks first - any way out of the page: the Back button of the browser, the
 *   menu, "Otevřít editor", the close button of the editor. The page asks in its own window.
 * @usage `{ path: 'edit-website', canDeactivate: [unsavedTextsGuard], … }`; the page component
 *   implements `confirmLeave()`.
 * @dependencies Angular Router (CanDeactivateFn)
 * @note Closing / reloading the browser tab is asked by the browser itself (beforeunload).
 */

import { CanDeactivateFn } from '@angular/router';

/** A page that may hold unsaved texts. */
export interface LeaveConfirmable {
  /**
   * @returns true = leave (nothing unsaved or the user agreed to lose it), false = stay.
   */
  confirmLeave(): boolean | Promise<boolean>;
}

/** @description Asks the page before leaving it (see the file header). */
export const unsavedTextsGuard: CanDeactivateFn<LeaveConfirmable> =
  component => (component && typeof component.confirmLeave === 'function' ? component.confirmLeave() : true);
