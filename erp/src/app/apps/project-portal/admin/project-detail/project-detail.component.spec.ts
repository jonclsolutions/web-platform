/**
 * @file project-detail.component.spec.ts
 * @path src/app/apps/project-portal/admin/project-detail/project-detail.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectDetailComponent – the page of one client project
 *   (project-portal/projects/:id): loading / not found, the settings form (dirty state, saving only the
 *   changed fields, discard, read-only without permission, assignee options), leaving with unsaved
 *   changes or an uncopied password, the client accounts (add with a typed-in / generated password
 *   shown once in memory only - VT-08, edit, notifications need an e-mail, password reset, removal,
 *   copy of the sign-in details), the files of the conversations, checkpoints (status dropdown,
 *   due date, internal note, overdue, order), the conversations of the project (filters, unread
 *   counts, "waiting on", "read by the client", opening marks read, status, replies and internal
 *   notes with validated attachments, older messages, periodic refresh), the sub-pages with their
 *   own address (tabs, badges, activity of the overview), thread assignment and "Mine", invitations
 *   and the access of an account, project templates in Progress, files of updates / approvals.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), ActivatedRoute (stub with the id and
 *   the sub-page as an observable paramMap),
 *   Router.navigate (spy), navigator.clipboard (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ProjectDetailComponent, THREAD_REFRESH_SECONDS } from './project-detail.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';
import { TEST_UPLOAD_RULES } from '../../../../../testing/upload-rules-stub';

describe('ProjectDetailComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let component: ProjectDetailComponent;
  let navigate: jasmine.Spy;
  let routeId: string | null;
  /** Parameters of the address: the id and the sub-page (`section`), changed by a test with go(). */
  let params$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  /** Switches the sub-page like a click on a tab (same component, new `section` parameter). */
  const go = (section: string) => {
    params$.next(convertToParamMap({ id: routeId ?? '', section }));
    fixture.detectChanges();
  };

  const dh = () => ctx.dataHandler as any;
  const project = () => ({
    id: 7, name: 'Shop', description: null, platform: 'web', project_lead: 'Jan', contact_phone: null, contact_email: null,
    technologies: null, estimated_completion_from: '2026-12-01', estimated_completion_to: null, visibility: 'private',
    status: 'development', public_url: 'https://x/p/7', created_at: '2026-11-01 10:00:00', unread_messages_count: 3,
    assignee_id: 3, assignee_name: 'Jana', accounts_count: 2,
    checkpoints: [{ id: 1, label: 'Design', status: 'new', sort_order: 1 }]
  });
  const accounts = () => [
    { id: 11, username: 'klient', display_name: 'Klient', email: null, notify_replies: false, notify_checkpoint_status: false, notify_checkpoint_dates: false, language: 'cz', password_set_at: null, last_login_at: '2026-11-10 08:00:00', active_sessions: 1 },
    { id: 12, username: 'anna', display_name: 'Anna Malá', email: 'anna@client.cz', notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, language: 'en', password_set_at: null, last_login_at: null, active_sessions: 0 }
  ];
  const projectFiles = () => [
    { id: 21, original_filename: 'note.pdf', size_bytes: 2048, download_url: 'https://x/f/21', thread_id: 5, thread_subject: 'Logo', author_type: 'admin', author_label: 'Jana', is_internal: true, created_at: '2026-11-10 10:00:00' },
    { id: 20, original_filename: 'brief.pdf', size_bytes: 1024, download_url: 'https://x/f/20', thread_id: 4, thread_subject: 'Hosting', author_type: 'customer', author_label: 'Anna Malá', is_internal: false, created_at: '2026-11-09 10:00:00' }
  ];
  const assignees = () => [{ id: 3, full_name: 'Jana' }, { id: 5, full_name: 'Petr' }];
  /** getCollection answers by endpoint. */
  const collections = (endpoint: string, params?: Record<string, string>) => {
    if (params?.['assigned_to_me']) return of([threads()[0]]);
    if (endpoint === 'project-portal/projects/7/activity') return of(activity());
    if (endpoint === 'project-portal/projects/templates') return of(templates());
    if (endpoint === 'project-portal/projects/7/accounts') return of(accounts());
    if (endpoint === 'project-portal/projects/7/files') return of(projectFiles());
    if (endpoint === 'project-portal/projects/assignees') return of(assignees());
    return of(threads());
  };
  const activity = () => [
    { type: 'client_message', title: 'Launch', detail: null, at: '2026-11-10 09:00:00', target: { section: 'threads', id: 3 } },
    { type: 'approval_decided', title: 'Homepage', detail: 'approved', at: '2026-11-09 09:00:00', target: { section: 'approvals', id: 2 } }
  ];
  const templates = () => [{ id: 1, name: 'Web', description: null, checkpoints: [{ label: 'Design' }, { label: 'Launch' }] }];
  const threads = () => [
    { id: 3, subject: 'Launch', priority: 'high', status: 'active', last_message_at: '2026-11-10 09:00:00', admin_unread_count: 2, waiting_on: 'supplier' as const },
    { id: 4, subject: 'Hosting', priority: 'low', status: 'closed', last_message_at: null, admin_unread_count: 1, waiting_on: null },
    { id: 5, subject: 'Logo', priority: 'medium', status: 'active', last_message_at: null, admin_unread_count: 0, waiting_on: 'customer' as const }
  ];
  const file = (name: string, size = 10) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };
  const fileEvent = (...files: File[]) => {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const input = document.createElement('input');
    input.type = 'file';
    input.files = dt.files;
    return { target: input } as unknown as Event;
  };
  /** Message list element whose scrollTop assignments are recorded. */
  const scrollList = (scrollHeight: number) => {
    const el = document.createElement('div');
    const sets: number[] = [];
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
    Object.defineProperty(el, 'scrollTop', { get: () => sets[sets.length - 1] ?? 0, set: (v: number) => sets.push(v) });
    return { el, sets };
  };
  /** Creates the page (ngOnInit runs) and leaves the polling to the caller's fakeAsync zone. */
  const init = () => { fixture.detectChanges(); };

  beforeEach(async () => {
    routeId = '7';
    params$ = new BehaviorSubject(convertToParamMap({ id: '7' }));
    ctx = createAdminTestContext();
    dh().get.and.callFake(() => of(project()));
    dh().getCollection.and.callFake(collections);
    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      // The id is read when ngOnInit runs, so a test can change routeId before init().
      providers: [...ctx.providers, {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { get paramMap() { return convertToParamMap(routeId ? { id: routeId } : {}); } },
          get paramMap() { return params$; }
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectDetailComponent);
    component = fixture.componentInstance;
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => fixture.destroy());

  describe('loading', () => {
    /**
     * @description The page loads the project, its settings form (edit fields without the order
     *   link, with the assignee), checkpoints, the client accounts, the files, the assignees and
     *   the threads of THIS project with their unread counts.
     * @input  route id 7
     * @output get('project-portal/projects/7'); getCollection threads / accounts / files / assignees;
     *   form name 'Shop' / description '' / assignee '3'; 12 fields without order_id; assignee
     *   options Jana, Petr; 1 checkpoint; 2 accounts; 2 files; unreadTotal 3; not dirty
     */
    it('loads the project and its conversations', fakeAsync(() => {
      init();
      expect(dh().get).toHaveBeenCalledWith('project-portal/projects/7');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/project-threads', { project_id: 7, no_pagination: 'true' });
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/accounts');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/files');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/assignees');
      expect(component.loading).toBeFalse();
      expect(component.notFound).toBeFalse();
      expect(component.form['name']).toBe('Shop');
      expect(component.form['description']).toBe('');
      expect(component.fields.map(f => f.column_name)).not.toContain('order_id');
      expect(component.fields.length).toBe(12);
      expect(component.form['assignee_id']).toBe('3');
      expect(component.fields.find(f => f.column_name === 'assignee_id')!.options).toEqual([{ value: '3', label: 'Jana' }, { value: '5', label: 'Petr' }]);
      expect(component.checkpoints.length).toBe(1);
      expect(component.accounts.map(a => a.username)).toEqual(['klient', 'anna']);
      expect(component.files.length).toBe(2);
      expect(component.checkpointStatusLabels['done']).toBe('projects.checkpoint_status_done');
      expect(component.unreadTotal).toBe(3);
      expect(component.dirty).toBeFalse();
      expect(component.attachmentRules as unknown).toEqual(TEST_UPLOAD_RULES.project_thread);
      discardPeriodicTasks();
    }));

    /**
     * @description An invalid id or a failed load shows "not found".
     * @input  route id 'abc'; then the API failing for id 7
     * @output notFound without any request; notFound after the failure
     */
    it('shows not found for a wrong id or a failed load', fakeAsync(() => {
      routeId = 'abc';
      init();
      expect(component.notFound).toBeTrue();
      expect(dh().get).not.toHaveBeenCalled();
      fixture.destroy();

      routeId = '7';
      dh().get.and.returnValue(throwError(() => ({ status: 404 })));
      fixture = TestBed.createComponent(ProjectDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.notFound).toBeTrue();
      expect(component.loading).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description The conversations refresh every minute silently and the open thread keeps its messages.
     * @input  thread 3 open with messages; the API closes thread 3; THREAD_REFRESH_SECONDS pass
     * @output getCollection called again; threadsLoading stays false; selectedThread status 'closed', messages kept
     */
    it('refreshes the conversations periodically', fakeAsync(() => {
      init();
      component.selectedThread = { ...threads()[0], messages: [{ id: 1 } as any] };
      dh().getCollection.calls.reset();
      dh().getCollection.and.returnValue(of([{ ...threads()[0], status: 'closed' }]));
      tick(THREAD_REFRESH_SECONDS * 1000);
      expect(dh().getCollection).toHaveBeenCalledTimes(1);
      expect(component.threadsLoading).toBeFalse();
      expect(component.selectedThread!.status).toBe('closed');
      expect(component.selectedThread!.messages!.length).toBe(1);
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      component.loadThreads();
      expect(component.threadsLoading).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('settings', () => {
    /**
     * @description Saving sends only the changed fields (cleared text as null) and resets the dirty state.
     * @input  name 'Shop 2', project_lead '' ; saveSettings(); API answers the updated project
     * @output put('project-portal/projects/7', { name: 'Shop 2', project_lead: null }); success alert; dirty false; saving false
     */
    it('saves the changed settings', fakeAsync(() => {
      init();
      component.form['name'] = 'Shop 2';
      component.form['project_lead'] = '  ';
      expect(component.dirty).toBeTrue();
      dh().put.and.returnValue(of({ ...project(), name: 'Shop 2', project_lead: null, checkpoints: undefined }));
      component.saveSettings();
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7', { name: 'Shop 2', project_lead: null });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.project_updated_message', 'success');
      expect(component.dirty).toBeFalse();
      expect(component.saving).toBeFalse();
      expect(component.checkpoints.length).toBe(1);
      discardPeriodicTasks();
    }));

    /**
     * @description Nothing is sent without changes, while saving, with an empty required field or
     *   without permission; a failed save keeps the changes.
     * @input  the guard states; then put failing
     * @output put only for the failing call; dirty stays true; saving false
     */
    it('guards saving', fakeAsync(() => {
      init();
      component.saveSettings();
      component.form['name'] = '  ';
      component.saveSettings();
      component.form['name'] = 'X';
      component.saving = true;
      component.saveSettings();
      component.saving = false;
      ctx.permissions.granted = new Set();
      component.saveSettings();
      expect(dh().put).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.saveSettings();
      expect(dh().put).toHaveBeenCalledTimes(1);
      expect(component.dirty).toBeTrue();
      expect(component.saving).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Discarding restores the saved values.
     * @input  name changed; discardChanges()
     * @output name 'Shop'; dirty false
     */
    it('discards the changes', fakeAsync(() => {
      init();
      component.form['name'] = 'Other';
      component.discardChanges();
      expect(component.form['name']).toBe('Shop');
      expect(component.dirty).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('leaving the page', () => {
    /**
     * @description Back asks first with unsaved settings; cancel stays, confirm leaves to the list.
     * @input  dirty form; confirm false, then true; then clean form
     * @output confirm('projects.detail_unsaved_title', …); no navigation after cancel; navigate(['/admin/project-portal/projects']);
     *   clean form leaves without asking
     */
    it('asks before leaving with unsaved settings', fakeAsync(async () => {
      init();
      component.form['name'] = 'Other';
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.goBack();
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.detail_unsaved_title', 'projects.detail_unsaved_message');
      expect(navigate).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.goBack();
      expect(navigate).toHaveBeenCalledWith(['/admin/project-portal/projects']);
      component.discardChanges();
      ctx.confirm.open.calls.reset();
      await component.goBack();
      expect(ctx.confirm.open).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The browser asks on reload / close while settings are unsaved or the one-time
     *   password was not copied.
     * @input  clean; dirty; clean with an uncopied password; copied
     * @output defaultPrevented false, true, true, false
     */
    it('protects unsaved work on reload', fakeAsync(() => {
      init();
      const unload = () => { const e = new Event('beforeunload', { cancelable: true }); component.onBeforeUnload(e as BeforeUnloadEvent); return e.defaultPrevented; };
      expect(unload()).toBeFalse();
      component.form['name'] = 'Other';
      expect(unload()).toBeTrue();
      component.discardChanges();
      component.revealedPassword = { accountId: 11, username: 'klient', password: 'pw' };
      expect(unload()).toBeTrue();
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      component.copyPassword();
      expect(unload()).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('access', () => {
    /**
     * @description A saved assignee who cannot be picked any more stays in the select under the
     *   stored name; saving the settings keeps the options; a failed assignee load leaves the
     *   select empty (the template adds "—").
     * @input  project assignee #9 'Old' not among [Jana, Petr]; then the assignees request fails
     * @output options Jana, Petr, Old (#9); after the failure []
     */
    it('keeps a saved assignee that cannot be picked any more', fakeAsync(() => {
      dh().get.and.returnValue(of({ ...project(), assignee_id: 9, assignee_name: 'Old' }));
      init();
      expect(component.fields.find(f => f.column_name === 'assignee_id')!.options!.map(o => o.label)).toEqual(['Jana', 'Petr', 'Old']);
      expect(component.form['assignee_id']).toBe('9');
      fixture.destroy();

      dh().getCollection.and.callFake((endpoint: string) => endpoint === 'project-portal/projects/assignees' ? throwError(() => new Error('x')) : collections(endpoint));
      dh().get.and.returnValue(of({ ...project(), assignee_id: null, assignee_name: null }));
      fixture = TestBed.createComponent(ProjectDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.fields.find(f => f.column_name === 'assignee_id')!.options).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description A new account: the form opens empty (Czech, with a password, no invitation),
     *   needs a login name (3+), a display name and an access method; the e-mail is optional
     *   (only prefilled - the notifications are the client's choice); saving sends the trimmed /
     *   lower-cased fields with the access method (+ a typed-in password only) and shows the
     *   password of the answer once, visible and not copied. Without a password the account needs
     *   an invitation, which needs an e-mail; a sent invitation is confirmed, a failed one reported.
     * @input  openAddAccount; draft ' Petr.N ', ' Petr ', email 'p@x.cz'; post → meta.password 'Gen12345abcd';
     *   then 'eva' with a typed password failing; then 'ota' invitation only (meta.invited true / false)
     * @output invalid until filled; postWithMeta('project-portal/projects/7/accounts', {username 'petr.n', display_name 'Petr',
     *   email 'p@x.cz', language 'cz', with_password true, send_invitation false}); account appended;
     *   revealed {13, 'petr.n', 'Gen12345abcd'}; form closed; invitation without e-mail invalid and
     *   switched off when the e-mail is cleared; success / danger alert after an invitation
     */
    it('adds a client account and shows its password once', fakeAsync(() => {
      init();
      component.openAddAccount();
      expect(component.accountFormMode).toBe('add');
      expect(component.accountDraft).toEqual({ username: '', display_name: '', email: '', language: 'cz', password: '', with_password: true, send_invitation: false });
      expect(component.accountDraftValid).toBeFalse();
      component.accountDraft.username = ' Pe ';
      component.accountDraft.display_name = ' Petr ';
      expect(component.accountDraftValid).toBeFalse();
      component.accountDraft.username = ' Petr.N ';
      expect(component.accountDraftValid).toBeTrue();
      component.accountDraft.email = 'p@x.cz';

      dh().postWithMeta.and.returnValue(of({ data: { id: 13, username: 'petr.n', display_name: 'Petr', email: 'p@x.cz', notify_replies: false, notify_checkpoint_status: false, notify_checkpoint_dates: false, language: 'cz' }, meta: { password: 'Gen12345abcd', invited: false } }));
      component.saveAccount();
      expect(dh().postWithMeta).toHaveBeenCalledWith('project-portal/projects/7/accounts', {
        username: 'petr.n', display_name: 'Petr', email: 'p@x.cz', language: 'cz', with_password: true, send_invitation: false,
      });
      expect(component.accounts.map(a => a.id)).toEqual([11, 12, 13]);
      expect(component.revealedPassword).toEqual({ accountId: 13, username: 'petr.n', password: 'Gen12345abcd' });
      expect(component.passwordVisible).toBeTrue();
      expect(component.passwordCopied).toBeFalse();
      expect(component.accountFormMode).toBeNull();

      component.openAddAccount();
      component.accountDraft = { username: 'eva', display_name: 'Eva', email: '', language: 'en', password: 'Typed12345', with_password: true, send_invitation: false };
      dh().postWithMeta.and.returnValue(throwError(() => new Error('422')));
      component.saveAccount();
      expect(dh().postWithMeta).toHaveBeenCalledWith('project-portal/projects/7/accounts', jasmine.objectContaining({ password: 'Typed12345', email: null, language: 'en' }));
      expect(component.accountFormMode).toBe('add');
      expect(component.accountSaving).toBeFalse();

      // Invitation only: needs the e-mail; clearing the e-mail switches the invitation off.
      component.accountDraft = { username: 'ota', display_name: 'Ota', email: 'ota@x.cz', language: 'cz', password: 'ignored', with_password: false, send_invitation: true };
      expect(component.accountDraftValid).toBeTrue();
      component.accountDraft.email = ' ';
      component.onAccountEmailChange();
      expect(component.accountDraft.send_invitation).toBeFalse();
      expect(component.accountDraftValid).toBeFalse();
      component.accountDraft.email = 'ota@x.cz';
      component.accountDraft.send_invitation = true;
      ctx.alert.open.calls.reset();
      dh().postWithMeta.and.returnValue(of({ data: { id: 14, username: 'ota', display_name: 'Ota', email: 'ota@x.cz', has_password: false, language: 'cz' }, meta: { password: null, invited: true } }));
      component.saveAccount();
      expect(dh().postWithMeta.calls.mostRecent().args[1]).toEqual({ username: 'ota', display_name: 'Ota', email: 'ota@x.cz', language: 'cz', with_password: false, send_invitation: true });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.account_invite_sent', 'success');
      expect(component.revealedPassword?.accountId).not.toBe(14);

      component.openAddAccount();
      component.accountDraft = { username: 'iva', display_name: 'Iva', email: 'iva@x.cz', language: 'cz', password: '', with_password: true, send_invitation: true };
      dh().postWithMeta.and.returnValue(of({ data: { id: 15, username: 'iva', display_name: 'Iva', email: 'iva@x.cz', language: 'cz' }, meta: { password: 'Gen98765abcd', invited: false } }));
      component.saveAccount();
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.account_invite_failed_title', 'projects.account_invite_failed_message', 'danger');
      discardPeriodicTasks();
    }));

    /**
     * @description Editing an account sends only the changed fields; no change closes without a
     *   request; no permission opens nothing; a failure keeps the form.
     * @input  edit anna: display_name 'Anna Veliká', email cleared; then unchanged; then failure
     * @output put('project-portal/projects/7/accounts/12', { display_name, email: null }); list updated (the API
     *   turned the client's notifications off with the e-mail)
     */
    it('edits a client account', fakeAsync(() => {
      init();
      const anna = component.accounts[1];
      component.openEditAccount(anna);
      expect(component.accountDraft).toEqual({ username: 'anna', display_name: 'Anna Malá', email: 'anna@client.cz', language: 'en', password: '' });
      expect(component.accountNotifications(anna)).toEqual(['projects.account_notify_replies', 'projects.account_notify_checkpoint_dates']);
      component.accountDraft.display_name = 'Anna Veliká';
      component.accountDraft.email = '';
      dh().put.and.returnValue(of({ ...anna, display_name: 'Anna Veliká', email: null, notify_replies: false, notify_checkpoint_dates: false }));
      component.saveAccount();
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7/accounts/12', { display_name: 'Anna Veliká', email: null });
      expect(component.accounts[1].display_name).toBe('Anna Veliká');
      expect(component.accountNotifications(component.accounts[1])).toEqual([]);
      expect(component.accountFormMode).toBeNull();

      dh().put.calls.reset();
      component.openEditAccount(component.accounts[1]);
      component.saveAccount();
      expect(dh().put).not.toHaveBeenCalled();
      expect(component.accountFormMode).toBeNull();

      component.openEditAccount(component.accounts[0]);
      component.accountDraft.username = 'firma';
      dh().put.and.returnValue(throwError(() => new Error('422')));
      component.saveAccount();
      expect(component.accountFormMode).toBe('edit');
      component.cancelAccountForm();
      expect(component.editingAccountId).toBeNull();

      ctx.permissions.granted = new Set();
      component.openEditAccount(component.accounts[0]);
      component.openAddAccount();
      expect(component.accountFormMode).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description Reset asks first, then shows the new password once (devices signed out);
     *   removal asks first and drops the account (and its shown password); cancelled / busy /
     *   no permission send nothing; failures clear the busy flag.
     * @input  reset klient confirm true → meta.password 'New12345abcd'; remove klient confirm false, then true; guards; failures
     */
    it('resets the password of an account and removes an account', fakeAsync(async () => {
      init();
      const klient = component.accounts[0];
      dh().postWithMeta.and.returnValue(of({ data: { ...klient }, meta: { password: 'New12345abcd', ended_sessions: 1 } }));
      await component.resetAccountPassword(klient);
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.account_reset_confirm_title', 'projects.account_reset_confirm_message');
      expect(dh().postWithMeta).toHaveBeenCalledWith('project-portal/projects/7/accounts/11/password', {});
      expect(component.revealedPassword).toEqual({ accountId: 11, username: 'klient', password: 'New12345abcd' });
      expect(component.accounts[0].active_sessions).toBe(0);
      expect(component.accountBusyId).toBeNull();

      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.removeAccount(klient);
      expect(dh().delete).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      dh().delete.and.returnValue(of(null));
      await component.removeAccount(klient);
      expect(dh().delete).toHaveBeenCalledWith('project-portal/projects/7/accounts/11');
      expect(component.accounts.map(a => a.id)).toEqual([12]);
      expect(component.revealedPassword).toBeNull();

      dh().postWithMeta.calls.reset();
      component.accountBusyId = 99;
      await component.resetAccountPassword(component.accounts[0]);
      await component.removeAccount(component.accounts[0]);
      component.accountBusyId = null;
      ctx.permissions.granted = new Set();
      await component.resetAccountPassword(component.accounts[0]);
      expect(dh().postWithMeta).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().postWithMeta.and.returnValue(throwError(() => new Error('x')));
      await component.resetAccountPassword(component.accounts[0]);
      expect(component.accountBusyId).toBeNull();
      dh().delete.and.returnValue(throwError(() => new Error('x')));
      await component.removeAccount(component.accounts[0]);
      expect(component.accountBusyId).toBeNull();
      expect(component.accounts.length).toBe(1);
      discardPeriodicTasks();
    }));

    /**
     * @description The shown password can be hidden / shown and copied alone or with the link and
     *   login name; leaving or dismissing it uncopied asks first; the URL is copied from the project.
     * @input  revealed {11, klient, pw}; toggle; copy; copy details; dismiss; goBack with an uncopied one (cancel / confirm)
     * @output clipboard 'pw', details text with url/username/password replaced, 'https://x/p/7'; dismiss after copy
     *   does not ask; uncopied: confirm('projects.close_uncopied_password_title', …)
     */
    it('copies the password and the sign-in details and asks before losing them', fakeAsync(async () => {
      ctx.i18n.getValue.and.callFake((key: string) => key === 'projects.access_details_text' ? '{url} | {username} | {password}' : key);
      init();
      const write = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      component.copyPassword();
      component.copyAccessDetails();
      expect(write).not.toHaveBeenCalled();
      component.revealedPassword = { accountId: 11, username: 'klient', password: 'pw' };
      component.togglePasswordVisibility();
      expect(component.passwordVisible).toBeTrue();
      component.copyPassword();
      component.copyAccessDetails();
      component.copyPublicUrl();
      expect(write.calls.allArgs()).toEqual([['pw'], ['https://x/p/7 | klient | pw'], ['https://x/p/7']]);
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.copied_title', 'projects.access_details_copied_message', 'success');
      await component.dismissPassword();
      expect(ctx.confirm.open).not.toHaveBeenCalled();
      expect(component.revealedPassword).toBeNull();

      component.revealedPassword = { accountId: 11, username: 'klient', password: 'pw2' };
      component.passwordCopied = false;
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.dismissPassword();
      await component.goBack();
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.close_uncopied_password_title', 'projects.close_uncopied_password_message');
      expect(navigate).not.toHaveBeenCalled();
      expect(component.revealedPassword).not.toBeNull();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.goBack();
      expect(navigate).toHaveBeenCalledWith(['/admin/project-portal/projects']);

      component.project = null;
      write.calls.reset();
      component.copyPublicUrl();
      expect(write).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The files card reloads on demand, opens the thread of a file (switching the
     *   filter to "all" for a closed thread) and keeps the list on a failure.
     * @input  openFileThread(brief.pdf of closed thread 4); unknown thread; loadFiles failing
     * @output threadFilter 'all'; getWithMeta('project-portal/project-threads/4'); unknown → nothing; files kept, not loading
     */
    it('lists the files and opens their threads', fakeAsync(() => {
      init();
      dh().getWithMeta.and.returnValue(of({ data: { ...threads()[1], messages: [] }, meta: { has_more_older_messages: false } }));
      component.openFileThread(component.files[1]);
      expect(component.threadFilter).toBe('all');
      expect(dh().getWithMeta).toHaveBeenCalledWith('project-portal/project-threads/4');
      dh().getWithMeta.calls.reset();
      component.openFileThread({ ...component.files[0], thread_id: 999 });
      expect(dh().getWithMeta).not.toHaveBeenCalled();
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      component.loadFiles();
      expect(component.files.length).toBe(2);
      expect(component.filesLoading).toBeFalse();
      flush();
      discardPeriodicTasks();
    }));
  });

  describe('checkpoints', () => {
    /**
     * @description A checkpoint is added with the trimmed title, description, due date and internal
     *   note (empty = none); empty titles or no permission send nothing.
     * @input  '  '; then '  Launch ' with description '  Go live  '; then 'Docs' with due date and note; then no permission
     * @output post(…, { label 'Launch', description 'Go live', due_date null, internal_note null }),
     *   post(…, { label 'Docs', description null, due_date '2026-12-24', internal_note 'Ask hosting' }); inputs cleared
     */
    it('adds checkpoints', fakeAsync(() => {
      init();
      component.newCheckpointLabel = '  ';
      component.addCheckpoint();
      expect(dh().post).not.toHaveBeenCalled();
      dh().post.and.returnValue(of({ id: 2, label: 'Launch', description: 'Go live', status: 'new', sort_order: 2 }));
      component.newCheckpointLabel = '  Launch ';
      component.newCheckpointDescription = '  Go live  ';
      component.addCheckpoint();
      expect(dh().post).toHaveBeenCalledWith('project-portal/projects/7/checkpoints', { label: 'Launch', description: 'Go live', due_date: null, internal_note: null });
      expect(component.checkpoints.length).toBe(2);
      expect(component.newCheckpointLabel).toBe('');
      expect(component.newCheckpointDescription).toBe('');
      component.newCheckpointLabel = 'Docs';
      component.newCheckpointDueDate = '2026-12-24';
      component.newCheckpointNote = '  Ask hosting  ';
      component.addCheckpoint();
      expect(dh().post).toHaveBeenCalledWith('project-portal/projects/7/checkpoints', { label: 'Docs', description: null, due_date: '2026-12-24', internal_note: 'Ask hosting' });
      expect([component.newCheckpointDueDate, component.newCheckpointNote]).toEqual(['', '']);
      dh().post.calls.reset();
      ctx.permissions.granted = new Set();
      component.newCheckpointLabel = 'X';
      component.addCheckpoint();
      expect(dh().post).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The status is picked in the checkpoint's dropdown (no cycling by clicks): the
     *   picked status is saved; the same status, a busy row or no permission send nothing; a failed
     *   save puts the dropdown back.
     * @input  checkpoint 1 (new); dropdown 'done'; then 'done' again; busy; no permission; failure on 'active'
     * @output put('project-portal/projects/7/checkpoints/1', { status: 'done' }) once; status 'done'; dropdown back to 'done' after
     *   the guards and the failure; busy flag cleared
     */
    it('sets the checkpoint status picked in the dropdown', fakeAsync(() => {
      init();
      const select = (value: string) => { const el = document.createElement('select'); ['new', 'active', 'done'].forEach(v => el.add(new Option(v, v))); el.value = value; return el; };
      const cp = component.checkpoints[0];
      dh().put.and.returnValue(of({ ...cp, status: 'done' }));
      component.setCheckpointStatus(cp, select('done'));
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7/checkpoints/1', { status: 'done' });
      const saved = component.checkpoints[0];
      expect(saved.status).toBe('done');
      component.setCheckpointStatus(saved, select('done'));
      component.checkpointBusyIds.add(1);
      let el = select('new');
      component.setCheckpointStatus(saved, el);
      expect(el.value).toBe('done');
      component.checkpointBusyIds.clear();
      ctx.permissions.granted = new Set();
      el = select('new');
      component.setCheckpointStatus(saved, el);
      expect(el.value).toBe('done');
      expect(dh().put).toHaveBeenCalledTimes(1);
      ctx.permissions.granted = 'all';
      dh().put.and.returnValue(throwError(() => new Error('x')));
      el = select('active');
      component.setCheckpointStatus(saved, el);
      expect(el.value).toBe('done');
      expect(component.checkpoints[0].status).toBe('done');
      expect(component.checkpointBusyIds.has(1)).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description "Add checkpoint" opens the form (closing an open editor), cancel closes it and
     *   forgets the text, a successful add closes it; the header shows how many are done.
     * @input  editor of Design open; openAddCheckpoint; type; cancel; open again; add 'Launch'; no permission
     * @output addingCheckpoint true + editor closed; texts cleared on cancel; closed after add;
     *   checkpointsDone 0 → 1 after Launch (done); no form without permission; rendered form with input + textarea
     */
    it('opens and closes the new checkpoint form', fakeAsync(() => {
      init();
      component.startEditCheckpoint(component.checkpoints[0]);
      component.openAddCheckpoint();
      expect(component.addingCheckpoint).toBeTrue();
      expect(component.editingCheckpointId).toBeNull();
      component.newCheckpointLabel = 'X';
      component.newCheckpointDescription = 'Y';
      component.cancelAddCheckpoint();
      expect([component.addingCheckpoint, component.newCheckpointLabel, component.newCheckpointDescription]).toEqual([false, '', '']);

      const el = fixture.nativeElement as HTMLElement;
      go('progress');
      (el.querySelector('#pd-cp-title')!.closest('.pd-card')!.querySelector('.pd-card-head-actions .pd-btn:last-child') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.pd-cp-new input')).not.toBeNull();
      expect(el.querySelector('.pd-cp-new textarea')).not.toBeNull();

      expect(component.checkpointsDone).toBe(0);
      dh().post.and.returnValue(of({ id: 2, label: 'Launch', status: 'done', sort_order: 2 }));
      component.newCheckpointLabel = 'Launch';
      component.addCheckpoint();
      expect(component.addingCheckpoint).toBeFalse();
      expect(component.checkpointsDone).toBe(1);

      ctx.permissions.granted = new Set();
      component.openAddCheckpoint();
      expect(component.addingCheckpoint).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description The title and description are edited in the row's editor: only changed fields
     *   are sent (cleared description = null), nothing when unchanged or with an empty title, the
     *   editor stays open on a failure; cancel closes it; without permission it does not open.
     * @input  edit Design: description '  Wireframes ', save; edit again unchanged; title '  ', save;
     *   title 'UX', failure; cancel; no permission
     * @output put(…/checkpoints/1, { description: 'Wireframes' }); editor closed + list updated; unchanged
     *   closes without request; empty title sends nothing; put({ label: 'UX' }) failure keeps editor;
     *   cancel → null; no editor without permission
     */
    it('edits the title and description of a checkpoint', fakeAsync(() => {
      init();
      const cp = component.checkpoints[0];
      component.startEditCheckpoint(cp);
      expect(component.editingCheckpointId).toBe(1);
      expect(component.checkpointDraft).toEqual({ label: 'Design', description: '', due_date: '', internal_note: '' });
      component.checkpointDraft.description = '  Wireframes ';
      dh().put.and.returnValue(of({ ...cp, description: 'Wireframes' }));
      component.saveCheckpoint(cp);
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7/checkpoints/1', { description: 'Wireframes' });
      expect(component.editingCheckpointId).toBeNull();
      const saved = component.checkpoints[0];
      expect(saved.description).toBe('Wireframes');

      component.startEditCheckpoint(saved);
      component.saveCheckpoint(saved);
      expect(component.editingCheckpointId).toBeNull();
      component.startEditCheckpoint(saved);
      component.checkpointDraft.label = '  ';
      component.saveCheckpoint(saved);
      expect(dh().put).toHaveBeenCalledTimes(1);

      component.checkpointDraft = { label: 'UX', description: '', due_date: '', internal_note: '' };
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.saveCheckpoint(saved);
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7/checkpoints/1', { label: 'UX', description: null });
      expect(component.editingCheckpointId).toBe(1);
      expect(component.checkpointBusyIds.has(1)).toBeFalse();
      component.cancelEditCheckpoint();
      expect(component.editingCheckpointId).toBeNull();

      ctx.permissions.granted = new Set();
      component.startEditCheckpoint(saved);
      expect(component.editingCheckpointId).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description Due date and internal note are edited with the title (only changes sent); a
     *   checkpoint is overdue when its date passed and it is not done.
     * @input  Design: due '2026-12-01', note ' Hosting '; isOverdue with today 2026-12-02 / 2026-11-30; done
     * @output put(…/checkpoints/1, { due_date, internal_note: 'Hosting' }); stored; overdue true / false / false
     */
    it('edits the due date and internal note and marks overdue checkpoints', fakeAsync(() => {
      init();
      const cp = component.checkpoints[0];
      component.startEditCheckpoint(cp);
      component.checkpointDraft.due_date = '2026-12-01';
      component.checkpointDraft.internal_note = ' Hosting ';
      dh().put.and.returnValue(of({ ...cp, due_date: '2026-12-01', internal_note: 'Hosting' }));
      component.saveCheckpoint(cp);
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7/checkpoints/1', { due_date: '2026-12-01', internal_note: 'Hosting' });
      const saved = component.checkpoints[0];
      expect([saved.due_date, saved.internal_note]).toEqual(['2026-12-01', 'Hosting']);
      expect(component.isOverdue(saved, '2026-12-02')).toBeTrue();
      expect(component.isOverdue(saved, '2026-11-30')).toBeFalse();
      expect(component.isOverdue({ ...saved, status: 'done' }, '2026-12-02')).toBeFalse();
      expect(component.isOverdue({ ...saved, due_date: null }, '2026-12-02')).toBeFalse();
      expect(ProjectDetailComponent.localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      discardPeriodicTasks();
    }));

    /**
     * @description Up / down moves a checkpoint at once and saves the whole order; the ends, a
     *   running save and no permission do nothing; a failure restores the previous order.
     * @input  checkpoints A(1), B(2), C(3); move B up; move A up (first); failure moving C up
     * @output put('project-portal/projects/7/checkpoints/order', { ids: [2, 1, 3] }); order B, A, C with sort 0..2;
     *   ends ignored; failure → B, A, C again
     */
    it('reorders the checkpoints', fakeAsync(() => {
      dh().get.and.returnValue(of({ ...project(), checkpoints: [
        { id: 1, label: 'A', status: 'new', sort_order: 0 }, { id: 2, label: 'B', status: 'new', sort_order: 1 }, { id: 3, label: 'C', status: 'new', sort_order: 2 },
      ] }));
      init();
      dh().put.and.returnValue(of([]));
      component.moveCheckpoint(1, -1);
      expect(dh().put).toHaveBeenCalledWith('project-portal/projects/7/checkpoints/order', { ids: [2, 1, 3] });
      expect(component.checkpoints.map(c => [c.label, c.sort_order])).toEqual([['B', 0], ['A', 1], ['C', 2]]);
      expect(component.checkpointsReordering).toBeFalse();
      dh().put.calls.reset();
      component.moveCheckpoint(0, -1);
      component.moveCheckpoint(2, 1);
      component.checkpointsReordering = true;
      component.moveCheckpoint(1, 1);
      component.checkpointsReordering = false;
      ctx.permissions.granted = new Set();
      component.moveCheckpoint(1, 1);
      expect(dh().put).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.moveCheckpoint(2, -1);
      expect(component.checkpoints.map(c => c.label)).toEqual(['B', 'A', 'C']);
      expect(component.checkpointsReordering).toBeFalse();

      go('progress');
      const moves = (fixture.nativeElement as HTMLElement).querySelectorAll('.pd-cp-move');
      expect(moves.length).toBe(3);
      expect((moves[0].querySelector('button') as HTMLButtonElement).disabled).toBeTrue();
      discardPeriodicTasks();
    }));

    /**
     * @description A description is previewed under the title; the editor replaces it while editing.
     * @input  Design with description 'Wireframes'; then a click on its edit button
     * @output .pd-cp-description 'Wireframes'; then .pd-cp-editor with input + textarea, no preview
     */
    it('renders the description preview and the editor', fakeAsync(() => {
      dh().get.and.callFake(() => of({ ...project(), checkpoints: [{ id: 1, label: 'Design', description: 'Wireframes', status: 'new', sort_order: 1 }] }));
      init();
      go('progress');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pd-cp-description')!.textContent).toContain('Wireframes');
      (el.querySelector('.pd-cp-action') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.editingCheckpointId).toBe(1);
      expect(el.querySelector('.pd-cp-editor input')).not.toBeNull();
      expect(el.querySelector('.pd-cp-editor textarea')).not.toBeNull();
      expect(el.querySelector('.pd-cp-description')).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description The checkpoint row renders a dropdown with all statuses and the current one selected.
     * @input  checkpoint 'Design' (new)
     * @output select.pd-cp-status with 3 options, value 'new', aria-label naming the checkpoint
     */
    it('renders the checkpoint status as a dropdown', fakeAsync(() => {
      init();
      go('progress');
      const select = (fixture.nativeElement as HTMLElement).querySelector('select.pd-cp-status') as HTMLSelectElement;
      expect(select.options.length).toBe(3);
      expect(select.value).toBe('new');
      expect(select.getAttribute('aria-label')).toBe('projects.checkpoint_status_label: Design');
      discardPeriodicTasks();
    }));

    /**
     * @description Deleting a checkpoint asks with its label first.
     * @input  message '{label}?'; confirm false, then true
     * @output confirm('…title', 'Design?'); delete('project-portal/projects/7/checkpoints/1') only after confirm; removed
     */
    it('deletes a checkpoint after confirmation', fakeAsync(async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'projects.delete_checkpoint_confirm_message' ? '{label}?' : p));
      init();
      const cp = component.checkpoints[0];
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.deleteCheckpoint(cp);
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.delete_checkpoint_confirm_title', 'Design?');
      expect(dh().delete).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.deleteCheckpoint(cp);
      expect(dh().delete).toHaveBeenCalledWith('project-portal/projects/7/checkpoints/1');
      expect(component.checkpoints).toEqual([]);
      discardPeriodicTasks();
    }));
  });

  describe('conversations', () => {
    /**
     * @description The filter chips show the active (default), closed or all threads with their counts.
     * @input  threads 3 (active), 4 (closed), 5 (active); filters active / closed / all
     * @output visible ids [3, 5] / [4] / [3, 4, 5]; counts 2 / 1 / 3
     */
    it('filters the threads', fakeAsync(() => {
      init();
      expect(component.visibleThreads.map(t => t.id)).toEqual([3, 5]);
      component.setThreadFilter('closed');
      expect(component.visibleThreads.map(t => t.id)).toEqual([4]);
      component.setThreadFilter('all');
      expect(component.visibleThreads.map(t => t.id)).toEqual([3, 4, 5]);
      expect([component.threadCount('active'), component.threadCount('closed'), component.threadCount('all')]).toEqual([2, 1, 3]);
      discardPeriodicTasks();
    }));

    /**
     * @description Opening a thread loads its messages (the API marks it read), clears its unread
     *   badge and scrolls to the newest message; a failure ends the loading.
     * @input  openThread(thread 3); message list 100 px; then a failing request
     * @output getWithMeta('project-portal/project-threads/3'); has_more from meta; admin_unread_count 0, unreadTotal 1;
     *   scrollTop 100; loading false after failure; closeThread clears it
     */
    it('opens a thread and marks it read', fakeAsync(() => {
      init();
      const list = scrollList(100);
      component.messageList = { nativeElement: list.el } as any;
      dh().getWithMeta.and.returnValue(of({ data: { ...threads()[0], messages: [{ id: 10, author_type: 'customer', body: 'Hi' }] }, meta: { has_more_older_messages: true } }));
      component.openThread(threads()[0]);
      expect(dh().getWithMeta).toHaveBeenCalledWith('project-portal/project-threads/3');
      expect(component.selectedThread?.has_more_older_messages).toBeTrue();
      expect(component.threads.find(t => t.id === 3)!.admin_unread_count).toBe(0);
      expect(component.unreadTotal).toBe(1);
      expect(component.threadLoading).toBeFalse();
      tick();
      expect(list.sets).toEqual([100]);
      dh().getWithMeta.and.returnValue(throwError(() => new Error('x')));
      component.openThread(threads()[1]);
      expect(component.threadLoading).toBeFalse();
      component.closeThread();
      expect(component.selectedThread).toBeNull();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Changing the status updates the open thread and the list; no thread or no permission sends nothing.
     * @input  thread 3 open; changeThreadStatus('closed'); then guards
     * @output put('project-portal/project-threads/3/status', { status: 'closed' }); both copies closed; put once
     */
    it('changes the thread status', fakeAsync(() => {
      init();
      component.selectedThread = { ...threads()[0] };
      dh().put.and.returnValue(of({ ...threads()[0], status: 'closed' }));
      component.changeThreadStatus('closed');
      expect(dh().put).toHaveBeenCalledWith('project-portal/project-threads/3/status', { status: 'closed' });
      expect(component.selectedThread!.status).toBe('closed');
      expect(component.threads[0].status).toBe('closed');
      ctx.permissions.granted = new Set();
      component.changeThreadStatus('active');
      ctx.permissions.granted = 'all';
      component.selectedThread = null;
      component.changeThreadStatus('active');
      expect(dh().put).toHaveBeenCalledTimes(1);
      discardPeriodicTasks();
    }));

    /**
     * @description A text reply is posted as JSON, then the thread and the list reload.
     * @input  thread 3 open; replyBody '  Hello '
     * @output post('project-portal/project-threads/3/reply', { body: 'Hello', is_internal: false }); thread reloaded; threads reloaded; reply cleared
     */
    it('sends a text reply', fakeAsync(async () => {
      init();
      component.selectedThread = { ...threads()[0] };
      component.replyBody = '  Hello ';
      dh().getCollection.calls.reset();
      await component.sendReply();
      expect(dh().post).toHaveBeenCalledWith('project-portal/project-threads/3/reply', { body: 'Hello', is_internal: false });
      expect(dh().getWithMeta).toHaveBeenCalledWith('project-portal/project-threads/3');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/project-threads', { project_id: 7, no_pagination: 'true' });
      expect(component.replyBody).toBe('');
      expect(component.replySending).toBeFalse();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description A reply with files is sent as multipart FormData (body + attachments[]).
     * @input  replyFiles [a.pdf]; replyBody 'See file'
     * @output FormData body 'See file', is_internal '0', one attachments[]; files cleared; files card reloaded
     */
    it('sends a reply with attachments as FormData', fakeAsync(async () => {
      init();
      component.selectedThread = { ...threads()[0] };
      component.replyFiles = [file('a.pdf')];
      component.replyBody = 'See file';
      await component.sendReply();
      const body = dh().post.calls.mostRecent().args[1] as FormData;
      expect(body.get('body')).toBe('See file');
      expect(body.get('is_internal')).toBe('0');
      expect(body.getAll('attachments[]').length).toBe(1);
      expect(component.replyFiles).toEqual([]);
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/files');
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Empty replies, no thread, a running send or no permission send nothing; a failure keeps the text.
     * @input  guard states; then post fails
     * @output post not called for the guards; replyBody kept and replySending false after the failure
     */
    it('guards and recovers reply sending', fakeAsync(async () => {
      init();
      component.replyBody = '  ';
      component.selectedThread = { ...threads()[0] };
      await component.sendReply();
      component.replyBody = 'x';
      component.selectedThread = null;
      await component.sendReply();
      component.selectedThread = { ...threads()[0] };
      component.replySending = true;
      await component.sendReply();
      component.replySending = false;
      ctx.permissions.granted = new Set();
      await component.sendReply();
      expect(dh().post).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().post.and.returnValue(throwError(() => new Error('x')));
      await component.sendReply();
      expect(component.replyBody).toBe('x');
      expect(component.replySending).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Older messages are prepended and the scroll position is kept; guards send nothing.
     * @input  thread with message 20 and has_more; list 100 px; API [10] has_more false; then the guards and a failure
     * @output getWithMeta('…/messages?before_message_id=20'); messages [10, 20]; has_more false; scrollTop 0;
     *   loading false after failure
     */
    it('loads older messages', fakeAsync(() => {
      init();
      const list = scrollList(100);
      component.messageList = { nativeElement: list.el } as any;
      component.selectedThread = { ...threads()[0], has_more_older_messages: true, messages: [{ id: 20 } as any] };
      dh().getWithMeta.and.returnValue(of({ data: [{ id: 10 }], meta: { has_more_older_messages: false } }));
      component.loadOlderMessages();
      expect(dh().getWithMeta).toHaveBeenCalledWith('project-portal/project-threads/3/messages?before_message_id=20');
      expect(component.selectedThread!.messages!.map(m => m.id)).toEqual([10, 20]);
      expect(component.selectedThread!.has_more_older_messages).toBeFalse();
      tick();
      expect(list.sets).toEqual([0]);

      dh().getWithMeta.calls.reset();
      component.loadOlderMessages();
      component.selectedThread = { ...threads()[0], has_more_older_messages: true, messages: [] };
      component.loadOlderMessages();
      component.selectedThread = null;
      component.loadOlderMessages();
      component.selectedThread = { ...threads()[0], has_more_older_messages: true, messages: [{ id: 20 } as any] };
      component.olderMessagesLoading = true;
      component.loadOlderMessages();
      expect(dh().getWithMeta).not.toHaveBeenCalled();
      component.olderMessagesLoading = false;
      dh().getWithMeta.and.returnValue(throwError(() => new Error('x')));
      component.loadOlderMessages();
      expect(component.olderMessagesLoading).toBeFalse();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Status, priority and author labels are translated.
     * @input  threadStatusLabel / threadPriorityLabel / threadAuthorLabel
     * @output 'projects.thread_status_closed' / '…_active'; 'projects.thread_priority_high'; author admin / customer
     */
    it('translates the thread labels', fakeAsync(() => {
      init();
      expect(component.threadStatusLabel('closed')).toBe('projects.thread_status_closed');
      expect(component.threadStatusLabel('active')).toBe('projects.thread_status_active');
      expect(component.threadPriorityLabel('high')).toBe('projects.thread_priority_high');
      expect(component.threadAuthorLabel('admin')).toBe('projects.thread_author_admin');
      expect(component.threadAuthorLabel('customer')).toBe('projects.thread_author_customer');
      expect(component.waitingLabel(threads()[0])).toBe('projects.thread_waiting_on_us');
      expect(component.waitingLabel(threads()[2])).toBe('projects.thread_waiting_on_client');
      expect(component.waitingLabel(threads()[1])).toBe('');
      discardPeriodicTasks();
    }));

    /**
     * @description "Read by the client": our public messages written before the client last opened
     *   the thread; never internal notes or client messages; nothing without a read time.
     * @input  thread read at 10:00; admin 09:00, admin 11:00, internal 09:00, customer 09:00; rendered
     * @output true, false, false, false; the open thread renders one read and one unread receipt and
     *   the internal note with its tag; without a read time false
     */
    it('shows which of our messages the client read', fakeAsync(() => {
      init();
      const messages = [
        { id: 1, author_type: 'admin' as const, author_label: 'Jana', body: 'A', created_at: '2026-11-10T09:00:00' },
        { id: 2, author_type: 'admin' as const, author_label: 'Jana', body: 'B', created_at: '2026-11-10T11:00:00' },
        { id: 3, author_type: 'admin' as const, author_label: 'Jana', body: 'N', is_internal: true, created_at: '2026-11-10T09:00:00' },
        { id: 4, author_type: 'customer' as const, author_label: 'Anna', body: 'C', created_at: '2026-11-10T09:00:00' },
      ];
      component.selectedThread = { ...threads()[0], customer_last_read_at: '2026-11-10T10:00:00', messages };
      expect(messages.map(m => component.isReadByClient(m))).toEqual([true, false, false, false]);
      (component as any).cd.markForCheck();
      go('conversations');
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.pd-msg-receipt').length).toBe(2);
      expect(el.querySelectorAll('.pd-msg-receipt--read').length).toBe(1);
      expect(el.querySelector('.pd-msg--internal .pd-internal-tag')!.textContent).toContain('projects.message_internal_tag');
      component.selectedThread = { ...threads()[0], customer_last_read_at: null, messages };
      expect(component.isReadByClient(messages[0])).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description An internal note is sent with is_internal (JSON and FormData); opening another
     *   thread switches back to a reply to the client; the switch is rendered.
     * @input  thread 3; replyInternal true; body 'Check DNS'; then with a file; then openThread
     * @output post({ body, is_internal: true }); FormData is_internal '1'; replyInternal false after opening; .pd-reply--internal
     */
    it('sends internal notes', fakeAsync(async () => {
      init();
      component.selectedThread = { ...threads()[0], messages: [] };
      component.replyInternal = true;
      (component as any).cd.markForCheck();
      go('conversations');
      expect((fixture.nativeElement as HTMLElement).querySelector('.pd-reply--internal')).not.toBeNull();
      component.replyBody = 'Check DNS';
      await component.sendReply();
      expect(dh().post).toHaveBeenCalledWith('project-portal/project-threads/3/reply', { body: 'Check DNS', is_internal: true });
      expect(component.replyInternal).toBeFalse();
      component.replyInternal = true;
      component.replyFiles = [file('dns.txt')];
      component.replyBody = 'Log';
      await component.sendReply();
      expect((dh().post.calls.mostRecent().args[1] as FormData).get('is_internal')).toBe('1');
      flush();
      discardPeriodicTasks();
    }));
  });

  describe('reply attachments', () => {
    /**
     * @description Allowed files are added; wrong type, too large and files without extension are
     *   refused (first error shown); without rules the type is left to the server.
     * @input  a.PDF, virus.exe, big.zip (16 MB), README; then big.zip alone; remove; no rules + tool.exe
     * @output ['a.PDF'] with the type error; size error; removed and error cleared; tool.exe kept
     */
    it('validates selected reply files', fakeAsync(() => {
      init();
      const event = fileEvent(file('a.PDF'), file('virus.exe'), file('big.zip', 16 * 1024 * 1024), file('README'));
      component.onReplyFilesSelected(event);
      expect(component.replyFiles.map(f => f.name)).toEqual(['a.PDF']);
      expect(component.replyFileError).toBe('projects.attachment_error_type projects.attachment_allowed_types');
      expect((event.target as HTMLInputElement).value).toBe('');
      component.onReplyFilesSelected(fileEvent(file('big.zip', 16 * 1024 * 1024)));
      expect(component.replyFileError).toBe('projects.attachment_error_size');
      component.removeReplyFile(0);
      expect(component.replyFiles).toEqual([]);
      expect(component.replyFileError).toBeNull();
      component.attachmentRules = null;
      component.onReplyFilesSelected(fileEvent(file('tool.exe')));
      expect(component.replyFiles.map(f => f.name)).toEqual(['tool.exe']);
      discardPeriodicTasks();
    }));

    /**
     * @description At most the allowed number of attachments; an empty selection changes nothing; sizes are formatted.
     * @input  6 pdf files; empty selection; formatFileSize values
     * @output 5 files; 'projects.attachment_error_too_many'; '0 KB', '2 KB', '5.0 MB', ''
     */
    it('limits the attachments and formats sizes', fakeAsync(() => {
      init();
      component.onReplyFilesSelected(fileEvent(...[1, 2, 3, 4, 5, 6].map(i => file(`f${i}.pdf`))));
      expect(component.replyFiles.length).toBe(component.maxAttachments);
      expect(component.replyFileError).toBe('projects.attachment_error_too_many');
      component.onReplyFilesSelected(fileEvent());
      expect(component.replyFiles.length).toBe(component.maxAttachments);
      expect(component.formatFileSize(0)).toBe('0 KB');
      expect(component.formatFileSize(2048)).toBe('2 KB');
      expect(component.formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(component.formatFileSize(undefined as any)).toBe('');
      component.attachmentRules = null;
      expect([component.maxAttachments, component.maxAttachmentSizeMb]).toEqual([5, 15]);
      discardPeriodicTasks();
    }));
  });

  describe('sub-pages and phase 2', () => {
    /**
     * @description The address decides the sub-page (unknown = overview); the overview loads the
     *   activity of the team, Progress the templates (once), Files the files again.
     * @input  sections: none, 'progress', 'progress' again, 'files', 'nonsense'
     * @output section overview + activity loaded (2 items); progress + templates loaded once;
     *   files reloaded; 'nonsense' → overview
     */
    it('follows the sub-page of the address and loads what it needs', fakeAsync(() => {
      init();
      expect(component.section).toBe('overview');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/activity');
      expect(component.activity.length).toBe(2);
      go('progress');
      go('progress');
      expect(component.section).toBe('progress');
      expect(dh().getCollection.calls.allArgs().filter((a: unknown[]) => a[0] === 'project-portal/projects/templates').length).toBe(1);
      expect(component.templates.map(t => t.name)).toEqual(['Web']);
      dh().getCollection.calls.reset();
      go('files');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/files');
      go('nonsense');
      expect(component.section).toBe('overview');
      discardPeriodicTasks();
    }));

    /**
     * @description Activity items have a label per type and open their sub-page (a thread directly);
     *   the tab badges show unread messages and pending approvals.
     * @input  client_message (thread 3), approval_decided 'approved'; project with 2 pending approvals
     * @output labels 'projects.activity_client_message' / 'projects.activity_approval_approved';
     *   navigate to conversations + thread 3 opened; to approvals; badges 3 / 2 / 0
     */
    it('labels and opens the activity and shows the tab badges', fakeAsync(() => {
      dh().get.and.callFake(() => of({ ...project(), pending_approvals_count: 2 }));
      init();
      const [message, decision] = component.activity;
      expect(component.activityLabel(message)).toBe('projects.activity_client_message');
      expect(component.activityLabel(decision)).toBe('projects.activity_approval_approved');
      const openThread = spyOn(component, 'openThread');
      component.openActivity(message);
      expect(navigate).toHaveBeenCalledWith(['/admin/project-portal/projects', 7, 'conversations']);
      expect(openThread.calls.mostRecent().args[0].id).toBe(3);
      component.openActivity(decision);
      expect(navigate).toHaveBeenCalledWith(['/admin/project-portal/projects', 7, 'approvals']);
      expect([component.sectionBadge('conversations'), component.sectionBadge('approvals'), component.sectionBadge('access')]).toEqual([3, 2, 0]);
      discardPeriodicTasks();
    }));

    /**
     * @description "Mine" lists the threads assigned to the signed-in administrator; assigning a
     *   thread saves it, updates the list and reloads "Mine".
     * @input  assigned_to_me → thread 3; open thread 5; assignThread('5'), then ''
     * @output threadCount('mine') 1; put('project-portal/project-threads/5/assignee', { assignee_id: 5 }) then null;
     *   thread 5 assignee 5 / 'Petr'; my threads reloaded
     */
    it('filters my threads and assigns a thread', fakeAsync(() => {
      init();
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/project-threads', { project_id: 7, no_pagination: 'true', assigned_to_me: '1' });
      component.threadFilter = 'mine';
      expect(component.visibleThreads.map(t => t.id)).toEqual([3]);
      expect(component.threadCount('mine')).toBe(1);
      expect(component.assigneeOptions.map(a => a.full_name)).toEqual(['Jana', 'Petr']);

      component.selectedThread = { ...threads()[2], messages: [] };
      dh().put.and.returnValue(of({ id: 5, assignee_id: 5, assignee_name: 'Petr' }));
      dh().getCollection.calls.reset();
      component.assignThread('5');
      expect(dh().put).toHaveBeenCalledWith('project-portal/project-threads/5/assignee', { assignee_id: 5 });
      expect(component.selectedThread!.assignee_name).toBe('Petr');
      expect(component.threads.find(t => t.id === 5)!.assignee_id).toBe(5);
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/project-threads', jasmine.objectContaining({ assigned_to_me: '1' }));
      dh().put.and.returnValue(of({ id: 5, assignee_id: null, assignee_name: null }));
      component.assignThread('');
      expect(dh().put).toHaveBeenCalledWith('project-portal/project-threads/5/assignee', { assignee_id: null });
      ctx.permissions.granted = new Set();
      dh().put.calls.reset();
      component.assignThread('3');
      expect(dh().put).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description Sending an invitation to an existing account asks first, needs an e-mail and
     *   updates the row; the access chips describe how the account signs in.
     * @input  anna (e-mail) - confirm false, then true; klient (no e-mail); accounts with / without password
     * @output no request when declined or without e-mail; post('project-portal/projects/7/accounts/12/invite', {});
     *   invited_at set; success alert; chips 'account_no_password' + 'account_email_verified'
     */
    it('invites an account and describes its access', fakeAsync(async () => {
      init();
      const anna = component.accounts[1];
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.inviteAccount(anna);
      expect(dh().post).not.toHaveBeenCalled();
      await component.inviteAccount(component.accounts[0]);
      expect(ctx.confirm.open).toHaveBeenCalledTimes(1);

      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      dh().post.and.returnValue(of({ ...anna, invited_at: '2026-11-12 10:00:00' }));
      await component.inviteAccount(anna);
      expect(dh().post).toHaveBeenCalledWith('project-portal/projects/7/accounts/12/invite', {});
      expect(component.accounts[1].invited_at).toBe('2026-11-12 10:00:00');
      expect(component.invitingAccountId).toBeNull();
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.account_invite_sent', 'success');

      const chips = component.accountAccess({ ...anna, has_password: false, email_verified_at: '2026-11-12 10:00:00' });
      expect(chips).toContain('projects.account_no_password');
      expect(chips).toContain('projects.account_email_verified');
      expect(component.accountAccess({ ...anna, has_password: true })).toContain('projects.account_with_password');
      discardPeriodicTasks();
    }));

    /**
     * @description Progress applies a template (checkpoints with dates from the start) and saves
     *   the checkpoints as a new template; both need a choice / name and the update permission.
     * @input  apply template 1 from 2026-12-01 → 2 checkpoints, meta.added 2; save as 'Shop flow'
     * @output postWithMeta('project-portal/projects/7/apply-template', { template_id: 1, start_date: '2026-12-01' });
     *   checkpoints replaced, form closed; post('project-portal/projects/7/template', { name: 'Shop flow' });
     *   template added; nothing without a choice or name
     */
    it('applies a template and saves the checkpoints as a template', fakeAsync(() => {
      init();
      go('progress');
      component.openTemplateAction('apply');
      expect(component.templateAction).toBe('apply');
      component.applyTemplate();
      expect(dh().postWithMeta).not.toHaveBeenCalled();
      component.templateDraft.template_id = '1';
      component.templateDraft.start_date = '2026-12-01';
      dh().postWithMeta.and.returnValue(of({ data: [
        { id: 1, label: 'Design', status: 'new', sort_order: 1 }, { id: 9, label: 'Launch', status: 'new', sort_order: 2, due_date: '2026-12-15' },
      ], meta: { added: 1 } }));
      component.applyTemplate();
      expect(dh().postWithMeta).toHaveBeenCalledWith('project-portal/projects/7/apply-template', { template_id: 1, start_date: '2026-12-01' });
      expect(component.checkpoints.map(c => c.label)).toEqual(['Design', 'Launch']);
      expect(component.templateAction).toBeNull();

      component.openTemplateAction('save');
      expect(component.templateDraft.name).toBe('Shop');
      component.templateDraft.name = ' ';
      component.saveAsTemplate();
      expect(dh().post).not.toHaveBeenCalled();
      component.templateDraft.name = 'Shop flow';
      dh().post.and.returnValue(of({ id: 2, name: 'Shop flow', description: null, checkpoints: [{}, {}] }));
      component.saveAsTemplate();
      expect(dh().post).toHaveBeenCalledWith('project-portal/projects/7/template', { name: 'Shop flow' });
      expect(component.templates.map(t => t.name)).toEqual(['Web', 'Shop flow']);

      ctx.permissions.granted = new Set(['web-projects-view']);
      component.openTemplateAction('apply');
      expect(component.templateAction).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description Files of updates and approvals name their source and open their sub-page; a
     *   change in a child section reloads the counts and the files.
     * @input  file of update 'Week 1'; file of approval 'Homepage'; onChildChanged
     * @output 'projects.file_source_update: Week 1'; navigate to updates / approvals;
     *   get('project-portal/projects/7') + getCollection files again
     */
    it('labels the files of updates and approvals and refreshes after child changes', fakeAsync(() => {
      init();
      const base = { ...projectFiles()[1], author_type: 'customer' as const };
      const update = { ...base, source: 'update' as const, source_id: 4, source_title: 'Week 1', thread_id: null, thread_subject: null };
      const approval = { ...base, source: 'approval' as const, source_id: 2, source_title: 'Homepage', thread_id: null, thread_subject: null };
      expect(component.fileSourceLabel(update)).toBe('projects.file_source_update: Week 1');
      expect(component.fileSourceLabel(approval)).toBe('projects.file_source_approval: Homepage');
      expect(component.fileSourceLabel(base)).toBe('Hosting');
      component.openFileThread(update);
      expect(navigate).toHaveBeenCalledWith(['/admin/project-portal/projects', 7, 'updates']);
      component.openFileThread(approval);
      expect(navigate).toHaveBeenCalledWith(['/admin/project-portal/projects', 7, 'approvals']);

      dh().get.calls.reset();
      dh().getCollection.calls.reset();
      dh().get.and.returnValue(of({ ...project(), pending_approvals_count: 1, published_updates_count: 4 }));
      component.onChildChanged();
      expect(dh().get).toHaveBeenCalledWith('project-portal/projects/7');
      expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/files');
      expect(component.project!.pending_approvals_count).toBe(1);
      discardPeriodicTasks();
    }));
  });

  describe('rendering', () => {
    /**
     * @description The page renders the header (name, unread badge, assignee) and the tabs with
     *   their own address; each sub-page shows its part: the thread list with unread counts and
     *   "waiting on", the checkpoints, the accounts, the files and the settings with the save bar.
     * @input  project 7 with threads (2 + 1 unread); sub-pages overview → conversations → progress → access → files → settings
     * @output name 'Shop'; unread chip; 8 tabs linking to /admin/project-portal/projects/7/<section>, overview
     *   current, conversations badge 3; 2 activity items; 2 active threads, 1 with a count; 'Design';
     *   2 accounts; 2 file rows, 1 internal; 12 settings inputs and the save bar
     */
    it('renders the project page', fakeAsync(() => {
      init();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pd-title')!.textContent).toContain('Shop');
      expect(el.querySelector('.pd-chip--unread')).not.toBeNull();
      expect(el.querySelector('.pd-subtitle')!.textContent).toContain('Jana');
      const tabs = Array.from(el.querySelectorAll('.pd-tab')) as HTMLAnchorElement[];
      expect(tabs.length).toBe(8);
      expect(tabs[1].getAttribute('href')).toBe('/admin/project-portal/projects/7/conversations');
      expect(tabs[0].getAttribute('aria-current')).toBe('page');
      expect(tabs[1].querySelector('.pd-tab-badge')!.textContent).toContain('3');
      expect(el.querySelectorAll('.pd-activity-item').length).toBe(2);

      go('conversations');
      expect(el.querySelectorAll('.pd-thread').length).toBe(2);
      expect(el.querySelectorAll('.pd-thread .pd-count--unread').length).toBe(1);
      expect(el.querySelector('.pd-waiting[data-waiting="supplier"]')!.textContent).toContain('projects.thread_waiting_on_us');
      go('progress');
      expect(el.textContent).toContain('Design');
      go('access');
      expect(el.querySelectorAll('.pd-account').length).toBe(2);
      go('files');
      expect(el.querySelectorAll('.pd-files-row').length).toBe(2);
      expect(el.querySelectorAll('.pd-files-row--internal').length).toBe(1);
      go('settings');
      expect(el.querySelectorAll('.pd-form .pd-input').length).toBe(12);
      expect(el.querySelector('.pd-savebar')).not.toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description Without the update permission everything is read-only: no save bar, no reply,
     *   no account actions, inputs disabled.
     * @input  granted only web-projects-view; sub-pages settings, conversations (open thread), access
     * @output read-only note; no .pd-savebar / .pd-reply / .pd-account-actions; accounts listed; first input disabled
     */
    it('renders read-only without the update permission', fakeAsync(() => {
      ctx.permissions.granted = new Set(['web-projects-view']);
      init();
      go('settings');
      tick();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('projects.detail_readonly');
      expect(el.querySelector('.pd-savebar')).toBeNull();
      expect((el.querySelector('.pd-form .pd-input') as HTMLInputElement).disabled).toBeTrue();
      component.selectedThread = { ...threads()[0], messages: [] };
      go('conversations');
      expect(el.querySelector('.pd-reply')).toBeNull();
      go('access');
      expect(el.querySelector('.pd-account-actions')).toBeNull();
      expect(el.querySelectorAll('.pd-account').length).toBe(2);
      discardPeriodicTasks();
    }));

    /**
     * @description A wrong project shows the "not found" state with a link back.
     * @input  API fails
     * @output 'projects.detail_not_found'; link to /admin/project-portal/projects
     */
    it('renders the not found state', fakeAsync(() => {
      dh().get.and.returnValue(throwError(() => ({ status: 404 })));
      init();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('projects.detail_not_found');
      expect(el.querySelector('a[href="/admin/project-portal/projects"]')).not.toBeNull();
      discardPeriodicTasks();
    }));
  });
});
