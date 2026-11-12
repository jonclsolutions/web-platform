/**
 * @file project-portal.component.spec.ts
 * @path src/app/public/web-pages/project-portal/project-portal.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectPortalComponent (customer project portal): link token and
 *   the session of the HttpOnly cookie (the component never sees it - the API answers 200 / 401),
 *   password login / logout, project and thread loading, the 15 s polling of the
 *   thread list and of new messages, thread detail (older messages, status change, closing),
 *   replies and new threads incl. attachment validation and send errors (bugfix 2026-10-23),
 *   refresh, the lazily loaded contacts tab, derived labels and the language menu.
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
import { provideUploadRulesStub } from '../../../../testing/upload-rules-stub';

describe('ProjectPortalComponent', () => {
  let fixture: ComponentFixture<ProjectPortalComponent>;
  let portal: ProjectPortalComponent;
  let get: jasmine.Spy;
  let getWithMeta: jasmine.Spy;
  let post: jasmine.Spy;
  let getSiteSettings: jasmine.Spy;
  let replies: Record<string, () => Observable<any>>;
  let language$: BehaviorSubject<string>;
  let translations$: BehaviorSubject<any>;

  /** localStorage key of the session token of the former portal versions (removed on load). */
  const LEGACY_SESSION = 'project_session_tok';
  /** Whether the browser holds a valid session cookie - decides the answer of GET /tok. */
  let cookie = false;
  const project = {
    id: 1, name: 'Web', description: 'Desc', platform: null, project_lead: null, contact_phone: null, contact_email: null, technologies: null,
    estimated_completion_from: null, estimated_completion_to: null,
    checkpoints: [{ id: 1, label: 'A', status: 'done', description: 'Design of all pages' }, { id: 2, label: 'B', status: 'active' }, { id: 3, label: 'C', status: 'new' }]
  };
  const threads = () => [
    { id: 1, subject: 'Design', priority: 'medium', status: 'active', last_message_at: null, unread_count: 2, messages: [{ id: 1, body: 'logo colours', author_type: 'admin', author_label: null, created_at: '' }] },
    { id: 2, subject: 'Hosting', priority: 'low', status: 'active', last_message_at: null, unread_count: 1 }
  ];
  const detail = (id = 1) => ({ ...threads()[0], id, messages: [{ id: 10, body: 'Hi', author_type: 'customer', author_label: null, created_at: '' }] });
  const file = (name: string, size = 10) => { const f = new File(['x'], name); Object.defineProperty(f, 'size', { value: size }); return f; };
  const files = (...list: File[]) => ({ target: { files: list, value: 'x' } } as any);

  /** URL → reply routing for GET / POST: the path (query removed) ending with the longest key wins; unknown → {}. */
  const route = (url: string) => {
    const path = url.split('?')[0];
    const key = Object.keys(replies).filter(k => path.endsWith(k)).sort((a, b) => b.length - a.length)[0];
    return key ? replies[key]() : of({});
  };
  /** Creates the portal for the token (null = none), with or without a valid session cookie. */
  function create(token: string | null = 'tok', session = false): void {
    cookie = session;
    TestBed.configureTestingModule({
      imports: [ProjectPortalComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}) } } },
        { provide: PublicDataService, useValue: { get, getWithMeta, post, getSiteSettings } },
        provideUploadRulesStub(),
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

  /** Logged-in portal (valid session cookie). */
  const loggedIn = () => create('tok', true);

  beforeEach(() => {
    localStorage.removeItem(LEGACY_SESSION);
    replies = {
      '/tok': () => cookie ? of(project) : throwError(() => ({ status: 401 })),
      '/tok/threads': () => of(threads()),
      // Envelopes of the getWithMeta() endpoints - extra information in `meta` (finding #6).
      '/threads/1': () => of({ data: detail(1), meta: { has_more_older_messages: true } }),
      '/threads/2': () => of({ data: detail(2), meta: { has_more_older_messages: true } }),
      '/new-messages': () => of({ data: [], meta: { status: 'active' } })
    };
    get = jasmine.createSpy('get').and.callFake(route);
    getWithMeta = jasmine.createSpy('getWithMeta').and.callFake(route);
    post = jasmine.createSpy('post').and.callFake(route);
    getSiteSettings = jasmine.createSpy('getSiteSettings').and.returnValue(of({ settings: { company_name: 'RPSW' } }));
    language$ = new BehaviorSubject('cz');
    translations$ = new BehaviorSubject<any>({});
  });
  afterEach(() => {
    fixture?.destroy();
    localStorage.removeItem(LEGACY_SESSION);
  });

  /**
   * @description No token → invalid; token without a session cookie → the API answers 401 →
   *   login form; a session token a former version kept in localStorage is deleted; status labels set.
   * @input token null; token 'tok' with a legacy localStorage session and no cookie.
   * @output 'invalid' (no request); GET of the project (no header), 'login', legacy key removed;
   *   checkpointStatusLabels from the texts.
   */
  it('starts invalid without a token and with the login otherwise', () => {
    create(null);
    expect(portal.state).toBe('invalid');
    expect(get).not.toHaveBeenCalled();
    fixture.destroy();

    TestBed.resetTestingModule();
    localStorage.setItem(LEGACY_SESSION, 'old');
    create();
    expect(get).toHaveBeenCalledOnceWith('projects/public/tok');
    expect(localStorage.getItem(LEGACY_SESSION)).toBeNull();
    expect(portal.state).toBe('login');
    expect(portal.checkpointStatusLabels).toEqual({ new: 'checkpoint_status_new', active: 'checkpoint_status_active', done: 'checkpoint_status_done' });
  });

  /**
   * @description Login: empty password ignored; success (the API sets the session cookie) opens
   *   the portal with threads - nothing is stored by the component; 404 → project not found;
   *   other errors → invalid password.
   * @input '' ; 'pw' → {project}; 404; 401.
   * @output No post; 'portal', threads 2, requests without headers, localStorage untouched;
   *   'error_project_not_found'; 'error_invalid_password'.
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

    replies['/tok/login'] = () => { cookie = true; return of({ project }); };
    const storedBefore = localStorage.length;
    portal.login();
    expect(post).toHaveBeenCalledWith('projects/public/tok/login', { password: 'pw' });
    expect(get).toHaveBeenCalledWith('projects/public/tok/threads');
    expect(get.calls.allArgs().every((a: any[]) => a.length === 1)).toBeTrue();
    expect(localStorage.length).toBe(storedBefore);
    expect(portal.state).toBe('portal');
    expect(portal.threads.length).toBe(2);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description After a reload the portal asks the API: a valid cookie → project loaded; an
   *   expired session (401) → login.
   * @input Valid cookie; then the project request failing.
   * @output GET of the project without header, 'portal'; 'login'.
   */
  it('restores or drops the session of the cookie', fakeAsync(() => {
    loggedIn();
    expect(get).toHaveBeenCalledWith('projects/public/tok');
    expect(portal.state).toBe('portal');
    fixture.destroy();
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    replies['/tok'] = () => throwError(() => ({ status: 401 }));
    loggedIn();
    expect(portal.state).toBe('login');
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
    expect(getWithMeta).toHaveBeenCalledWith(jasmine.stringMatching('/threads/1/new-messages\\?after_id=10$'));

    replies['/new-messages'] = () => of({ data: [{ id: 11, body: 'New', author_type: 'admin', author_label: 'PM', created_at: '' }], meta: { status: 'closed' } });
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
    replies['/messages'] = () => of({ data: [{ id: 5, body: 'Old', author_type: 'admin', author_label: null, created_at: '' }], meta: { has_more_older_messages: false } });
    portal.loadOlderMessages();
    tick();
    expect(getWithMeta).toHaveBeenCalledWith(jasmine.stringMatching('/threads/1/messages\\?before_message_id=10$'));
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
   * @description Status change: same status or no thread ignored; success updates detail +
   *   list; 404 (thread gone) closes it and reloads the list; other errors keep it.
   * @input updateThreadStatus('closed') without a thread; 'active' (same); 'closed' ok; 500; 404
   *   with a failing list reload.
   * @output No post; status closed in detail and list; thread kept; thread closed, list kept.
   */
  it('changes the thread status', fakeAsync(() => {
    loggedIn();
    portal.updateThreadStatus('closed');
    expect(post).not.toHaveBeenCalled();
    portal.openThread(portal.threads[0]);
    tick();
    portal.updateThreadStatus('active');
    expect(post).not.toHaveBeenCalled();

    replies['/status'] = () => of({ status: 'closed' });
    portal.updateThreadStatus('closed');
    expect(post).toHaveBeenCalledWith('projects/public/tok/threads/1/status', { status: 'closed' });
    expect(portal.selectedThread!.status).toBe('closed');
    expect(portal.threads[0].status).toBe('closed');

    replies['/status'] = () => throwError(() => ({ status: 500 }));
    portal.updateThreadStatus('active');
    expect(portal.selectedThread).not.toBeNull();
    replies['/status'] = () => throwError(() => ({ status: 404 }));
    replies['/tok/threads'] = () => throwError(() => ({ status: 500 }));
    portal.updateThreadStatus('active');
    expect(portal.selectedThread).toBeNull();
    expect(portal.threads.length).toBe(2);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Attachments: max 5, allowed extensions, 15 MB limit - first error shown,
   *   valid files kept; removal clears the error; empty selection ignored.
   * @input 1 exe + 1 pdf; 16 MB png; 6 files; remove; empty input.
   * @output exe refused (type error with the allowed types), pdf kept; size error; too-many error and 5 files; error cleared.
   */
  it('validates attachments', fakeAsync(() => {
    loggedIn();
    portal.onReplyFilesSelected(files(file('virus.exe'), file('brief.pdf')));
    expect(portal.replyFileError).toBe('attachment_error_type attachment_allowed_types');
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
   * @description The limits and types come from the rules of the API (project_thread): the
   *   pickers offer every file and no type list is shown up front; svg / xml files and a name
   *   without extension are refused when chosen and only that error lists the allowed types.
   *   Without the rules the fallback limits (5 files, 15 MB) apply and the type is left to the API.
   * @input pickers / limits; reply logo.svg + feed.xml; new thread README; attachmentRules null + tool.exe.
   * @output no accept, no type list; type error + 'attachment_allowed_types', nothing kept;
   *   '' types text, 5 / 15, tool.exe kept.
   */
  it('takes the attachment rules from the API', fakeAsync(() => {
    loggedIn();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="file"][accept]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('attachment_allowed_types');
    expect(portal.attachmentTypesText).toBe('attachment_allowed_types');
    expect([portal.maxAttachments, portal.maxAttachmentSizeMb]).toEqual([5, 15]);
    portal.onReplyFilesSelected(files(file('logo.svg'), file('feed.xml')));
    expect(portal.replyFileError).toBe('attachment_error_type attachment_allowed_types');
    expect(portal.replyFiles).toEqual([]);
    portal.onNewThreadFilesSelected(files(file('README')));
    expect(portal.newThreadFileError).toBe('attachment_error_type attachment_allowed_types');
    expect(portal.newThreadFiles).toEqual([]);

    portal.attachmentRules = null;
    expect(portal.attachmentTypesText).toBe('');
    expect([portal.maxAttachments, portal.maxAttachmentSizeMb]).toEqual([5, 15]);
    portal.onReplyFilesSelected(files(file('tool.exe')));
    expect(portal.replyFiles.map(f => f.name)).toEqual(['tool.exe']);
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
    expect(post).toHaveBeenCalledWith('projects/public/tok/threads/1/messages', { body: 'Thanks' });
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
    expect(post).toHaveBeenCalledWith('projects/public/tok/threads', { subject: 'Bug', priority: 'medium', body: 'Broken' });
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
    expect(get).toHaveBeenCalledWith('projects/public/tok');
    expect(getWithMeta).toHaveBeenCalledWith('projects/public/tok/threads/1');
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
   * @output post …/logout (the API deletes the cookie); state login, data reset.
   */
  it('logs out', fakeAsync(() => {
    loggedIn();
    portal.setActiveTab('checkpoints');
    portal.logout();
    expect(post).toHaveBeenCalledWith('projects/public/tok/logout', {});
    expect([portal.state, portal.project, portal.threads.length, portal.activeTab]).toEqual(['login', null, 0, 'description']);

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
   * @description The language switcher sits once in the top-right corner of the page (not inside
   *   the login card or the sidebar): flag + chevron, the menu opens on click with all languages.
   * @input Login screen; click on the switcher; then the logged-in portal.
   * @output One .pp-lang-switcher outside the card, aria-expanded true and one item per language;
   *   in the portal one switcher and none in the sidebar.
   */
  it('shows one language switcher in the top-right corner', fakeAsync(() => {
    create();
    fixture.detectChanges();
    let el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-lang-switcher').length).toBe(1);
    expect(el.querySelector('.pp-login-card .pp-lang-btn')).toBeNull();
    const btn = el.querySelector('.pp-lang-switcher .pp-lang-btn') as HTMLButtonElement;
    expect(btn.querySelector('.pp-lang-chevron')).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('.pp-lang-menu-item').length).toBe(PROJECT_PORTAL_AVAILABLE_LANGUAGES.length);
    fixture.destroy();

    TestBed.resetTestingModule();
    loggedIn();
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-lang-switcher').length).toBe(1);
    expect(el.querySelector('.pp-sidebar .pp-lang-btn')).toBeNull();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description A checkpoint with a description is a button that expands it (aria-expanded);
   *   one without stays plain; logout collapses everything.
   * @input Logged-in portal, tab checkpoints; click on checkpoint A (with description) twice; logout.
   * @output 1 toggle button; description 'Design of all pages' shown after the first click and
   *   hidden after the second; expanded set empty after logout.
   */
  it('expands the description of a checkpoint', fakeAsync(() => {
    loggedIn();
    portal.setActiveTab('checkpoints');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggles = el.querySelectorAll<HTMLButtonElement>('.pp-checkpoint-toggle');
    expect(toggles.length).toBe(1);
    expect(el.querySelectorAll('.pp-checkpoint-item').length).toBe(3);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    toggles[0].click();
    fixture.detectChanges();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#pp-cp-desc-1')!.textContent).toContain('Design of all pages');
    toggles[0].click();
    fixture.detectChanges();
    expect(el.querySelector('#pp-cp-desc-1')).toBeNull();
    portal.toggleCheckpoint(1);
    portal.logout();
    expect(portal.expandedCheckpointIds.size).toBe(0);
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
