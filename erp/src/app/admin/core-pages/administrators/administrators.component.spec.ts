/**
 * @file administrators.component.spec.ts
 * @path src/app/admin/core-pages/administrators/administrators.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AdministratorsComponent – admin account management and its security
 *   rules: which roles / permissions a non-sysadmin may grant, 2FA forced by role or admin,
 *   sysadmin never blockable, own account role lock, e-mail domain policy for new accounts,
 *   the payload that is actually sent, password reset and activation e-mail.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), RoleOptionsService and
 *   PermissionOptionsService (stubs), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdministratorsComponent } from './administrators.component';
import { RoleOptionsService } from '../../../core/services/role-options.service';
import { PermissionOptionsService } from '../../../core/services/permission-options.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('AdministratorsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AdministratorsComponent>;
  let component: AdministratorsComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  const roles = [{ id: 1, role_name: 'sysadmin' }, { id: 2, role_name: 'editor' }, { id: 3, role_name: 'manager' }];
  const rolesMeta = [
    { id: 1, role_name: 'sysadmin', forces_2fa: false, permissions: [] },
    { id: 2, role_name: 'editor', forces_2fa: true, permissions: ['web-news-view'] },
    { id: 3, role_name: 'manager', forces_2fa: false, permissions: ['shop-orders-view', 'core-administrators-view'] }
  ];
  const permissions = [
    { id: 10, permission_key: 'web-news-view', description: 'News' },
    { id: 11, permission_key: 'shop-orders-view' },
    { id: 12, permission_key: 'core-administrators-view' }
  ];
  const policy = { primary_email_domain: 'firma.cz', rules: [{ id: 1, type: 'domain', value: 'partner.cz' }, { id: 2, type: 'email', value: 'ext@gmail.com' }] };

  const field = (name: string) => component.visibleFormFields.find(f => f.column_name === name) as any;
  const fieldNames = () => component.visibleFormFields.map(f => f.column_name);

  /** Creates the page for a session role ('sysadmin' or 'admin') and optional granted permissions. */
  const setup = async (role: 'sysadmin' | 'admin', granted: string[] | 'all' = 'all') => {
    ctx = createAdminTestContext({ granted });
    ctx.auth.session.role = role;
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'core/roles?no_pagination=true') return of(rolesMeta);
      if (url === 'core/email-access-policy') return of(JSON.parse(JSON.stringify(policy)));
      return of({});
    });
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [AdministratorsComponent],
      providers: [
        ...ctx.providers,
        { provide: RoleOptionsService, useValue: { getRoles: () => of(roles) } },
        { provide: PermissionOptionsService, useValue: { getPermissions: () => of(permissions) } },
        { provide: ScrollLockService, useValue: scrollLock }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdministratorsComponent);
    component = fixture.componentInstance;
  };

  afterEach(() => fixture?.destroy());

  describe('as sysadmin', () => {
    beforeEach(async () => { await setup('sysadmin'); });

    /**
     * @description Init loads roles and permissions into the form and the policy (sysadmin only).
     * @input  ngOnInit() as sysadmin
     * @output role_id options 3 roles; permission_ids options 3 ('web-news-view — News' label); policy loaded
     */
    it('loads roles, permissions and the e-mail policy', fakeAsync(() => {
      component.ngOnInit();
      const roleField = component.formFields.find(f => f.column_name === 'role_id')!;
      const permField = component.formFields.find(f => f.column_name === 'permission_ids')!;
      expect(roleField.options!.map(o => o.label)).toEqual(['sysadmin', 'editor', 'manager']);
      expect(permField.options![0]).toEqual({ value: '10', label: 'web-news-view — News' });
      expect(component.primaryEmailDomain).toBe('firma.cz');
      expect(component.domainRules.length).toBe(1);
      expect(component.emailRules.length).toBe(1);
      discardPeriodicTasks();
    }));

    /**
     * @description New accounts must use the primary domain, an allowed domain or an allowed address (case-insensitive).
     * @input  handleCreateFormOpened(); e-mail pattern of user_email
     * @output matches 'jan@firma.cz', 'Jan@FIRMA.cz', 'x@partner.cz', 'ext@gmail.com'; not 'x@gmail.com', 'jan@firma.cz.evil.com'
     */
    it('restricts new account e-mails to the allowed domains', fakeAsync(() => {
      component.ngOnInit();
      component.handleCreateFormOpened();
      const re = new RegExp(`^${field('user_email').pattern}$`);
      ['jan@firma.cz', 'Jan@FIRMA.cz', 'x@partner.cz', 'ext@gmail.com'].forEach(e => expect(re.test(e)).withContext(e).toBeTrue());
      ['x@gmail.com', 'jan@firma.cz.evil.com'].forEach(e => expect(re.test(e)).withContext(e).toBeFalse());
      expect(field('user_email').errorMessage).toBe('administrators.field_email_domain_error');
      discardPeriodicTasks();
    }));

    /**
     * @description A role that forces 2FA locks the 2FA switch and switches it on.
     * @input  handleEditFormOpened({ id: 7, roles: [editor], enable_2fa: false })
     * @output enable_2fa field editable false with role hint; edited enable_2fa true; two_fa_forced_by_admin hidden
     */
    it('forces 2FA for roles that require it', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 7, roles: [{ id: 2 }], enable_2fa: false });
      expect(field('enable_2fa').editable).toBeFalse();
      expect(field('enable_2fa').hint).toBe('administrators.field_enable_2fa_forced_by_role_hint');
      expect(component.selectedItemForEdit.enable_2fa).toBeTrue();
      expect(fieldNames()).not.toContain('two_fa_forced_by_admin');
      discardPeriodicTasks();
    }));

    /**
     * @description A sysadmin account can never be blocked.
     * @input  handleEditFormOpened({ id: 9, roles: [sysadmin], is_blocked: true })
     * @output is_blocked field editable false; edited is_blocked false
     */
    it('never lets a sysadmin account be blocked', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 9, roles: [{ id: 1 }], is_blocked: true });
      expect(field('is_blocked').editable).toBeFalse();
      expect(component.selectedItemForEdit.is_blocked).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Role permissions are pre-checked and disabled; explicit extra permissions are kept.
     * @input  edit manager with user_permissions ['web-news-view']
     * @output permission_ids ['10', '11', '12']; disabledOptionValues ['11', '12']
     */
    it('shows role permissions as checked and disabled', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 7, roles: [{ id: 3 }], user_permissions: ['web-news-view'] });
      expect(component.selectedItemForEdit.permission_ids.sort()).toEqual(['10', '11', '12']);
      expect(field('permission_ids').disabledOptionValues).toEqual(['11', '12']);
      discardPeriodicTasks();
    }));

    /**
     * @description The own account's role cannot be changed (no self-escalation / lock-out).
     * @input  edit own account (id 1)
     * @output role_id editable false with hint 'administrators.field_role_own_account_hint'
     */
    it('locks the role of the own account', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 1, roles: [{ id: 1 }] });
      expect(field('role_id').editable).toBeFalse();
      expect(field('role_id').hint).toBe('administrators.field_role_own_account_hint');
      discardPeriodicTasks();
    }));

    /**
     * @description Changing the role in the form pre-fills that role's permissions and forced 2FA.
     * @input  create form; handleFieldChanged({ columnName: 'role_id', value: '2' })
     * @output formFieldOverrides { permission_ids: ['10'], enable_2fa: true }; enable_2fa locked
     */
    it('updates permissions and 2FA when the role changes', fakeAsync(() => {
      component.ngOnInit();
      component.handleCreateFormOpened();
      component.handleFieldChanged({ columnName: 'role_id', value: '2' });
      expect(component.formFieldOverrides).toEqual({ permission_ids: ['10'], enable_2fa: true });
      expect(field('enable_2fa').editable).toBeFalse();
      component.handleFieldChanged({ columnName: 'full_name', value: 'x' });
      expect(component.formFieldOverrides).toEqual({ permission_ids: ['10'], enable_2fa: true });
      discardPeriodicTasks();
    }));

    /**
     * @description Saving strips permissions the role already grants, converts types and checkboxes.
     * @input  edit manager (id 7); submit { id: 7, role_id: '3', permission_ids: ['10', '11'], enable_2fa: 'on', is_blocked: 0 }
     * @output put('core/users/7', { id: 7, role_id: 3, permission_ids: [10], enable_2fa: true, is_blocked: false }); success alert
     */
    it('sends only explicit permissions and real booleans', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 7, roles: [{ id: 3 }] });
      component.handleFormSubmitted({ id: 7, role_id: '3', permission_ids: ['10', '11'], enable_2fa: 'on', is_blocked: 0 });
      const [url, body] = (ctx.dataHandler as any).put.calls.mostRecent().args;
      expect(url).toBe('core/users/7');
      expect(body).toEqual(jasmine.objectContaining({ id: 7, role_id: 3, permission_ids: [10], enable_2fa: true, is_blocked: false }));
      expect(ctx.alert.open).toHaveBeenCalledWith('administrators.success_title', 'administrators.account_updated', 'success');
      discardPeriodicTasks();
    }));

    /**
     * @description Changing the role of an account resets its explicit permissions and informs the user.
     * @input  edit manager (role 3); submit with role_id '2'
     * @output permission_ids []; info alert 'administrators.role_changed_message'; forced 2FA fields removed from the payload
     */
    it('resets permissions when the role changes', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 7, roles: [{ id: 3 }] });
      component.handleFormSubmitted({ id: 7, role_id: '2', permission_ids: ['11'], enable_2fa: true, two_fa_forced_by_admin: true });
      const body = (ctx.dataHandler as any).put.calls.mostRecent().args[1];
      expect(body.permission_ids).toEqual([]);
      expect(body.enable_2fa).toBeUndefined();
      expect(body.two_fa_forced_by_admin).toBeUndefined();
      expect(ctx.alert.open).toHaveBeenCalledWith('administrators.role_changed_title', 'administrators.role_changed_message', 'info');
      discardPeriodicTasks();
    }));

    /**
     * @description A new account is created with POST; a failed activation e-mail is reported
     *   (finding #11).
     * @input  create form; submit { user_email: 'jan@firma.cz', full_name: 'Jan', role_id: '3' }; then
     *   the API answers activation_email_sent false
     * @output postWithMeta('core/users', { …, role_id: 3 }); alert account_created; then warning activation_email_failed
     */
    it('creates a new account', fakeAsync(() => {
      component.ngOnInit();
      component.handleCreateFormOpened();
      component.handleFormSubmitted({ user_email: 'jan@firma.cz', full_name: 'Jan', role_id: '3' });
      expect((ctx.dataHandler as any).postWithMeta).toHaveBeenCalledWith('core/users', jasmine.objectContaining({ user_email: 'jan@firma.cz', role_id: 3 }));
      expect(ctx.alert.open).toHaveBeenCalledWith('administrators.success_title', 'administrators.account_created', 'success');

      // activation e-mail failed → warning instead of success (finding #11)
      (ctx.dataHandler as any).postWithMeta.and.returnValue(of({ data: { id: 8 }, activation_email_sent: false }));
      component.handleCreateFormOpened();
      component.handleFormSubmitted({ user_email: 'eva@firma.cz', full_name: 'Eva', role_id: '3' });
      expect(ctx.alert.open).toHaveBeenCalledWith('administrators.activation_email_failed_title', 'administrators.activation_email_failed', 'warning');
      discardPeriodicTasks();
    }));

    /**
     * @description The e-mail policy modal: open locks scroll, domain saved trimmed, rules added and removed.
     * @input  openEmailAccessPolicyModal(); primaryEmailDomain '  nova.cz '; savePrimaryDomain(); add rule 'x.cz'; remove rule 1; close
     * @output lock(); put('core/email-access-policy/primary-domain', { primary_email_domain: 'nova.cz' }); post rule; delete rule 1; unlock()
     */
    it('manages the e-mail access policy', fakeAsync(() => {
      component.openEmailAccessPolicyModal();
      expect(scrollLock.lock).toHaveBeenCalled();
      component.primaryEmailDomain = '  nova.cz ';
      (ctx.dataHandler as any).put.and.returnValue(of({ primary_email_domain: 'nova.cz' }));
      component.savePrimaryDomain();
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/email-access-policy/primary-domain', { primary_email_domain: 'nova.cz' });
      (ctx.dataHandler as any).post.and.returnValue(of({ id: 3, type: 'domain', value: 'x.cz' }));
      component.newRuleValue = ' x.cz ';
      component.addEmailAccessRule();
      expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/email-access-policy/rules', { type: 'domain', value: 'x.cz' });
      expect(component.domainRules.map(r => r.value)).toContain('x.cz');
      component.removeEmailAccessRule(1);
      expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/email-access-policy/rules/1');
      expect(component.domainRules.map(r => r.id)).not.toContain(1);
      component.closeEmailAccessPolicyModal();
      expect(scrollLock.unlock).toHaveBeenCalled();
    }));

    /**
     * @description The e-mail policy button is visible only to sysadmin.
     * @input  toolbarButtons as sysadmin
     * @output openEmailAccessPolicy showIf true
     */
    it('shows the e-mail policy button to sysadmin', () => {
      expect(component.toolbarButtons.find(b => b.action === 'openEmailAccessPolicy')!.showIf).toBeTrue();
    });
  });

  describe('as a regular administrator', () => {
    beforeEach(async () => { await setup('admin', ['web-news-view', 'core-administrators-update']); });

    /**
     * @description A non-sysadmin can assign only roles whose permissions they have themselves, never sysadmin.
     * @input  granted ['web-news-view', …]; handleCreateFormOpened()
     * @output role_id options ['editor'] only
     */
    it('offers only roles the admin may assign', fakeAsync(() => {
      component.ngOnInit();
      component.handleCreateFormOpened();
      expect(field('role_id').options.map((o: any) => o.label)).toEqual(['editor']);
      discardPeriodicTasks();
    }));

    /**
     * @description A non-sysadmin can grant only permissions they have themselves.
     * @input  handleCreateFormOpened()
     * @output permission_ids options ['10'] (web-news-view)
     */
    it('offers only permissions the admin has', fakeAsync(() => {
      component.ngOnInit();
      component.handleCreateFormOpened();
      expect(field('permission_ids').options.map((o: any) => o.value)).toEqual(['10']);
      discardPeriodicTasks();
    }));

    /**
     * @description Blocking and forcing 2FA are sysadmin-only fields; other accounts' e-mail is read-only.
     * @input  handleEditFormOpened({ id: 7, roles: [editor] })
     * @output no is_blocked and no two_fa_forced_by_admin field; user_email editable false
     */
    it('hides sysadmin-only fields and locks foreign e-mails', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 7, roles: [{ id: 2 }] });
      expect(fieldNames()).not.toContain('is_blocked');
      expect(fieldNames()).not.toContain('two_fa_forced_by_admin');
      expect(field('user_email').editable).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Read-only fields are never sent, even if the form contains them.
     * @input  edit foreign account 7; submit with user_email 'hacked@x.cz' and is_blocked true
     * @output payload without user_email and without is_blocked
     */
    it('never sends read-only or hidden fields', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 7, roles: [{ id: 2 }] });
      component.handleFormSubmitted({ id: 7, role_id: '2', user_email: 'hacked@x.cz', is_blocked: true, full_name: 'X' });
      const body = (ctx.dataHandler as any).put.calls.mostRecent().args[1];
      expect(body.user_email).toBeUndefined();
      expect(body.is_blocked).toBeUndefined();
      expect(body.full_name).toBe('X');
      discardPeriodicTasks();
    }));

    /**
     * @description The password button is shown for the own account only (non-sysadmin).
     * @input  password_reset row button; rows id 1 (own) and 7
     * @output visibleWhen true for 1, false for 7
     */
    it('allows password reset only for the own account', () => {
      const btn = component.buttons.find(b => b.action === 'password_reset')!;
      expect(btn.visibleWhen!({ id: 1 })).toBeTrue();
      expect(btn.visibleWhen!({ id: 7 })).toBeFalse();
    });

    /**
     * @description Non-sysadmin does not see the e-mail policy button and does not load the policy.
     * @input  ngOnInit(); toolbarButtons
     * @output no GET core/email-access-policy; openEmailAccessPolicy showIf false
     */
    it('has no e-mail policy access', fakeAsync(() => {
      component.ngOnInit();
      expect((ctx.dataHandler as any).get).not.toHaveBeenCalledWith('core/email-access-policy');
      expect(component.toolbarButtons.find(b => b.action === 'openEmailAccessPolicy')!.showIf).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Password reset sends the new password as its own confirmation.
     * @input  handleResetPasswordFormOpened({ id: 1, user_email: 'a@b.cz' }); submit { id: 1, old_password: 'o', new_password: 'n' }
     * @output put('core/users/1/change-password', { old_password: 'o', new_password: 'n', new_password_confirmation: 'n' }); alert 'administrators.password_changed'
     */
    it('changes a password', () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'administrators.reset_password_title_with_email' ? 'Reset {email}' : p));
      component.handleResetPasswordFormOpened({ id: 1, user_email: 'a@b.cz' });
      expect(component.resetPasswordTitle).toBe('Reset a@b.cz');
      expect(component.showResetPasswordForm).toBeTrue();
      component.handleResetPasswordFormSubmitted({ id: 1, old_password: 'o', new_password: 'n' });
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/users/1/change-password',
        { old_password: 'o', new_password: 'n', new_password_confirmation: 'n' });
      expect(component.showResetPasswordForm).toBeFalse();
    });

    /**
     * @description The activation e-mail is resent only for accounts that are not active yet.
     * @input  handleResendActivation({ id: 7, activated_at: '2026-01-01' }), then ({ id: 8 })
     * @output info alert 'administrators.account_already_active'; post('core/users/8/resend-activation', {})
     */
    it('resends the activation e-mail for inactive accounts only', () => {
      component.handleResendActivation({ id: 7, activated_at: '2026-01-01' });
      expect(ctx.alert.open).toHaveBeenCalledWith('administrators.info_title', 'administrators.account_already_active', 'info');
      component.handleResendActivation({ id: 8 });
      expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/users/8/resend-activation', {});
    });
  });
  describe('page plumbing', () => {
    beforeEach(async () => { await setup('sysadmin'); });

    /**
     * @description Toolbar dispatch, filters, details and the caption.
     * @input handleToolbarAction for each action + unknown; applyFilters / clearFilters; handleViewDetails without / with id.
     * @output each handler once; filters set / reset + refresh; details only for an id; caption key.
     */
    it('dispatches toolbar actions, filters and details', fakeAsync(() => {
      component.ngOnInit();
      const handlers = ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'openGraphBuilder', 'openEmailAccessPolicyModal', 'toggleTable']
        .map(m => spyOn(component as any, m));
      ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'openGraphBuilder', 'openEmailAccessPolicy', 'toggleTable', 'nope']
        .forEach(a => component.handleToolbarAction(a));
      handlers.forEach(h => expect(h).toHaveBeenCalledTimes(1));

      const refresh = spyOn(component, 'refreshData');
      component.applyFilters({ role_id: 2 });
      expect(component.filters).toEqual({ role_id: 2 });
      component.clearFilters();
      expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
      expect(refresh).toHaveBeenCalledTimes(2);

      component.handleViewDetails({});
      expect((ctx.dataHandler as any).getOne).not.toHaveBeenCalled();
      (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 4, user_email: 'x@firma.cz' }));
      component.handleViewDetails({ id: 4 });
      expect([component.showDetails, component.selectedItemForDetails.id]).toEqual([true, 4]);
      expect(component.tableCaption).toBe('administrators.table_header_accounts');
      discardPeriodicTasks();
    }));

    /**
     * @description Saving a sysadmin account never sends is_blocked; a 2FA-forced role drops the 2FA fields.
     * @input handleFormSubmitted for an existing sysadmin (is_blocked true) and a new editor (forces 2FA).
     * @output PUT payload without is_blocked; POST payload without enable_2fa / two_fa_forced_by_admin.
     */
    it('strips fields the role does not allow', fakeAsync(() => {
      component.ngOnInit();
      component.handleEditFormOpened({ id: 9, role_id: 1, roles: [{ id: 1 }], user_email: 'root@firma.cz' });
      (ctx.dataHandler as any).put.and.returnValue(of({ id: 9 }));
      component.handleFormSubmitted({ id: 9, role_id: 1, user_email: 'root@firma.cz', is_blocked: true });
      expect((ctx.dataHandler as any).put.calls.mostRecent().args[1].is_blocked).toBeUndefined();

      component.handleCreateFormOpened();
      (ctx.dataHandler as any).postWithMeta.and.returnValue(of({ data: { id: 10 }, activation_email_sent: true }));
      component.handleFormSubmitted({ role_id: 2, user_email: 'new@firma.cz', enable_2fa: false, two_fa_forced_by_admin: false });
      const created = (ctx.dataHandler as any).postWithMeta.calls.mostRecent().args[1];
      expect(created.enable_2fa).toBeUndefined();
      expect(created.two_fa_forced_by_admin).toBeUndefined();
      discardPeriodicTasks();
    }));

    /**
     * @description Policy load / save failures stop the spinners; the modal cannot close while
     *   saving; destroying the page with an open modal releases the scroll lock; the activation
     *   button only for accounts without activation.
     * @input policy GET error; PUT error; close while saving; destroy with modal open; visibleWhen.
     * @output loading / saving false; modal stays open while saving; unlock on destroy; visibleWhen false / true.
     */
    it('recovers from e-mail policy errors', fakeAsync(() => {
      (ctx.dataHandler as any).get.and.callFake((url: string) => url === 'core/email-access-policy' ? throwError(() => new Error('x')) : of(rolesMeta));
      component.ngOnInit();
      component.openEmailAccessPolicyModal();
      expect(component.emailAccessPolicyLoading).toBeFalse();
      (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
      component.savePrimaryDomain();
      expect(component.emailAccessPolicySaving).toBeFalse();
      component.emailAccessPolicySaving = true;
      component.savePrimaryDomain();
      component.closeEmailAccessPolicyModal();
      expect(component.showEmailAccessPolicyModal).toBeTrue();
      component.emailAccessPolicySaving = false;

      scrollLock.unlock.calls.reset();
      fixture.destroy();
      expect(scrollLock.unlock).toHaveBeenCalled();
      const activate = component.buttons.find((b: any) => b.action === 'resend_activation') as any;
      expect(activate.visibleWhen({ activated_at: '2026-01-01' })).toBeFalse();
      expect(activate.visibleWhen({})).toBeTrue();
      discardPeriodicTasks();
    }));
  });
});
