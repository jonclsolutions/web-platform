/**
 * @file reset-password.component.spec.ts
 * @path src/app/admin/auth/reset-password/reset-password.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ResetPasswordComponent – setting a new password from the e-mailed
 *   link: token from the URL, password policy, confirmation, API errors and redirect to login;
 *   all texts from the admin translations `reset-password` (finding #39, the i18n double returns key paths).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (auth stub), ActivatedRoute (stub with query params)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ResetPasswordComponent } from './reset-password.component';
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

  /**
   * @description Without token the form cannot be submitted and explains why.
   * @input  URL without token; onSubmit()
   * @output tokenMissing true; canSubmit false; errorKey 'error_token_missing'; no API call
   */
  it('rejects a link without token', async () => {
    await setup(null);
    component.password = VALID;
    component.passwordConfirmation = VALID;
    expect(component.canSubmit).toBeFalse();
    component.onSubmit();
    expect(component.errorKey).toBe('error_token_missing');
    expect(ctx.auth.resetPassword).not.toHaveBeenCalled();
  });

  /**
   * @description A weak password is rejected before calling the API.
   * @input  password 'short' (no digit/symbol, < 8 chars)
   * @output passwordValid false; errorKey 'error_policy'; no API call
   */
  it('rejects a password that breaks the policy', async () => {
    await setup('abc');
    component.password = 'short';
    component.passwordConfirmation = 'short';
    component.onSubmit();
    expect(component.passwordValid).toBeFalse();
    expect(component.errorKey).toBe('error_policy');
    expect(ctx.auth.resetPassword).not.toHaveBeenCalled();
  });

  /**
   * @description Different confirmation is detected and blocks submit.
   * @input  password VALID, confirmation 'Heslo123?'
   * @output passwordsMismatch true; errorKey 'error_mismatch'
   */
  it('detects a different confirmation', async () => {
    await setup('abc');
    component.password = VALID;
    component.passwordConfirmation = 'Heslo123?';
    expect(component.passwordsMismatch).toBeTrue();
    component.onSubmit();
    expect(component.errorKey).toBe('error_mismatch');
  });

  /**
   * @description A valid reset clears the fields, shows success and redirects to login after 4 s.
   * @input  token 'abc', VALID twice; API returns { email: 'a@b.cz' }
   * @output resetPassword('abc', VALID, VALID); success true; changedForEmail 'a@b.cz'; password ''; navigate(['/auth/login']) after 4000 ms
   */
  it('resets the password and redirects to login', fakeAsync(() => {
    setup('abc');
    tick();
    ctx.auth.resetPassword.and.returnValue(of({ email: 'a@b.cz' }));
    component.password = VALID;
    component.passwordConfirmation = VALID;
    component.onSubmit();
    expect(ctx.auth.resetPassword).toHaveBeenCalledWith('abc', VALID, VALID);
    expect(component.success).toBeTrue();
    expect(component.changedForEmail).toBe('a@b.cz');
    expect(component.password).toBe('');
    tick(3999);
    expect(router.navigate).not.toHaveBeenCalled();
    tick(1);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  }));

  /**
   * @description API errors map to translated messages (the English API texts are not shown): a password
   *   error → policy, no connection → network, anything else → invalid / expired link.
   * @input  error { error: { errors: { password: ['Too common.'] } } }; { status: 0 }; { error: { message: 'Expired' } }; {}
   * @output 'error_policy'; 'error_network'; 'error_generic'; 'error_generic'
   */
  it('maps API errors to translated messages', async () => {
    await setup('abc');
    component.password = VALID;
    component.passwordConfirmation = VALID;
    const errors = [
      { error: { errors: { password: ['Too common.'] } } },
      { status: 0 },
      { error: { message: 'Expired' } },
      {}
    ];
    const shown: string[] = [];
    for (const e of errors) {
      ctx.auth.resetPassword.and.returnValue(throwError(() => e));
      component.onSubmit();
      shown.push(component.errorKey);
    }
    expect(shown).toEqual(['error_policy', 'error_network', 'error_generic', 'error_generic']);
  });

  /**
   * @description The show/hide toggles switch the password fields.
   * @input  togglePasswordVisibility(), togglePasswordConfirmationVisibility()
   * @output showPassword true; showPasswordConfirmation true
   */
  it('toggles password visibility', async () => {
    await setup('abc');
    component.togglePasswordVisibility();
    component.togglePasswordConfirmationVisibility();
    expect(component.showPassword).toBeTrue();
    expect(component.showPasswordConfirmation).toBeTrue();
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
    component.password = VALID;
    component.passwordConfirmation = VALID;
    component.onSubmit();
    fixture.destroy();
    tick(5000);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  /**
   * @description The page renders its texts from the `reset-password` translations (no English copy).
   * @input  token 'abc'; detectChanges(); then token missing; then success with e-mail
   * @output title / labels / submit / placeholders are reset-password keys; invalid-link text; success for the e-mail
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
    expect(el.querySelector('#passwordConfirmation')!.getAttribute('placeholder')).toBe('reset-password.placeholder_confirmation');
    component.password = 'short';
    component.onSubmit();
    fixture.detectChanges();
    expect(el.textContent).toContain('reset-password.error_policy');

    ctx.auth.resetPassword.and.returnValue(of({ email: 'a@b.cz' }));
    component.password = VALID;
    component.passwordConfirmation = VALID;
    component.onSubmit();
    fixture.detectChanges();
    expect(el.textContent).toContain('reset-password.success_message_for');
    expect(el.textContent).toContain('a@b.cz');
    tick(4000);
  }));
});
