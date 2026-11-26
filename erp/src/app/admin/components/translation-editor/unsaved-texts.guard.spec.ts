/**
 * @file unsaved-texts.guard.spec.ts
 * @path src/app/admin/components/translation-editor/unsaved-texts.guard.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the guard of the pages of the texts: it asks the page, a page without
 *   `confirmLeave` (or none) is left at once; while the page asks, the navigation is stopped at
 *   once and made again after "leave" (Back → history back, else the address), never twice.
 * @dependencies unsavedTextsGuard, Router, Location (spied)
 */

import { Location } from '@angular/common';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { LeaveConfirmable, resetUnsavedTextsGuard, unsavedTextsGuard } from './unsaved-texts.guard';

describe('unsavedTextsGuard', () => {
  let router: jasmine.SpyObj<Router>;
  let location: jasmine.SpyObj<Location>;
  let trigger: 'imperative' | 'popstate' = 'imperative';

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl', 'getCurrentNavigation']);
    router.navigateByUrl.and.resolveTo(true);
    router.getCurrentNavigation.and.callFake(() => ({ trigger }) as any);
    location = jasmine.createSpyObj<Location>('Location', ['back']);
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }, { provide: Location, useValue: location }] });
    trigger = 'imperative';
    resetUnsavedTextsGuard();
  });

  afterEach(() => resetUnsavedTextsGuard());

  const run = (component: unknown, url = '/admin/web/dashboard') => TestBed.runInInjectionContext(() =>
    unsavedTextsGuard(component as LeaveConfirmable, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, { url } as RouterStateSnapshot));

  /**
   * @description A plain answer of the page decides; without the method / a page the way is free.
   * @input pages answering false, true; {}; null
   * @output false; true; true; true
   */
  it('asks the page before leaving it', () => {
    expect(run({ confirmLeave: () => false })).toBeFalse();
    expect(run({ confirmLeave: () => true })).toBeTrue();
    expect(run({})).toBeTrue();
    expect(run(null)).toBeTrue();
  });

  /**
   * @description While the page asks, the navigation stops at once (a second Back only asks again);
   *   "stay" does nothing, "leave" makes it again - by the address for a link, by history back for
   *   Back - and that one passes the guard once.
   * @input a link to the dashboard answered stay, then leave; Back answered leave
   * @output false at once; nothing on stay; navigateByUrl(dashboard) on leave, then the guard true
   *   once and asking again after; Back → false, location.back() on leave
   */
  it('stops the navigation while asking and makes it again after leave', fakeAsync(() => {
    let answer!: (leave: boolean) => void;
    const page = { confirmLeave: () => new Promise<boolean>(resolve => { answer = resolve; }) };
    expect(run(page)).toBeFalse();
    answer(false);
    flushMicrotasks();
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    expect(run(page)).toBeFalse();
    answer(true);
    flushMicrotasks();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/admin/web/dashboard');
    expect(run(page)).toBeTrue();
    expect(run(page)).toBeFalse();
    answer(false);
    flushMicrotasks();

    trigger = 'popstate';
    expect(run(page)).toBeFalse();
    expect(run(page)).toBeFalse(); // a second Back with the window open: asks again, stays
    answer(true);
    flushMicrotasks();
    expect(location.back).toHaveBeenCalledTimes(1);
  }));
});
