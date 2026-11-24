/**
 * @file personal-info.component.spec.ts
 * @path src/app/admin/core-pages/personal-info/personal-info.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PersonalInfoComponent (My account) – the tabs Profile / Security /
 *   Preferences (in the address), the language of the administration, 2FA switch
 *   (incl. 2FA forced by role or by an administrator), the change-password popup and the own
 *   name / login e-mail (only for sysadmin / core-administrators-update), the switch of the
 *   pop-up notices of new records (this browser only).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, auth stub, alert spy, i18n stub),
 *   CurrentUserProfileService (real, on top of the DataHandler spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PersonalInfoComponent } from './personal-info.component';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { AdminNotificationsService, NOTIFICATION_TOASTS_STORAGE_KEY } from '../../../core/services/admin-notifications.service';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

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
   * @output put('core/users/1/change-password', { old_password: 'old', new_password, new_password_confirmation }); popup closed; success alert;
   *   the other tabs of the account ended (endOtherTabs)
   */
  it('changes the password', () => {
    component.openPasswordPopup();
    fillPasswords('old', VALID, VALID);
    component.onSubmit();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/users/1/change-password',
      { old_password: 'old', new_password: VALID, new_password_confirmation: VALID });
    expect(component.showPasswordPopup).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('personal-info.password_change_success_title', 'personal-info.password_change_success_message', 'success');
    expect(ctx.auth.endOtherTabs).toHaveBeenCalledTimes(1);
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
   * @description Opening the popup clears old values; it is the small shared popup frame with the
   *   form in the body and cancel / save in the footer (save submits the form by its id); a
   *   backdrop click closes it.
   * @input  form filled; openPasswordPopup(); render; backdrop press + click
   * @output form values null; errorMessage null; size sm; old password focused; submit button
   *   linked to the form; showPasswordPopup false after the backdrop click
   */
  it('opens a clean popup and closes on a backdrop click', () => {
    fillPasswords('old', VALID, VALID);
    component.errorMessage = 'x';
    component.openPasswordPopup();
    expect(component.passwordForm.value.old_password).toBeNull();
    expect(component.errorMessage).toBeNull();

    document.body.appendChild(fixture.nativeElement); // focus works only on attached elements
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect((el.querySelector('.am-card') as HTMLElement).dataset['size']).toBe('sm');
    expect(document.activeElement!.id).toBe('old_password');
    const submit = el.querySelector('.am-footer button[type="submit"]') as HTMLButtonElement;
    expect(submit.getAttribute('form')).toBe(el.querySelector('form.minimal-form')!.id);

    const overlay = el.querySelector('.am-overlay') as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    overlay.click();
    expect(component.showPasswordPopup).toBeFalse();
    fixture.nativeElement.remove();
  });

  /**
   * @description Only a sysadmin or an account with core-administrators-update may change the
   *   own name and login e-mail - the others see the "contact an administrator" note and no edit
   *   buttons; the editors see no note.
   * @input  role admin + no permissions; + core-administrators-update; role sysadmin + none
   * @output canEditProfile false / true / true; note only without the right; two edit buttons
   *   (name, e-mail) only for the editor
   */
  it('offers the name and e-mail change to administrators only', () => {
    ctx.permissions.granted = new Set();
    (ctx.dataHandler as any).get.and.returnValue(of({ full_name: 'Me', user_email: 'me@b.cz', roles: [] }));
    fixture.detectChanges();
    expect(component.canEditProfile).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-page-header p.ph-subtitle').textContent).toContain('personal-info.title_note');
    expect(fixture.nativeElement.querySelectorAll('.profile-edit-btn').length).toBe(0);

    ctx.permissions.granted = new Set(['core-administrators-update']);
    expect(component.canEditProfile).toBeTrue();
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-page-header p.ph-subtitle')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.profile-edit-btn').length).toBe(2);

    ctx.permissions.granted = new Set();
    ctx.auth.session.role = 'sysadmin';
    expect(component.canEditProfile).toBeTrue();
  });

  /**
   * @description Saving the own login e-mail: PUT {user_email}; the header and the page show the
   *   new value at once, the other tabs of the account end, the profile cache is dropped, a
   *   success dialog; an unchanged value or an invalid one sends nothing; a failed save keeps the
   *   field open.
   * @input  profile me@b.cz; edit → same value (other case); edit → 'bad'; edit → 'new@b.cz'
   *   (error, then OK)
   * @output no PUT for same / invalid; PUT core/users/1 {user_email:'new@b.cz'}; after the error
   *   still editing; after OK setUserEmail('new@b.cz'), endOtherTabs, userData updated, field
   *   closed, invalidate
   */
  it('saves the own login e-mail and updates the header', () => {
    load({ user_email: 'me@b.cz', roles: [] });
    const invalidate = spyOn(TestBed.inject(CurrentUserProfileService), 'invalidate').and.callThrough();
    const put = (ctx.dataHandler as any).put;
    put.calls.reset();

    component.startEdit('user_email');
    expect(component.editControl.value).toBe('me@b.cz');
    component.editControl.setValue('ME@b.cz');
    component.saveEdit();
    expect(put).not.toHaveBeenCalled();
    expect(component.editingField).toBeNull();

    component.startEdit('user_email');
    component.editControl.setValue('bad');
    component.saveEdit();
    expect(put).not.toHaveBeenCalled();

    component.editControl.setValue('new@b.cz');
    put.and.returnValue(throwError(() => new Error('taken')));
    component.saveEdit();
    expect(put).toHaveBeenCalledWith('core/users/1', { user_email: 'new@b.cz' });
    expect<unknown[]>([component.editingField, component.isSavingField]).toEqual(['user_email', false]);
    expect(ctx.auth.setUserEmail).not.toHaveBeenCalled();

    put.and.returnValue(of({ data: { user_email: 'new@b.cz' } }));
    component.saveEdit();
    expect(ctx.auth.setUserEmail).toHaveBeenCalledWith('new@b.cz');
    expect(ctx.auth.endOtherTabs).toHaveBeenCalledTimes(1);
    expect(component.userData!.user_email).toBe('new@b.cz');
    expect(component.editingField).toBeNull();
    expect(invalidate).toHaveBeenCalled();
    expect(ctx.alert.open).toHaveBeenCalledWith('personal-info.email_change_success_title', 'personal-info.email_change_success_message', 'success');

    component.startEdit('user_email');
    component.cancelEdit();
    expect(component.editingField).toBeNull();
  });

  /**
   * @description Saving the own name: PUT {full_name} (trimmed); the page shows it, nothing about
   *   the header or the other tabs; an empty name is not sent.
   * @input  profile 'Old Name'; edit → '  '; edit → ' New Name '
   * @output no PUT for the blank value; PUT core/users/1 {full_name:'New Name'}; userData updated;
   *   name dialog; no setUserEmail / endOtherTabs
   */
  it('saves the own name', () => {
    load({ full_name: 'Old Name', user_email: 'me@b.cz', roles: [] });
    const put = (ctx.dataHandler as any).put;
    put.calls.reset();

    component.startEdit('full_name');
    expect(component.editControl.value).toBe('Old Name');
    component.editControl.setValue('  ');
    component.saveEdit();
    expect(put).not.toHaveBeenCalled();

    component.editControl.setValue(' New Name ');
    put.and.returnValue(of({ data: { full_name: 'New Name' } }));
    component.saveEdit();
    expect(put).toHaveBeenCalledWith('core/users/1', { full_name: 'New Name' });
    expect(component.userData!.full_name).toBe('New Name');
    expect(ctx.alert.open).toHaveBeenCalledWith('personal-info.name_change_success_title', 'personal-info.name_change_success_message', 'success');
    expect(ctx.auth.setUserEmail).not.toHaveBeenCalled();
    expect(ctx.auth.endOtherTabs).not.toHaveBeenCalled();
  });

  /**
   * @description The page opens on the Profile tab; the Security tab shows the 2FA status.
   * @input  detectChanges() with profile full_name 'Alena Bílá'; activeTab 'security'.
   * @output tabs profile / security / preferences; profile text 'Alena Bílá' without the 2FA
   *   status; then the 2FA status text without the name.
   */
  it('renders the profile and the security tab', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({ full_name: 'Alena Bílá', roles: [] }));
    fixture.detectChanges();
    expect(component.tabItems.map(t => t.value)).toEqual(['profile', 'security', 'preferences']);
    expect(component.activeTab).toBe('profile');
    expect(fixture.nativeElement.textContent).toContain('Alena Bílá');
    expect(fixture.nativeElement.textContent).not.toContain('personal-info.security_2fa_disabled');
    component.activeTab = 'security';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('personal-info.security_2fa_disabled');
    expect(fixture.nativeElement.textContent).not.toContain('Alena Bílá');
  });

  /**
   * @description The tab is in the address: ?tab=security / ?tab=preferences open them, an unknown
   *   value the profile; switching navigates with the parameter (none for the profile).
   * @input  query tab=preferences, then tab=x; switchTab('security'), switchTab('profile') from security.
   * @output activeTab preferences, then profile; navigate([], { queryParams: { tab: 'security' } })
   *   then { tab: null }; switching to the open tab does nothing.
   */
  it('keeps the tab in the address', () => {
    const query = new BehaviorSubject(convertToParamMap({ tab: 'preferences' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PersonalInfoComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { queryParamMap: query } }],
    });
    fixture = TestBed.createComponent(PersonalInfoComponent);
    component = fixture.componentInstance;
    (ctx.dataHandler as any).get.and.returnValue(of({ roles: [] }));
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.ngOnInit();
    expect(component.activeTab).toBe('preferences');
    query.next(convertToParamMap({ tab: 'x' }));
    expect(component.activeTab).toBe('profile');
    component.switchTab('profile');
    expect(navigate).not.toHaveBeenCalled();
    component.switchTab('security');
    expect(navigate.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ queryParams: { tab: 'security' } }));
    query.next(convertToParamMap({ tab: 'security' }));
    component.switchTab('profile');
    expect(navigate.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ queryParams: { tab: null } }));
  });

  /**
   * @description The Preferences tab switches the language of the administration (this browser):
   *   the languages with their names, the current one active.
   * @input  activeTab 'preferences'; languageItems; selectLanguage('en').
   * @output items cz + en with names; currentLanguageCode 'cz' then 'en'; i18n.setLanguage('en');
   *   the hint is rendered.
   */
  it('switches the language of the administration', () => {
    (ctx.dataHandler as any).get.and.returnValue(of({ roles: [] }));
    fixture.detectChanges();
    component.activeTab = 'preferences';
    fixture.detectChanges();
    expect(component.languageItems.map(i => i.value)).toEqual(jasmine.arrayContaining(['cz', 'en']));
    expect(component.languageItems.every(i => !!i.label)).toBeTrue();
    expect(component.currentLanguageCode).toBe('cz');
    component.selectLanguage('en');
    expect(ctx.i18n.setLanguage).toHaveBeenCalledWith('en');
    expect(component.currentLanguageCode).toBe('en');
    expect(fixture.nativeElement.textContent).toContain('personal-info.language_hint');
  });

  /**
   * @description The notifications part (Preferences tab) switches the pop-up notices of this
   *   browser; the checkbox follows the stored choice.
   * @input  render the Preferences tab (notices on); uncheck the checkbox; check it again.
   * @output checked; then toastsEnabled false + storage 'off'; then true + 'on'.
   */
  it('switches the pop-up notices of new records', () => {
    localStorage.removeItem(NOTIFICATION_TOASTS_STORAGE_KEY);
    const notifications = TestBed.inject(AdminNotificationsService);
    notifications.setToastsEnabled(true);
    load({ email: 'a@b.cz', enable_2fa: 0 });
    fixture.detectChanges();
    component.activeTab = 'preferences';
    fixture.detectChanges();
    const box = Array.from(fixture.nativeElement.querySelectorAll('.security-toggle-label'))
      .find((label: any) => label.textContent.includes('personal-info.notifications_toasts_label')) as HTMLElement;
    const input = box.querySelector('input') as HTMLInputElement;
    expect(input.checked).toBeTrue();
    input.click();
    expect(notifications.toastsEnabled()).toBeFalse();
    expect(localStorage.getItem(NOTIFICATION_TOASTS_STORAGE_KEY)).toBe('off');
    input.click();
    expect(notifications.toastsEnabled()).toBeTrue();
    expect(localStorage.getItem(NOTIFICATION_TOASTS_STORAGE_KEY)).toBe('on');
    localStorage.removeItem(NOTIFICATION_TOASTS_STORAGE_KEY);
  });
});
