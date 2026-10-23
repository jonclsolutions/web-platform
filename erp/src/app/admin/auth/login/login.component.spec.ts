/**
 * @file login.component.spec.ts
 * @path src/app/admin/auth/login/login.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of LoginComponent – admin sign-in: credentials, CAPTCHA after failed
 *   attempts, two-factor (OTP) step with countdown and resend limit, forgot-password modal and
 *   clearing secrets on destroy.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (auth stub, public localization stub), TurnstileService (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { TurnstileService } from '../../../core/services/turnstile.service';
import {
  AdminTestContext, PublicTestContext, createAdminTestContext, createPublicTestContext
} from '../../../../testing/admin-test-helpers';

describe('LoginComponent', () => {
  let ctx: AdminTestContext;
  let pub: PublicTestContext;
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let router: Router;
  let turnstile: jasmine.SpyObj<TurnstileService>;

  beforeEach(async () => {
    localStorage.removeItem('admin_current_module');
    ctx = createAdminTestContext({ loggedIn: false });
    pub = createPublicTestContext({ login: { errors: { captcha_required: 'Confirm captcha', captcha_load: 'Captcha failed' } } });
    turnstile = jasmine.createSpyObj<TurnstileService>('TurnstileService', ['render', 'reset', 'remove']);
    turnstile.render.and.returnValue(Promise.resolve('widget-1'));
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [...ctx.providers, ...pub.providers, { provide: TurnstileService, useValue: turnstile }]
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.removeItem('admin_current_module'));

  /**
   * @description The login texts come from the 'login' section of the WEB translations.
   * @input  component init
   * @output setModule('web'); t.errors.captcha_required = 'Confirm captcha'
   */
  it('reads the web "login" translations', () => {
    expect(pub.localization.setModule).toHaveBeenCalledWith('web');
    expect(component.t.errors.captcha_required).toBe('Confirm captcha');
  });

  /**
   * @description Successful login without 2FA opens the core welcome page and selects the core module.
   * @input  email/password; login() returns {}
   * @output auth.login({ email, password, captcha_token: undefined }); navigate(['/admin/core/welcome-page']); localStorage module 'core'
   */
  it('logs in and opens the admin', () => {
    component.email = 'a@b.cz';
    component.password = 'secret';
    component.onLogin();
    expect(ctx.auth.login).toHaveBeenCalledWith({ email: 'a@b.cz', password: 'secret', captcha_token: undefined });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/core/welcome-page']);
    expect(localStorage.getItem('admin_current_module')).toBe('core');
  });

  /**
   * @description A failed login shows the error and clears the password.
   * @input  login() errors with message 'Invalid credentials.'
   * @output errorMessage 'Invalid credentials.'; password ''; isSubmitting false; no navigation
   */
  it('shows the login error and clears the password', () => {
    ctx.auth.login.and.returnValue(throwError(() => ({ message: 'Invalid credentials.' })));
    component.password = 'secret';
    component.onLogin();
    expect(component.errorMessage).toBe('Invalid credentials.');
    expect(component.password).toBe('');
    expect(component.isSubmitting).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  /**
   * @description When the API requires a CAPTCHA, the widget is rendered and further logins need its token.
   * @input  login() errors with captchaRequired; next tick; onLogin() again without token
   * @output turnstile.render() called; captchaRequired true; errorMessage 'Confirm captcha'; login called once
   */
  it('requires a CAPTCHA after repeated failures', fakeAsync(() => {
    ctx.auth.login.and.returnValue(throwError(() => ({ message: 'Too many attempts', captchaRequired: true })));
    component.onLogin();
    fixture.detectChanges();
    tick();
    expect(component.captchaRequired).toBeTrue();
    expect(turnstile.render).toHaveBeenCalled();
    component.onLogin();
    expect(component.errorMessage).toBe('Confirm captcha');
    expect(ctx.auth.login).toHaveBeenCalledTimes(1);
  }));

  /**
   * @description With 2FA the OTP step starts with a countdown; resend is locked for 60 s.
   * @input  login() returns { requires_2fa: true, login_token: 'lt', expires_in: 300 }
   * @output step 'otp'; countdownDisplay '5:00'; canResend false; no navigation yet
   */
  it('switches to the OTP step for 2FA accounts', fakeAsync(() => {
    ctx.auth.login.and.returnValue(of({ requires_2fa: true, login_token: 'lt', expires_in: 300 }));
    component.onLogin();
    expect(component.step).toBe('otp');
    expect(component.countdownDisplay).toBe('5:00');
    expect(component.canResend).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
    tick(1000);
    expect(component.countdownDisplay).toBe('4:59');
    discardPeriodicTasks();
  }));

  /**
   * @description The OTP input keeps digits only, max 6.
   * @input  input value '12a3-4567'
   * @output otpCode '123456'
   */
  it('accepts only 6 digits as OTP', () => {
    component.onOtpInput({ target: { value: '12a3-4567' } } as any);
    expect(component.otpCode).toBe('123456');
  });

  /**
   * @description A complete OTP is verified with the login token and opens the admin.
   * @input  OTP step with token 'lt'; otpCode '123456'; onVerifyOtp()
   * @output verifyTwoFactor('lt', '123456'); navigate(['/admin/core/welcome-page'])
   */
  it('verifies the OTP', fakeAsync(() => {
    ctx.auth.login.and.returnValue(of({ requires_2fa: true, login_token: 'lt', expires_in: 300 }));
    component.onLogin();
    component.otpCode = '123456';
    component.onVerifyOtp();
    expect(ctx.auth.verifyTwoFactor).toHaveBeenCalledWith('lt', '123456');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/core/welcome-page']);
    discardPeriodicTasks();
  }));

  /**
   * @description An incomplete OTP is not sent; a wrong OTP shows the error and clears the input.
   * @input  otpCode '123' → onVerifyOtp(); otpCode '999999' with API error 'Wrong code'
   * @output first: verifyTwoFactor not called; second: errorMessage 'Wrong code', otpCode ''
   */
  it('handles incomplete and wrong OTP codes', fakeAsync(() => {
    ctx.auth.login.and.returnValue(of({ requires_2fa: true, login_token: 'lt', expires_in: 300 }));
    component.onLogin();
    component.otpCode = '123';
    component.onVerifyOtp();
    expect(ctx.auth.verifyTwoFactor).not.toHaveBeenCalled();
    ctx.auth.verifyTwoFactor.and.returnValue(throwError(() => ({ message: 'Wrong code' })));
    component.otpCode = '999999';
    component.onVerifyOtp();
    expect(component.errorMessage).toBe('Wrong code');
    expect(component.otpCode).toBe('');
    discardPeriodicTasks();
  }));

  /**
   * @description Resend is allowed after 60 s; a server retryAfter extends the wait.
   * @input  OTP step; resend at 0 s, at 61 s (OK), then server error retryAfter 120
   * @output resendTwoFactor called once at 61 s; after the error canResend false
   */
  it('limits OTP resending', fakeAsync(() => {
    ctx.auth.login.and.returnValue(of({ requires_2fa: true, login_token: 'lt', expires_in: 300 }));
    component.onLogin();
    component.onResendOtp();
    expect(ctx.auth.resendTwoFactor).not.toHaveBeenCalled();
    tick(61000);
    component.onResendOtp();
    expect(ctx.auth.resendTwoFactor).toHaveBeenCalledWith('lt');
    tick(61000);
    ctx.auth.resendTwoFactor.and.returnValue(throwError(() => ({ message: 'Slow down', retryAfter: 120 })));
    component.onResendOtp();
    expect(component.canResend).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description Going back from the OTP step forgets the token, code and password.
   * @input  OTP step; backToCredentials()
   * @output step 'credentials'; otpCode ''; password ''
   */
  it('backToCredentials() resets the 2FA state', fakeAsync(() => {
    ctx.auth.login.and.returnValue(of({ requires_2fa: true, login_token: 'lt', expires_in: 300 }));
    component.password = 'secret';
    component.onLogin();
    component.otpCode = '12';
    component.backToCredentials();
    expect(component.step).toBe('credentials');
    expect(component.otpCode).toBe('');
    expect(component.password).toBe('');
  }));

  /**
   * @description Forgot password sends the trimmed e-mail and closes the modal after 3 s.
   * @input  openForgotModal(); resetEmail '  a@b.cz '; onResetPassword(); 3 s pass
   * @output requestPasswordReset('a@b.cz'); resetSent true; showForgotModal false after 3 s
   */
  it('sends the password reset e-mail', fakeAsync(() => {
    component.openForgotModal();
    component.resetEmail = '  a@b.cz ';
    component.onResetPassword();
    expect(ctx.auth.requestPasswordReset).toHaveBeenCalledWith('a@b.cz');
    expect(component.resetSent).toBeTrue();
    tick(3000);
    expect(component.showForgotModal).toBeFalse();
  }));

  /**
   * @description An empty e-mail is not sent; an API error is shown in the modal.
   * @input  resetEmail '   '; then 'a@b.cz' with error 'Too many requests'
   * @output first: no request; second: resetErrorMessage 'Too many requests'
   */
  it('validates the reset e-mail and shows errors', () => {
    component.resetEmail = '   ';
    component.onResetPassword();
    expect(ctx.auth.requestPasswordReset).not.toHaveBeenCalled();
    ctx.auth.requestPasswordReset.and.returnValue(throwError(() => ({ message: 'Too many requests' })));
    component.resetEmail = 'a@b.cz';
    component.onResetPassword();
    expect(component.resetErrorMessage).toBe('Too many requests');
  });

  /**
   * @description Leaving the page clears the password, OTP and removes the CAPTCHA widget.
   * @input  password set, CAPTCHA widget 'widget-1' rendered; fixture.destroy()
   * @output password ''; otpCode ''; turnstile.remove('widget-1')
   */
  it('clears secrets on destroy', fakeAsync(() => {
    ctx.auth.login.and.returnValue(throwError(() => ({ message: 'x', captchaRequired: true })));
    component.onLogin();
    fixture.detectChanges();
    tick();
    component.password = 'secret';
    fixture.destroy();
    expect(component.password).toBe('');
    expect(component.otpCode).toBe('');
    expect(turnstile.remove).toHaveBeenCalledWith('widget-1');
  }));
  /**
   * @description CAPTCHA lifecycle: a second required CAPTCHA resets the existing widget; the
   *   widget callbacks set / clear the token; a failed widget load shows the translated error.
   * @input captchaRequired twice; render callbacks; render rejecting.
   * @output reset('widget-1'); token 'tok' then null; errorMessage 'Captcha failed'.
   */
  it('resets, fills and reports the CAPTCHA widget', fakeAsync(() => {
    ctx.auth.login.and.returnValue(throwError(() => ({ message: 'x', captchaRequired: true })));
    component.onLogin();
    fixture.detectChanges();
    tick();
    const [, onToken, onExpired] = turnstile.render.calls.mostRecent().args as any[];
    onToken('tok');
    expect((component as any).captchaToken).toBe('tok');
    onExpired();
    expect((component as any).captchaToken).toBeNull();

    (component as any).captchaToken = 'tok';
    component.onLogin();
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(component.captchaRequired).toBeTrue();

    (component as any).captchaWidgetId = null;
    turnstile.render.and.callFake(() => Promise.reject(new Error('blocked')));
    (component as any).captchaToken = 'tok';
    component.onLogin();
    fixture.detectChanges();
    tick();
    expect(component.errorMessage).toBe('Captcha failed');
  }));
});
