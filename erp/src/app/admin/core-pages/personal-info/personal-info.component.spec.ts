/**
 * @file personal-info.component.spec.ts
 * @path src/app/admin/core-pages/personal-info/personal-info.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PersonalInfoComponent – the logged-in admin's profile: 2FA switch
 *   (incl. 2FA forced by role or by an administrator) and the change-password popup.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, auth stub, alert spy, i18n stub),
 *   CurrentUserProfileService (real, on top of the DataHandler spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PersonalInfoComponent } from './personal-info.component';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('PersonalInfoComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<PersonalInfoComponent>;
  let component: PersonalInfoComponent;
  const VALID = 'Heslo123!';

  const load = (profile: any) => {
    (ctx.dataHandler as any).get.and.returnValue(of(profile));
    component.ngOnInit();
  };
  const fillPasswords = (oldPw: string, newPw: string, confirm: string) =>
    component.passwordForm.setValue({ old_password: oldPw, new_password: newPw, new_password_confirmation: confirm });

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [PersonalInfoComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(PersonalInfoComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description The profile of the logged-in user fills the page and the 2FA switch.
   * @input  GET core/users/1 returns { email: 'a@b.cz', enable_2fa: 1 }
   * @output userData set; enable2faValue true; status type 'enabled', message 'personal-info.security_2fa_enabled'
   */
  it('loads the profile and the 2FA state', () => {
    load({ email: 'a@b.cz', enable_2fa: 1 });
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/users/1');
    expect(component.userData).toEqual(jasmine.objectContaining({ email: 'a@b.cz' }));
    expect(component.enable2faValue).toBeTrue();
    expect(component.security2faStatusType).toBe('enabled');
    expect(component.security2faStatusMessage).toBe('personal-info.security_2fa_enabled');
  });

  /**
   * @description Toggling 2FA saves it and refreshes the cached profile.
   * @input  enable_2fa 0; onToggle2fa()
   * @output put('core/users/1', { enable_2fa: true }); enable2faValue true; profile cache invalidated
   */
  it('turns 2FA on and invalidates the profile cache', () => {
    load({ enable_2fa: 0 });
    const invalidate = spyOn(TestBed.inject(CurrentUserProfileService), 'invalidate').and.callThrough();
    component.onToggle2fa();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/users/1', { enable_2fa: true });
    expect(component.enable2faValue).toBeTrue();
    expect(invalidate).toHaveBeenCalled();
    expect(component.isSaving2fa).toBeFalse();
  });

  /**
   * @description A failed 2FA save keeps the old value.
   * @input  put fails; onToggle2fa()
   * @output enable2faValue stays false; isSaving2fa false
   */
  it('keeps the 2FA value when saving fails', () => {
    load({ enable_2fa: 0 });
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
    component.onToggle2fa();
    expect(component.enable2faValue).toBeFalse();
    expect(component.isSaving2fa).toBeFalse();
  });

  /**
   * @description The sysadmin role has 2FA forced; the switch cannot turn it off.
   * @input  roles [{ role_name: 'sysadmin' }], enable_2fa 0; onToggle2fa()
   * @output isForced2fa true; effective2faChecked true; status 'forced' with role message; no PUT
   */
  it('2FA is forced for sysadmin', () => {
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'personal-info.security_2fa_role_forced' ? 'Forced for {role}' : p));
    load({ enable_2fa: 0, roles: [{ role_name: 'sysadmin' }] });
    component.onToggle2fa();
    expect(component.isForced2fa).toBeTrue();
    expect(component.effective2faChecked).toBeTrue();
    expect(component.security2faStatusType).toBe('forced');
    expect(component.security2faStatusMessage).toBe('Forced for sysadmin');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
  });

  /**
   * @description 2FA forced by an administrator is reported as such.
   * @input  two_fa_forced_by_admin true
   * @output isAdminForced2fa true; message 'personal-info.security_2fa_admin_forced'
   */
  it('2FA forced by an administrator', () => {
    load({ two_fa_forced_by_admin: true, roles: [{ role_name: 'admin' }] });
    expect(component.isAdminForced2fa).toBeTrue();
    expect(component.security2faStatusMessage).toBe('personal-info.security_2fa_admin_forced');
  });

  /**
   * @description The password form requires all fields, the password policy (Unicode rules like the
   *   API, finding #37) and equal confirmation.
   * @input  ('', '', ''); ('old', 'weak', 'weak'); ('old', 'žluťoučký1€', same); ('old', VALID, 'Other123!'); ('old', VALID, VALID)
   * @output invalid; pattern error; valid (non-ASCII password accepted); passwordMismatch true; valid
   */
  it('validates the password form', () => {
    fillPasswords('', '', '');
    expect(component.passwordForm.invalid).toBeTrue();
    fillPasswords('old', 'weak', 'weak');
    expect(component.passwordForm.get('new_password')!.hasError('pattern')).toBeTrue();
    fillPasswords('old', 'žluťoučký1€', 'žluťoučký1€');
    expect(component.passwordForm.valid).toBeTrue();
    fillPasswords('old', VALID, 'Other123!');
    expect(component.passwordMismatch).toBeTrue();
    fillPasswords('old', VALID, VALID);
    expect(component.passwordForm.valid).toBeTrue();
  });

  /**
   * @description A valid password change is sent to change-password and closes the popup.
   * @input  ('old', VALID, VALID); onSubmit()
   * @output put('core/users/1/change-password', { old_password: 'old', new_password, new_password_confirmation }); popup closed; success alert
   */
  it('changes the password', () => {
    component.openPasswordPopup();
    fillPasswords('old', VALID, VALID);
    component.onSubmit();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/users/1/change-password',
      { old_password: 'old', new_password: VALID, new_password_confirmation: VALID });
    expect(component.showPasswordPopup).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('personal-info.password_change_success_title', 'personal-info.password_change_success_message', 'success');
  });

  /**
   * @description A rejected change (e.g. wrong old password) keeps the popup open with an error.
   * @input  put fails
   * @output errorMessage 'personal-info.password_change_error'; showPasswordPopup true
   */
  it('shows an error when the change fails', () => {
    component.openPasswordPopup();
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
    fillPasswords('old', VALID, VALID);
    component.onSubmit();
    expect(component.errorMessage).toBe('personal-info.password_change_error');
    expect(component.showPasswordPopup).toBeTrue();
  });

  /**
   * @description An invalid form is not sent.
   * @input  empty form; onSubmit()
   * @output put not called
   */
  it('does not send an invalid form', () => {
    component.onSubmit();
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
  });

  /**
   * @description Opening the popup clears old values; overlay click closes it.
   * @input  form filled; openPasswordPopup(); onOverlayClick(overlay)
   * @output form values null; errorMessage null; showPasswordPopup false after overlay click
   */
  it('opens a clean popup and closes on overlay click', () => {
    fillPasswords('old', VALID, VALID);
    component.errorMessage = 'x';
    component.openPasswordPopup();
    expect(component.passwordForm.value.old_password).toBeNull();
    expect(component.errorMessage).toBeNull();
    const overlay = {};
    component.onOverlayClick({ target: overlay, currentTarget: overlay } as any);
    expect(component.showPasswordPopup).toBeFalse();
  });

  /**
   * @description The page renders the profile.
   * @input  detectChanges() with profile full_name 'Alena Bílá'
   * @output text contains 'Alena Bílá' and the 2FA status text
   */
  it('renders the profile', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({ full_name: 'Alena Bílá', roles: [] }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alena Bílá');
    expect(fixture.nativeElement.textContent).toContain('personal-info.security_2fa_disabled');
  });
});
