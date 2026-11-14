/**
 * @file set-password-form.component.spec.ts
 * @path src/app/admin/auth/set-password-form/set-password-form.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of SetPasswordFormComponent – the shared "set a password" form of the
 *   account activation and password reset pages: the password policy, the confirmation, the
 *   visibility toggles, the texts of the section, the error of the page and the emitted value.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub: getValue returns the key path)
 */

import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetPasswordFormComponent, SetPasswordValue } from './set-password-form.component';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('SetPasswordFormComponent', () => {
  let fixture: ComponentFixture<SetPasswordFormComponent>;
  let component: SetPasswordFormComponent;
  let emitted: SetPasswordValue[];
  const VALID = 'Heslo123!';
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    const ctx = createAdminTestContext({ loggedIn: false });
    await TestBed.configureTestingModule({ imports: [SetPasswordFormComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(SetPasswordFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('section', 'reset-password');
    emitted = [];
    component.submitted.subscribe(v => emitted.push(v));
    fixture.detectChanges();
  });

  /** Sets the two fields and re-renders. */
  const enter = (password: string, confirmation: string) => {
    component.password = password;
    component.passwordConfirmation = confirmation;
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  };
  const button = () => el().querySelector('button[type="submit"]') as HTMLButtonElement;

  /**
   * @description Submit needs a policy-compliant password, a filled and equal confirmation and no
   *   running request; the mismatch hint appears only once the confirmation is typed.
   * @input weak / valid without confirmation / mismatch / valid pair / valid pair while submitting
   * @output canSubmit false, false, false (+ hint), true (button enabled), false
   */
  it('follows the password rules', () => {
    enter('abc', 'abc');
    expect(component.canSubmit).toBeFalse();
    enter(VALID, '');
    expect([component.canSubmit, component.passwordsMismatch]).toEqual([false, false]);
    enter(VALID, VALID + 'x');
    expect(component.canSubmit).toBeFalse();
    expect(el().querySelector('.field-error-text')!.textContent).toContain('reset-password.error_mismatch');
    enter(VALID, VALID);
    expect(component.canSubmit).toBeTrue();
    expect(button().disabled).toBeFalse();
    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();
    expect(component.canSubmit).toBeFalse();
    expect(button().textContent).toContain('reset-password.submitting');
  });

  /**
   * @description A valid form emits the value in the API shape; Enter on an invalid form (button
   *   disabled) emits nothing.
   * @input weak pair + submit; valid pair + submit
   * @output nothing; then one { password, password_confirmation }
   */
  it('emits only a valid password', () => {
    enter('abc', 'abc');
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(emitted).toEqual([]);
    enter(VALID, VALID);
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(emitted).toEqual([{ password: VALID, password_confirmation: VALID }]);
  });

  /**
   * @description Texts come from the section; the eye buttons switch the field types; the error
   *   of the page is shown.
   * @input render; click both toggles; errorKey 'error_network'
   * @output labels / placeholder keys; type text + hide label; alert with the error key
   */
  it('renders the texts, toggles and the error', () => {
    expect(el().querySelector('label[for="password"]')!.textContent).toContain('reset-password.label_password');
    expect(component.lengthPlaceholder).toBe('reset-password.placeholder_password');
    const toggles = el().querySelectorAll<HTMLButtonElement>('button.visibility-toggle');
    expect(toggles[0].getAttribute('aria-label')).toBe('reset-password.show_password');
    toggles[0].click();
    toggles[1].click();
    fixture.detectChanges();
    expect((el().querySelector('#password') as HTMLInputElement).type).toBe('text');
    expect((el().querySelector('#passwordConfirmation') as HTMLInputElement).type).toBe('text');
    expect(toggles[0].getAttribute('aria-label')).toBe('reset-password.hide_password');
    expect(el().querySelector('.state-box--error')).toBeNull();
    fixture.componentRef.setInput('errorKey', 'error_network');
    fixture.detectChanges();
    expect(el().querySelector('.state-box--error')!.textContent).toContain('reset-password.error_network');
  });
});
