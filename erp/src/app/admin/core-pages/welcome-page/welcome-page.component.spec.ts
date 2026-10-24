/**
 * @file welcome-page.component.spec.ts
 * @path src/app/admin/core-pages/welcome-page/welcome-page.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of WelcomePageComponent – the core welcome page: loads the logged-in
 *   user's profile, greets by name (fallback e-mail / default), formats dates in the admin locale.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (auth stub, DataHandler spy, i18n stub),
 *   CurrentUserProfileService (real, on top of the DataHandler spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { WelcomePageComponent } from './welcome-page.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('WelcomePageComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<WelcomePageComponent>;
  let component: WelcomePageComponent;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'welcome-page.welcome_message' ? 'Hello {name}' : p));
    await TestBed.configureTestingModule({ imports: [WelcomePageComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(WelcomePageComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description The profile of the logged-in user is loaded and used in the greeting.
   * @input  user id '1'; dataHandler.get('core/users/1') returns the payload { full_name: 'Jana Nová' }
   * @output dataHandler.get('core/users/1'); userData.full_name 'Jana Nová'; welcomeMessage 'Hello Jana Nová'; isLoadingProfile false
   */
  it('loads the profile and greets by name', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({ full_name: 'Jana Nová' }));
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/users/1');
    expect(component.userData?.full_name).toBe('Jana Nová');
    expect(component.welcomeMessage).toBe('Hello Jana Nová');
    expect(component.isLoadingProfile).toBeFalse();
  });

  /**
   * @description Without a profile name the greeting uses the e-mail.
   * @input  profile without full_name; email 'admin@example.test'
   * @output welcomeMessage 'Hello admin@example.test'
   */
  it('falls back to the e-mail in the greeting', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({}));
    component.ngOnInit();
    expect(component.welcomeMessage).toBe('Hello admin@example.test');
  });

  /**
   * @description A failed profile load shows the translated error.
   * @input  GET core/users/1 fails
   * @output errorMessage 'welcome-page.profile_load_error'; isLoadingProfile false
   */
  it('shows an error when the profile cannot be loaded', () => {
    (ctx.dataHandler as any).get.and.returnValue(throwError(() => new Error('x')));
    component.ngOnInit();
    expect(component.errorMessage).toBe('welcome-page.profile_load_error');
    expect(component.isLoadingProfile).toBeFalse();
  });

  /**
   * @description Without a user id no request is made.
   * @input  session userId null
   * @output dataHandler.get not called; isLoadingProfile false
   */
  it('does not load a profile without user id', () => {
    ctx.auth.session.userId = null;
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).not.toHaveBeenCalled();
    expect(component.isLoadingProfile).toBeFalse();
  });

  /**
   * @description Dates are shown in the admin locale; empty dates use the "empty" text.
   * @input  formatDate('2026-03-04T05:06:00'), formatDate(null)
   * @output '04. 03. 2026 05:06' (cs-CZ); 'welcome-page.empty_value'
   */
  it('formats dates in the admin locale', () => {
    expect(component.formatDate('2026-03-04T05:06:00')).toBe(new Date('2026-03-04T05:06:00').toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }));
    expect(component.formatDate(null)).toBe('welcome-page.empty_value');
  });

  /**
   * @description Role and e-mail come from the session; the e-mail stream is unsubscribed on destroy.
   * @input  ngOnInit(); userEmail$ emits 'new@x.cz'; ngOnDestroy(); emits 'later@x.cz'
   * @output userRole 'admin'; userEmail 'new@x.cz' (not 'later@x.cz')
   */
  it('follows the session e-mail until destroyed', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({}));
    component.ngOnInit();
    ctx.auth.userEmail$.next('new@x.cz');
    component.ngOnDestroy();
    ctx.auth.userEmail$.next('later@x.cz');
    expect(component.userRole).toBe('admin');
    expect(component.userEmail).toBe('new@x.cz');
  });

  /**
   * @description The page renders with the greeting.
   * @input  detectChanges() with full_name 'Jana Nová'
   * @output page text contains 'Hello Jana Nová'
   */
  it('renders the greeting', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({ full_name: 'Jana Nová' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hello Jana Nová');
  });
});
