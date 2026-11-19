/**
 * @file portal-login.component.spec.ts
 * @path src/app/apps/project-portal/public/portal-login/portal-login.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalLoginComponent: the shared sign-in layout (tagline, language
 *   switcher of the portal texts, card), the sign-in with a password, the e-mailed code and the
 *   error of a wrong password.
 * @dependencies portal.testing.ts (setUpPortal: PublicDataService and localization stubs, Router
 *   spy); ActivatedRoute stub with the token.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { PortalLoginComponent } from './portal-login.component';
import { PortalTestContext, failWith, setUpPortal } from '../portal.testing';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';

describe('PortalLoginComponent', () => {
  let ctx: PortalTestContext;
  let fixture: ComponentFixture<PortalLoginComponent>;
  let component: PortalLoginComponent;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    ctx = setUpPortal({
      imports: [PortalLoginComponent],
      start: false,
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'tok' }), queryParamMap: convertToParamMap({}) } } }],
    });
    fixture = TestBed.createComponent(PortalLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description The page uses the shared layout: tagline of the portal texts, the switcher with
   *   the portal languages (choosing one switches the portal texts), the form in the card.
   * @input Render; choose 'en' in the switcher.
   * @output .auth-hero-title 'login_hero_title'; 2 languages, current cz; form.auth-form inside
   *   .auth-card with the title 'login_title'; setLanguage('en').
   */
  it('renders the sign-in in the shared layout', () => {
    expect(el().querySelector('.auth-hero-title')!.textContent).toBe('login_hero_title');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(el().querySelector('.lang-trigger-code')!.textContent).toBe('CZ');
    expect(el().querySelector('.auth-card form.auth-form .card-title')!.textContent).toBe('login_title');

    component.selectLanguage('en');
    expect(TestBed.inject(ProjectPortalLocalizationService).setLanguage).toHaveBeenCalledWith('en');
  });

  /**
   * @description A password sign-in posts the credentials and opens the portal; a wrong password
   *   shows the error in the card.
   * @input jana / pw → ok; then → 401.
   * @output POST projects/public/tok/login {username, password}; navigate(['/projects', 'tok']);
   *   then .error-message 'error_invalid_login'.
   */
  it('signs in with a password', () => {
    component.loginUsername = 'jana';
    component.loginPassword = 'pw';
    component.login();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/login', { username: 'jana', password: 'pw' });
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok'], jasmine.objectContaining({ replaceUrl: true }));

    ctx.replies['/tok/login'] = failWith(401);
    component.login();
    fixture.detectChanges();
    expect(el().querySelector('.error-message')!.textContent).toBe('error_invalid_login');
  });

  /**
   * @description The code mode: the code is requested (neutral info), the code field appears and
   *   the code signs in.
   * @input mode code; identifier jana; request; code 123456; sign in.
   * @output POST …/login/code-request; .info-message 'login_code_sent'; .otp-input shown; POST
   *   …/login/code {identifier, code}; navigate to the portal.
   */
  it('signs in with an e-mailed code', () => {
    component.setLoginMode('code');
    component.loginUsername = 'jana';
    component.requestCode();
    fixture.detectChanges();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/login/code-request', { identifier: 'jana' });
    expect(el().querySelector('.info-message')!.textContent).toBe('login_code_sent');
    expect(el().querySelector('input.otp-input')).not.toBeNull();

    component.loginCode = '123 456';
    component.loginWithCode();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/login/code', { identifier: 'jana', code: '123456' });
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok'], jasmine.anything());
  });
});
