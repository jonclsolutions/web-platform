/**
 * @file guest.guard.spec.ts
 * @path src/app/core/auth/guards/guest.guard.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of guestGuard: a valid session skips the login page, no session (or
 *   a logged out / expired one) shows it.
 * @dependencies
 * - AuthService stub (checkAuth), real Router.
 */

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';

import { ADMIN_HOME_URL, guestGuard } from './guest.guard';
import { AuthService } from '../auth.service';

describe('guestGuard', () => {
  let checkAuth: jasmine.Spy;

  beforeEach(() => {
    checkAuth = jasmine.createSpy('checkAuth');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { checkAuth } }]
    });
  });

  const run = () => firstValueFrom(
    TestBed.runInInjectionContext(() => guestGuard({} as any, {} as any)) as Observable<boolean | UrlTree>
  );

  /**
   * @description A valid session (restored by checkAuth) is sent to the admin at once.
   * @input checkAuth → true
   * @output UrlTree of ADMIN_HOME_URL
   */
  it('sends a signed-in user to the admin', async () => {
    checkAuth.and.returnValue(of(true));
    const result = await run();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(ADMIN_HOME_URL);
  });

  /**
   * @description Without a valid session the login page is shown.
   * @input checkAuth → false
   * @output true
   */
  it('shows the login page without a session', async () => {
    checkAuth.and.returnValue(of(false));
    expect(await run()).toBeTrue();
  });
});
