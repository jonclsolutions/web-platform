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
 *   implements `confirmLeave()`. Also the company profile (core/settings) - its unsaved tabs.
 * @dependencies Angular Router (CanDeactivateFn)
 * @note Closing / reloading the browser tab is asked by the browser itself (beforeunload).
 * @note A second Back while the window is open does not leave: every navigation is stopped at
 *   once and made again only after "leave". The agreement holds for that navigation only
 *   (AGREED_LEAVE_MS) - one that never comes cannot let a later way out skip the question.
 */

import { Location } from '@angular/common';
import { inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';

/** A page that may hold unsaved texts. */
export interface LeaveConfirmable {
  /**
   * @returns true = leave (nothing unsaved or the user agreed to lose it), false = stay; a
   *   promise = the page asks in its window and resolves with the answer.
   */
  confirmLeave(): boolean | Promise<boolean>;
}

/** The user agreed to leave (time of the answer, 0 = no): the next check lets the navigation go, once. */
let agreedAt = 0;

/**
 * How long an agreed leave waits for its navigation (ms): it follows at once (Back, a link); one
 * that never comes (nowhere to go back to) must not let a later way out skip the question.
 */
export const AGREED_LEAVE_MS = 5000;

/**
 * @description Asks the page before leaving it (see the file header). While the page asks, the
 *   navigation is stopped at once (the address stays on the page - also for the Back button, so
 *   a second Back with the window open only asks again and never leaves the application); after
 *   "leave" it is made again: Back goes back in the history, a link / button navigates to its
 *   address.
 * @note `canceledNavigationResolution: 'computed'` (app.config) puts the address back after a
 *   stopped Back.
 */
export const unsavedTextsGuard: CanDeactivateFn<LeaveConfirmable> = (component, _route, _state, nextState) => {
  if (!component || typeof component.confirmLeave !== 'function') {
    return true;
  }
  const agreed = agreedAt !== 0 && Date.now() - agreedAt < AGREED_LEAVE_MS;
  agreedAt = 0;
  if (agreed) {
    return true;
  }
  const answer = component.confirmLeave();
  if (typeof answer === 'boolean') {
    return answer;
  }
  const router = inject(Router);
  const location = inject(Location);
  const back = router.getCurrentNavigation()?.trigger === 'popstate';
  const target = nextState?.url ?? '/';
  void answer.then(leave => {
    if (!leave) return;
    agreedAt = Date.now();
    if (back) {
      location.back();
    } else {
      void router.navigateByUrl(target);
    }
  });
  return false;
};

/** @description Forgets an agreed leave that was not used (tests, a navigation that never came). */
export function resetUnsavedTextsGuard(): void {
  agreedAt = 0;
}
