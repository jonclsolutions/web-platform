/**
 * @file portal-account.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/account/portal-account.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalAccountComponent (My account): account data and how it signs
 *   in, and the client's own e-mail notifications (form from the saved settings, e-mail required,
 *   save, failure, reset).
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { of } from 'rxjs';
import { failWith, setUpPortal, testProject } from '../../portal.testing';
import { PortalAccountComponent } from './portal-account.component';

describe('PortalAccountComponent', () => {
  /**
   * @description The form starts from the saved settings (all off without data), clearing the
   *   e-mail turns every notification off, a notification without an e-mail is refused before
   *   sending, saving posts the own settings and takes the answer; a failure shows an error;
   *   reset puts the saved values back; the switches are disabled without e-mail.
   * @input account section; e-mail + 2 switches → save (API answers the project with them);
   *   save again; cleared e-mail; switch without e-mail; failing save; reset; refreshed$ with account 6.
   * @output defaults, 5 disabled switches; post('projects/public/tok/account', {email trimmed, language, flags});
   *   saved + not dirty; no second post; flags off; 'email_required' without request; 'error'; draft = saved;
   *   the e-mail of account 6.
   */
  it('lets the client choose its e-mail notifications', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalAccountComponent] });
    const fixture = TestBed.createComponent(PortalAccountComponent);
    const view = fixture.componentInstance;
    fixture.detectChanges();
    expect(view.accountSettings).toEqual({ email: '', language: 'cz', notify_replies: false, notify_checkpoint_status: false, notify_checkpoint_dates: false, notify_updates: false, notify_approvals: false });
    expect(view.accountSettingsDirty).toBeFalse();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-switch').length).toBe(5);
    expect((el.querySelector('fieldset.pp-switches') as HTMLFieldSetElement).disabled).toBeTrue();

    view.accountSettings = { email: ' jana@client.cz ', language: 'en', notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, notify_updates: true, notify_approvals: false };
    const saved = { ...testProject().account!, email: 'jana@client.cz', language: 'en' as const, notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, notify_updates: true, notify_approvals: false };
    ctx.replies['/tok/account'] = () => of({ ...testProject(), account: saved });
    view.saveAccountSettings();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/account', {
      email: 'jana@client.cz', language: 'en', notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, notify_updates: true, notify_approvals: false,
    });
    expect(view.accountSaveResult).toBe('saved');
    expect(ctx.session.project()!.account!.notify_replies).toBeTrue();
    expect(view.accountSettingsDirty).toBeFalse();
    ctx.post.calls.reset();
    view.saveAccountSettings();
    expect(ctx.post).not.toHaveBeenCalled();

    view.accountSettings.email = '';
    view.onAccountEmailChange();
    expect([view.accountSettings.notify_replies, view.accountSettings.notify_checkpoint_dates]).toEqual([false, false]);
    view.accountSettings.notify_replies = true;
    view.saveAccountSettings();
    expect(view.accountSaveResult).toBe('email_required');
    expect(ctx.post).not.toHaveBeenCalled();

    view.accountSettings = { ...view.accountSettings, email: 'x@y.cz' };
    ctx.replies['/tok/account'] = failWith(422);
    view.saveAccountSettings();
    expect(view.accountSaveResult).toBe('error');
    expect(view.accountSaving).toBeFalse();
    view.resetAccountSettings();
    expect(view.accountSettings.email).toBe('jana@client.cz');
    expect(view.accountSaveResult).toBeNull();

    // Another account signed in (or a refresh): the form shows its settings.
    view.accountSettings.email = 'draft@y.cz';
    ctx.session.project.set({ ...testProject(), account: { id: 6, username: 'petr', display_name: 'Petr', email: 'petr@client.cz' } });
    ctx.session.refreshed$.next();
    expect(view.accountSettings.email).toBe('petr@client.cz');
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description The account data shows how the account signs in and whether the e-mail is proven.
   * @input account without password, verified e-mail.
   * @output 'account_signin_code', 'account_email_verified', the username.
   */
  it('shows how the account signs in', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalAccountComponent] });
    ctx.session.project.set({ ...testProject(), account: { ...testProject().account!, has_password: false, email: 'jana@client.cz', email_verified: true } });
    const fixture = TestBed.createComponent(PortalAccountComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('account_signin_code');
    expect(el.textContent).toContain('account_email_verified');
    expect(el.textContent).toContain('jana');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
