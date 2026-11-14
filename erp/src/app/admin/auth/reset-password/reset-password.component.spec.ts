/**
 * @file reset-password.component.spec.ts
 * @path src/app/admin/auth/reset-password/reset-password.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ResetPasswordComponent – setting a new password from the e-mailed
 *   link: token from the URL, the shared form, API errors and redirect to login; all texts from
 *   the admin translations `reset-password` (finding #39, the i18n double returns key paths). The
 *   form itself (policy, confirmation, toggles): set-password-form.component.spec.ts.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (auth stub), ActivatedRoute (stub with query params)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ResetPasswordComponent } from './reset-password.component';
import { SetPasswordFormComponent } from '../set-password-form/set-password-form.component';
import { By } from '@angular/platform-browser';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ResetPasswordComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let router: Router;
  const VALID = 'Heslo123!';

  const setup = async (token: string | null) => {
    ctx = createAdminTestContext({ loggedIn: false });
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [...ctx.providers, {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } }
      }]
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /**
   * @description The token is read from ?token=… in the link.
   * @input  URL ?token=abc
   * @output token 'abc'; tokenMissing false
   */
  it('reads the token from the URL', async () => {
    await setup('abc');
    expect(component.token).toBe('abc');
    expect(component.tokenMissing).toBeFalse();
  });

  const value = { password: VALID, password_confirmation: VALID };
  const form = () => fixture.debugElement.query(By.directive(SetPasswordFormComponent))?.componentInstance as SetPasswordFormComponent | undefined;

  /**
   * @description Without token there is no form; a submit explains why and calls nothing.
   * @input  URL without token; onSubmit(value)
   * @output tokenMissing true; no form; no API call
   */
  it('rejects a link without token', async () => {
    await setup(null);
    expect(form()).toBeUndefined();
    component.onSubmit(value);
    expect(ctx.auth.resetPassword).not.toHaveBeenCalled();
  });

  /**
   * @description The page shows the shared form with its texts and passes its state to it.
   * @input  token 'abc'
   * @output form section 'reset-password', submitting false, errorKey ''
   */
  it('shows the shared password form', async () => {
    await setup('abc');
    expect([form()!.section, form()!.submitting, form()!.errorKey]).toEqual(['reset-password', false, '']);
  });

  /**
   * @description A valid reset shows success and redirects to login after 4 s.
   * @input  token 'abc'; the form emits VALID twice; API returns { email: 'a@b.cz' }
   * @output resetPassword('abc', VALID, VALID); success true; changedForEmail 'a@b.cz'; no form; navigate(['/auth/login']) after 4000 ms
   */
  it('resets the password and redirects to login', fakeAsync(() => {
    setup('abc');
    tick();
    ctx.auth.resetPassword.and.returnValue(of({ email: 'a@b.cz' }));
    form()!.submitted.emit(value);
    expect(ctx.auth.resetPassword).toHaveBeenCalledWith('abc', VALID, VALID);
    expect(component.success).toBeTrue();
    expect(component.changedForEmail).toBe('a@b.cz');
    expect(form()).toBeUndefined();
    tick(3999);
    expect(router.navigate).not.toHaveBeenCalled();
    tick(1);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  }));

  /**
   * @description API errors map to translated messages (the English API texts are not shown) and
   *   reach the form: a password error → policy, no connection → network, anything else →
   *   invalid / expired link.
   * @input  error { error: { errors: { password: ['Too common.'] } } }; { status: 0 }; { error: { message: 'Expired' } }; {}
   * @output 'error_policy'; 'error_network'; 'error_generic'; 'error_generic'; the form shows the last one
   */
  it('maps API errors to translated messages', async () => {
    await setup('abc');
    const errors = [
      { error: { errors: { password: ['Too common.'] } } },
      { status: 0 },
      { error: { message: 'Expired' } },
      {}
    ];
    const shown: string[] = [];
    for (const e of errors) {
      ctx.auth.resetPassword.and.returnValue(throwError(() => e));
      component.onSubmit(value);
      shown.push(component.errorKey);
    }
    expect(shown).toEqual(['error_policy', 'error_network', 'error_generic', 'error_generic']);
    fixture.detectChanges();
    expect(form()!.errorKey).toBe('error_generic');
  });

  /**
   * @description Leaving the page before the redirect cancels it.
   * @input  successful reset; fixture.destroy(); 5 s pass
   * @output navigate not called
   */
  it('cancels the redirect when the page is left', fakeAsync(() => {
    setup('abc');
    tick();
    ctx.auth.resetPassword.and.returnValue(of({}));
    component.onSubmit(value);
    fixture.destroy();
    tick(5000);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  /**
   * @description The page renders its texts from the `reset-password` translations (no English copy).
   * @input  token 'abc'; detectChanges(); then success with e-mail
   * @output title / subtitle / labels / submit are reset-password keys; success for the e-mail
   */
  it('renders translated texts', fakeAsync(() => {
    setup('abc');
    tick();
    const el: HTMLElement = fixture.nativeElement;
    const text = el.textContent!;
    for (const key of ['title_form', 'subtitle', 'label_password', 'label_confirmation', 'submit']) {
      expect(text).toContain(`reset-password.${key}`);
    }
    expect(text).not.toContain('Set a new password');

    ctx.auth.resetPassword.and.returnValue(of({ email: 'a@b.cz' }));
    component.onSubmit(value);
    fixture.detectChanges();
    expect(el.textContent).toContain('reset-password.success_message_for');
    expect(el.textContent).toContain('a@b.cz');
    tick(4000);
  }));
});
