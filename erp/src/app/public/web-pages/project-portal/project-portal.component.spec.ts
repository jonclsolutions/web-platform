/**
 * @file project-portal.component.spec.ts
 * @path src/app/public/web-pages/project-portal/project-portal.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ProjectPortalComponent (customer project portal): link token and
 *   stored session, password login / logout, project and thread loading, the 15 s polling of the
 *   thread list and of new messages, thread detail (older messages, status change, closing),
 *   replies and new threads incl. attachment validation and send errors (bugfix 2026-10-23),
 *   refresh, the lazily loaded contacts tab, derived labels and the language menu.
 * @refactor-note (2026-10-23) The old spec had no ActivatedRoute (NG0201) - rewritten. The session
 *   is expected in the `Authorization` header, never in the URL (open finding #1).
 * @dependencies
 * - PublicDataService stub routing GET / POST by URL; ProjectPortalLocalizationService stub
 *   (texts = keys); ActivatedRoute with the token; fakeAsync for timers.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { ProjectPortalComponent } from './project-portal.component';
import { ProjectPortalLocalizationService, PROJECT_PORTAL_AVAILABLE_LANGUAGES } from './project-portal-localization.service';
import { PublicDataService } from '../../../shared/services/public-data.service';

describe('ProjectPortalComponent', () => {
  let fixture: ComponentFixture<ProjectPortalComponent>;
  let portal: ProjectPortalComponent;
  let get: jasmine.Spy;
  let post: jasmine.Spy;
  let getSiteSettings: jasmine.Spy;
  let replies: Record<string, () => Observable<any>>;
  let language$: BehaviorSubject<string>;
  let translations$: BehaviorSubject<any>;

  const SESSION = 'project_session_tok';
  const project = {
    id: 1, name: 'Web', description: 'Desc', platform: null, project_lead: null, contact_phone: null, contact_email: null, technologies: null,
    estimated_completion_from: null, estimated_completion_to: null,
    checkpoints: [{ id: 1, label: 'A', status: 'done' }, { id: 2, label: 'B', status: 'active' }, { id: 3, label: 'C', status: 'new' }]
  };
  const threads = () => [
    { id: 1, subject: 'Design', priority: 'medium', status: 'active', last_message_at: null, unread_count: 2, messages: [{ id: 1, body: 'logo colours', author_type: 'admin', author_label: null, created_at: '' }] },
    { id: 2, subject: 'Hosting', priority: 'low', status: 'active', last_message_at: null, unread_count: 1 }
  ];
  const detail = (id = 1) => ({ ...threads()[0], id, has_more_older_messages: true, messages: [{ id: 10, body: 'Hi', author_type: 'customer', author_label: null, created_at: '' }] });
  const file = (name: string, size = 10) => { const f = new File(['x'], name); Object.defineProperty(f, 'size', { value: size }); return f; };
  const files = (...list: File[]) => ({ target: { files: list, value: 'x' } } as any);

  /** URL → reply routing for GET / POST: the path (query removed) ending with the longest key wins; unknown → {}. */
  const route = (url: string) => {
    const path = url.split('?')[0];
    const key = Object.keys(replies).filter(k => path.endsWith(k)).sort((a, b) => b.length - a.length)[0];
    return key ? replies[key]() : of({});
  };
  /** The portal session header (never in the URL - finding #1). */
  const AUTH = { Authorization: 'Bearer sess' };

  /** Creates the portal for the token (null = none) with an optional stored session. */
  function create(token: string | null = 'tok', session: string | null = null): void {
    if (session) localStorage.setItem(SESSION, session);
    TestBed.configureTestingModule({
      imports: [ProjectPortalComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}) } } },
        { provide: PublicDataService, useValue: { get, post, getSiteSettings } },
        { provide: ProjectPortalLocalizationService, useValue: {
          translations$, currentLanguage$: language$, availableLanguages: PROJECT_PORTAL_AVAILABLE_LANGUAGES,
          getValue: (k: string) => k, getCurrentLanguage: () => language$.value, setLanguage: jasmine.createSpy('setLanguage')
        } }
      ]
    });
    fixture = TestBed.createComponent(ProjectPortalComponent);
    portal = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Logged-in portal (stored session). */
  const loggedIn = () => create('tok', 'sess');

  beforeEach(() => {
    localStorage.removeItem(SESSION);
    replies = {
      '/tok': () => of(project),
      '/tok/threads': () => of(threads()),
      '/threads/1': () => of(detail(1)),
      '/threads/2': () => of(detail(2)),
      '/new-messages': () => of({ data: [], status: 'active' })
    };
    get = jasmine.createSpy('get').and.callFake(route);
    post = jasmine.createSpy('post').and.callFake(route);
    getSiteSettings = jasmine.createSpy('getSiteSettings').and.returnValue(of({ settings: { company_name: 'RPSW' } }));
    language$ = new BehaviorSubject('cz');
    translations$ = new BehaviorSubject<any>({});
  });
  afterEach(() => {
    fixture?.destroy();
    localStorage.removeItem(SESSION);
  });

  /**
   * @description No token → invalid; token without session → login form; status labels set.
   * @input token null; token 'tok'.
   * @output 'invalid' (no request); 'login'; checkpointStatusLabels from the texts.
   */
  it('starts invalid without a token and with the login otherwise', () => {
    create(null);
    expect(portal.state).toBe('invalid');
    expect(get).not.toHaveBeenCalled();
    fixture.destroy();

    TestBed.resetTestingModule();
    create();
    expect(portal.state).toBe('login');
    expect(portal.checkpointStatusLabels).toEqual({ new: 'checkpoint_status_new', active: 'checkpoint_status_active', done: 'checkpoint_status_done' });
  });

  /**
   * @description Login: empty password ignored; success stores the session and opens the
   *   portal with threads; 404 → project not found; other errors → invalid password.
   * @input '' ; 'pw' → {session_token 's1', project}; 404; 401.
   * @output No post; localStorage s1, 'portal', threads 2; 'error_project_not_found'; 'error_invalid_password'.
   */
  it('logs in with the project password', fakeAsync(() => {
    create();
    portal.login();
    expect(post).not.toHaveBeenCalled();

    replies['/tok/login'] = () => throwError(() => ({ status: 404 }));
    portal.loginPassword = 'pw';
    portal.login();
    expect(portal.loginError).toBe('error_project_not_found');
    replies['/tok/login'] = () => throwError(() => ({ status: 401 }));
    portal.login();
    expect(portal.loginError).toBe('error_invalid_password');
    expect(portal.loginLoading).toBeFalse();

    replies['/tok/login'] = () => of({ session_token: 's1', project });
    portal.login();
    expect(post).toHaveBeenCalledWith('projects/public/tok/login', { password: 'pw' }, undefined);
    expect(get).toHaveBeenCalledWith('projects/public/tok/threads', undefined, { Authorization: 'Bearer s1' });
    expect(get.calls.allArgs().every((a: any[]) => !String(a[0]).includes('session_token'))).toBeTrue();
    expect(localStorage.getItem(SESSION)).toBe('s1');
    expect(portal.state).toBe('portal');
    expect(portal.threads.length).toBe(2);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Stored session: project loaded; an expired session is cleared → login.
   * @input Session 'sess' with project ok; then project request failing.
   * @output 'portal' + session in the URL; 'login' + storage cleared.
   */
  it('restores or drops a stored session', fakeAsync(() => {
    loggedIn();
    expect(get).toHaveBeenCalledWith('projects/public/tok', undefined, AUTH);
    expect(portal.state).toBe('portal');
    fixture.destroy();
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    replies['/tok'] = () => throwError(() => ({ status: 401 }));
    loggedIn();
    expect(portal.state).toBe('login');
    expect(localStorage.getItem(SESSION)).toBeNull();
  }));

  /**
   * @description Thread list polling every 15 s; the unread badge of the open thread stays 0;
   *   polling errors are silent.
   * @input Thread 1 open; tick 15 s with unread 5 for thread 1; failing poll.
   * @output threads replaced, thread 1 unread 0; still portal after an error.
   */
  it('polls the thread list', fakeAsync(() => {
    loggedIn();
    portal.openThread(portal.threads[0]);
    replies['/tok/threads'] = () => of([{ ...threads()[0], unread_count: 5 }, threads()[1]]);
    tick(15000);
    expect(portal.threads[0].unread_count).toBe(0);
    expect(portal.totalUnreadCount).toBe(1);

    replies['/tok/threads'] = () => throwError(() => new Error('x'));
    tick(15000);
    expect(portal.state).toBe('portal');
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Opening a thread loads the detail, clears its unread badge and polls new
   *   messages immediately and every 15 s (appended with the new status; empty answers ignored;
   *   errors logged); failure of the detail just stops the spinner.
   * @input openThread(1); new message 11 + status 'closed'; empty; error; detail of thread 2 failing.
   * @output detail shown, unread 0; messages [10, 11], status closed; console.error; loading false.
   */
  it('opens a thread and polls its new messages', fakeAsync(() => {
    loggedIn();
    portal.openThread(portal.threads[0]);
    tick();
    expect(portal.selectedThread!.messages!.map(m => m.id)).toEqual([10]);
    expect(portal.threads[0].unread_count).toBe(0);
    expect(portal.threadDetailLoading).toBeFalse();
    expect(get).toHaveBeenCalledWith(jasmine.stringMatching('/threads/1/new-messages\\?after_id=10$'), undefined, AUTH);

    replies['/new-messages'] = () => of({ data: [{ id: 11, body: 'New', author_type: 'admin', author_label: 'PM', created_at: '' }], status: 'closed' });
    tick(15000);
    expect(portal.selectedThread!.messages!.map(m => m.id)).toEqual([10, 11]);
    expect(portal.selectedThread!.status).toBe('closed');

    spyOn(console, 'error');
    replies['/new-messages'] = () => throwError(() => new Error('x'));
    tick(15000);
    expect(console.error).toHaveBeenCalled();

    replies['/threads/2'] = () => throwError(() => new Error('x'));
    portal.openThread(portal.threads[1]);
    expect(portal.threadDetailLoading).toBeFalse();
    portal.closeThread();
    expect(portal.selectedThread).toBeNull();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Older messages are prepended (only when more exist, not twice in parallel).
   * @input Thread with has_more; reply [{id 5}] + has_more false; second call.
   * @output messages [5, 10]; has_more false; second call makes no request.
   */
  it('loads older messages', fakeAsync(() => {
    loggedIn();
    portal.loadOlderMessages();
    portal.openThread(portal.threads[0]);
    tick();
    replies['/messages'] = () => of({ data: [{ id: 5, body: 'Old', author_type: 'admin', author_label: null, created_at: '' }], has_more_older_messages: false });
    portal.loadOlderMessages();
    tick();
    expect(get).toHaveBeenCalledWith(jasmine.stringMatching('/threads/1/messages\\?before_message_id=10$'), undefined, AUTH);
    expect(portal.selectedThread!.messages!.map(m => m.id)).toEqual([5, 10]);
    const calls = get.calls.count();
    portal.loadOlderMessages();
    expect(get.calls.count()).toBe(calls);

    portal.selectedThread!.has_more_older_messages = true;
    portal.selectedThread!.messages = [];
    portal.loadOlderMessages();
    expect(get.calls.count()).toBe(calls);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Status change / closing: same status or no thread ignored; success updates
   *   detail + list; 404 (thread gone) closes it and reloads the list; other errors keep it.
   * @input updateThreadStatus('active'); 'closed' ok; 404; closeThreadAsCustomer ok; 404; 500.
   * @output No post; status closed in list; closed + reloaded; …
   */
  it('changes and closes threads', fakeAsync(() => {
    loggedIn();
    portal.updateThreadStatus('closed');
    portal.closeThreadAsCustomer();
    expect(post).not.toHaveBeenCalled();
    portal.openThread(portal.threads[0]);
    tick();
    portal.updateThreadStatus('active');
    expect(post).not.toHaveBeenCalled();

    replies['/status'] = () => of({ status: 'closed' });
    portal.updateThreadStatus('closed');
    expect(post).toHaveBeenCalledWith('projects/public/tok/threads/1/status', { status: 'closed' }, AUTH);
    expect(portal.selectedThread!.status).toBe('closed');
    expect(portal.threads[0].status).toBe('closed');

    replies['/status'] = () => throwError(() => ({ status: 500 }));
    portal.updateThreadStatus('active');
    expect(portal.selectedThread).not.toBeNull();
    replies['/status'] = () => throwError(() => ({ status: 404 }));
    portal.updateThreadStatus('active');
    expect(portal.selectedThread).toBeNull();

    portal.openThread(portal.threads[0]);
    tick();
    replies['/close'] = () => of({ status: 'closed' });
    portal.closeThreadAsCustomer();
    expect(portal.threads[0].status).toBe('closed');
    replies['/close'] = () => throwError(() => ({ status: 500 }));
    portal.closeThreadAsCustomer();
    expect(portal.selectedThread).not.toBeNull();
    replies['/close'] = () => throwError(() => ({ status: 404 }));
    portal.closeThreadAsCustomer();
    expect(portal.selectedThread).toBeNull();
    expect(portal.closingThread).toBeFalse();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Attachments: max 5, allowed extensions, 15 MB limit - first error shown,
   *   valid files kept; removal clears the error; empty selection ignored.
   * @input 1 exe + 1 pdf; 16 MB png; 6 files; remove; empty input.
   * @output exe refused (type error), pdf kept; size error; too-many error and 5 files; error cleared.
   */
  it('validates attachments', fakeAsync(() => {
    loggedIn();
    portal.onReplyFilesSelected(files(file('virus.exe'), file('brief.pdf')));
    expect(portal.replyFileError).toBe('attachment_error_type');
    expect(portal.replyFiles.map(f => f.name)).toEqual(['brief.pdf']);
    portal.onReplyFilesSelected(files(file('big.png', 16 * 1024 * 1024)));
    expect(portal.replyFileError).toBe('attachment_error_size');
    portal.onReplyFilesSelected(files(...['1', '2', '3', '4', '5'].map(n => file(`${n}.jpg`))));
    expect(portal.replyFileError).toBe('attachment_error_too_many');
    expect(portal.replyFiles.length).toBe(5);
    portal.removeReplyFile(0);
    expect(portal.replyFileError).toBeNull();
    expect(portal.replyFiles.length).toBe(4);
    portal.onReplyFilesSelected(files());

    portal.onNewThreadFilesSelected(files(file('a.zip')));
    portal.onNewThreadFilesSelected({ target: { files: null } } as any);
    expect(portal.newThreadFiles.map(f => f.name)).toEqual(['a.zip']);
    portal.removeNewThreadFile(0);
    expect(portal.newThreadFiles).toEqual([]);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Reply: empty / no thread ignored; JSON body without files, FormData with
   *   files; success clears and reloads; failure shows `error_send_failed` (bugfix 2026-10-23).
   * @input Reply '  ' ; 'Thanks' ok; 'With file' + pdf ok; 'Fail' → 500.
   * @output No post; {body: 'Thanks'}; FormData body + attachments[]; replySendError 'error_send_failed'.
   */
  it('sends replies and reports a failed send', fakeAsync(() => {
    loggedIn();
    portal.replyBody = 'x';
    portal.sendReply();
    portal.openThread(portal.threads[0]);
    tick();
    portal.replyBody = '  ';
    portal.sendReply();
    expect(post).not.toHaveBeenCalled();

    portal.replyBody = ' Thanks ';
    portal.sendReply();
    expect(post).toHaveBeenCalledWith('projects/public/tok/threads/1/messages', { body: 'Thanks' }, AUTH);
    expect(portal.replyBody).toBe('');

    portal.replyBody = 'With file';
    portal.onReplyFilesSelected(files(file('brief.pdf')));
    portal.sendReply();
    const fd = post.calls.mostRecent().args[1] as FormData;
    expect(fd.get('body')).toBe('With file');
    expect((fd.get('attachments[]') as File).name).toBe('brief.pdf');
    tick();

    replies['/messages'] = () => throwError(() => ({ status: 500 }));
    portal.replyBody = 'Fail';
    portal.sendReply();
    expect(portal.replySendError).toBe('error_send_failed');
    expect(portal.replyBody).toBe('Fail');
    expect(portal.replySending).toBeFalse();
    portal.setActiveTab('threads');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pp-send-error')?.textContent.trim()).toBe('error_send_failed');
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description New thread: form reset on open, cancel; subject + body required; JSON or
   *   FormData; success closes the form; failure keeps it with `error_send_failed`.
   * @input open; submit empty; subject + body ok; with file; failing.
   * @output defaults; no post; {subject, priority medium, body}; FormData; newThreadSendError.
   */
  it('creates new threads and reports a failed send', fakeAsync(() => {
    loggedIn();
    portal.openNewThreadForm();
    expect([portal.newThreadMode, portal.newThreadPriority, portal.newThreadSubject]).toEqual([true, 'medium', '']);
    portal.submitNewThread();
    expect(post).not.toHaveBeenCalled();
    portal.cancelNewThread();
    expect(portal.newThreadMode).toBeFalse();

    portal.openNewThreadForm();
    portal.newThreadSubject = 'Bug';
    portal.newThreadBody = 'Broken';
    portal.submitNewThread();
    expect(post).toHaveBeenCalledWith('projects/public/tok/threads', { subject: 'Bug', priority: 'medium', body: 'Broken' }, AUTH);
    expect(portal.newThreadMode).toBeFalse();

    portal.openNewThreadForm();
    portal.newThreadSubject = 'Files';
    portal.newThreadBody = 'See';
    portal.onNewThreadFilesSelected(files(file('a.png')));
    replies['/tok/threads'] = () => throwError(() => ({ status: 500 }));
    portal.submitNewThread();
    expect(post.calls.mostRecent().args[1] instanceof FormData).toBeTrue();
    expect(portal.newThreadSendError).toBe('error_send_failed');
    expect(portal.newThreadMode).toBeTrue();
    expect(portal.newThreadSending).toBeFalse();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Refresh reloads the project + threads and re-opens the open thread; a failing
   *   refresh logs out; no session → nothing.
   * @input Thread open + refresh ok; refresh failing.
   * @output project reloaded, thread detail requested again; 'login'.
   */
  it('refreshes the portal data', fakeAsync(() => {
    loggedIn();
    portal.openThread(portal.threads[0]);
    tick();
    get.calls.reset();
    portal.refresh();
    expect(get).toHaveBeenCalledWith('projects/public/tok', undefined, AUTH);
    expect(get).toHaveBeenCalledWith('projects/public/tok/threads/1', undefined, AUTH);
    expect(portal.isRefreshing).toBeFalse();
    portal.closeThread();
    portal.refresh();

    replies['/tok'] = () => throwError(() => ({ status: 401 }));
    portal.refresh();
    expect(portal.state).toBe('login');
    get.calls.reset();
    portal.refresh();
    expect(get).not.toHaveBeenCalled();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Logout ends the session on the server (also when that fails) and resets the
   *   portal; without a session it just shows the login.
   * @input logout() ok; login again + logout failing; logout without session.
   * @output post …/logout with the Bearer header; state login, storage cleared, data reset.
   */
  it('logs out', fakeAsync(() => {
    loggedIn();
    portal.setActiveTab('checkpoints');
    portal.logout();
    expect(post).toHaveBeenCalledWith('projects/public/tok/logout', {}, AUTH);
    expect([portal.state, portal.project, portal.threads.length, portal.activeTab]).toEqual(['login', null, 0, 'description']);
    expect(localStorage.getItem(SESSION)).toBeNull();

    portal.logout();
    expect(portal.state).toBe('login');
    fixture.destroy();
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    replies['/logout'] = () => throwError(() => new Error('x'));
    loggedIn();
    portal.logout();
    expect(portal.state).toBe('login');
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Contacts tab loads the company settings once (null on error); other tabs only switch.
   * @input setActiveTab('contacts') ×2; new portal with failing settings.
   * @output getSiteSettings once, companySettings {RPSW}; null on error.
   */
  it('loads the contacts tab lazily', fakeAsync(() => {
    loggedIn();
    portal.setActiveTab('contacts');
    portal.setActiveTab('contacts');
    expect(getSiteSettings).toHaveBeenCalledTimes(1);
    expect(portal.companySettings).toEqual({ company_name: 'RPSW' });
    portal.setActiveTab('help');
    expect(portal.activeTab).toBe('help');
    fixture.destroy();
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    getSiteSettings.and.returnValue(throwError(() => new Error('x')));
    loggedIn();
    portal.setActiveTab('contacts');
    expect(portal.companySettings).toBeNull();
    expect(portal.companySettingsLoading).toBeFalse();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Derived values: checkpoint progress, completion estimate per language,
   *   thread search (subject or message body), file sizes, language menu.
   * @input 1 of 3 done; dates; search 'hosting' / 'colours' / 'xyz'; sizes; menu actions.
   * @output {1, 3, 33}; formatted ranges; matching threads; '1 KB' / '2.0 MB' / ''; language set.
   */
  it('computes the derived labels', fakeAsync(() => {
    loggedIn();
    expect(portal.checkpointProgress).toEqual({ done: 1, total: 3, percent: 33 });
    expect(portal.estimatedCompletionLabel).toBeNull();
    portal.project!.estimated_completion_from = '2026-03-01';
    expect(portal.estimatedCompletionLabel).toBe(new Date('2026-03-01T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }));
    portal.project!.estimated_completion_to = '2026-04-01';
    language$.next('en');
    expect(portal.estimatedCompletionLabel).toContain('–');
    expect(portal.estimatedCompletionLabel).toContain('March');
    portal.project = null;
    expect(portal.checkpointProgress).toEqual({ done: 0, total: 0, percent: 0 });

    portal.threadSearch = ' hosting ';
    expect(portal.filteredThreads.map(t => t.id)).toEqual([2]);
    portal.threadSearch = 'colours';
    expect(portal.filteredThreads.map(t => t.id)).toEqual([1]);
    portal.threadSearch = 'xyz';
    expect(portal.filteredThreads).toEqual([]);
    portal.threadSearch = '';
    expect(portal.filteredThreads.length).toBe(2);

    expect(portal.formatFileSize(1024)).toBe('1 KB');
    expect(portal.formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(portal.formatFileSize(undefined as any)).toBe('');

    portal.toggleLangMenu();
    expect(portal.isLangMenuOpen).toBeTrue();
    portal.closeLangMenu();
    portal.toggleLangMenu();
    portal.selectLanguage('cz');
    expect(TestBed.inject(ProjectPortalLocalizationService).setLanguage).toHaveBeenCalledWith('cz');
    expect(portal.isLangMenuOpen).toBeFalse();
    expect(portal.currentLanguageMeta!.code).toBe('en');
    fixture.destroy();
    discardPeriodicTasks();
    flush();
  }));
});
