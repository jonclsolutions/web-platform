/**
 * @file project-portal.component.spec.ts
 * @path src/app/apps/project-portal/public/project-portal.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectPortalComponent (customer project portal): link token and
 *   the session of the HttpOnly cookie (the component never sees it - the API answers 200 / 401),
 *   login with login name + password / logout, project and thread loading, the 15 s polling of
 *   the thread list and of new messages, thread detail (older messages, status change, closing),
 *   replies and new threads incl. attachment validation and send errors (bugfix 2026-10-23),
 *   refresh, the admin-like layout (menu button collapsing / sliding in the menu, remembered in
 *   localStorage), the sections (overview, files, lazily loaded contacts, my account with the
 *   client's own e-mail notifications), message authors, sign-in by an e-mailed code and by the
 *   one-time link of an e-mail, "what is new", approvals (approve / request changes), updates,
 *   the sources of files,
 *   "waiting on you", derived labels and the language menu.
 * @dependencies
 * - PublicDataService stub routing GET / POST by URL; ProjectPortalLocalizationService stub
 *   (texts = keys); ActivatedRoute with the token; fakeAsync for timers.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { ProjectPortalComponent } from './project-portal.component';
import { ProjectPortalLocalizationService, PROJECT_PORTAL_AVAILABLE_LANGUAGES } from './project-portal-localization.service';
import { HttpContext } from '@angular/common/http';
import { SKIP_ADMIN_AUTH } from '../../../core/interceptors/skip-admin-auth';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { provideUploadRulesStub } from '../../../../testing/upload-rules-stub';

/**
 * @description Runs a request of the portal stub; a request with the admin session fails the test.
 * @param context HTTP context of the request.
 * @param send The recorded request.
 */
function portalRequest<T>(context: HttpContext | undefined, send: () => T): T {
  if (!context?.get(SKIP_ADMIN_AUTH)) {
    throw new Error('A request of the project portal must skip the admin session.');
  }
  return send();
}

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
  /** Query parameters of the address (`?section=`, `?access=`) for the next create(). */
  let query: Record<string, string>;
  let navigate: jasmine.Spy;

  /** localStorage key of the session token of the former portal versions (removed on load). */
  const LEGACY_SESSION = 'project_session_tok';
  /** Whether the browser holds a valid session cookie - decides the answer of GET /tok. */
  let cookie = false;
  const project = {
    id: 1, name: 'Web', description: 'Desc', platform: null, project_lead: null, contact_phone: null, contact_email: null, technologies: null,
    estimated_completion_from: null, estimated_completion_to: null,
    checkpoints: [{ id: 1, label: 'A', status: 'done', description: 'Design of all pages' }, { id: 2, label: 'B', status: 'active', due_date: '2026-12-24' }, { id: 3, label: 'C', status: 'new' }],
    account: { id: 5, username: 'jana', display_name: 'Jana Nová' }
  };
  const threads = () => [
    { id: 1, subject: 'Design', priority: 'medium', status: 'active', last_message_at: null, unread_count: 2, waiting_on: 'customer', messages: [{ id: 1, body: 'logo colours', author_type: 'admin', author_label: null, created_at: '' }] },
    { id: 2, subject: 'Hosting', priority: 'low', status: 'active', last_message_at: null, unread_count: 1, waiting_on: 'supplier' }
  ];
  const portalFiles = () => [
    { id: 7, original_filename: 'brief.pdf', size_bytes: 2048, download_url: 'https://x/f/7', thread_id: 2, thread_subject: 'Hosting', author_type: 'customer', author_label: 'Jana Nová', created_at: '2026-11-10 10:00:00' },
    { id: 6, original_filename: 'old.pdf', size_bytes: 1024, download_url: 'https://x/f/6', thread_id: 9, thread_subject: 'Gone', author_type: 'admin', author_label: null, created_at: '2026-11-09 10:00:00' }
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
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(token ? { token } : {}), queryParamMap: convertToParamMap(query) } } },
        // Every request of the portal goes without the admin session (SKIP_ADMIN_AUTH_CONTEXT);
        // the spies record the path (and body) only.
        { provide: PublicDataService, useValue: {
          get: (path: string, _p: unknown, _h: unknown, context?: HttpContext) => portalRequest(context, () => get(path)),
          getWithMeta: (path: string, _p: unknown, _h: unknown, context?: HttpContext) => portalRequest(context, () => getWithMeta(path)),
          post: (path: string, body: unknown, _h: unknown, context?: HttpContext) => portalRequest(context, () => post(path, body)),
          getSiteSettings,
        } },
        provideUploadRulesStub(),
        { provide: ProjectPortalLocalizationService, useValue: {
          translations$, currentLanguage$: language$, availableLanguages: PROJECT_PORTAL_AVAILABLE_LANGUAGES,
          getValue: (k: string) => k, getCurrentLanguage: () => language$.value, setLanguage: jasmine.createSpy('setLanguage')
        } }
      ]
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(ProjectPortalComponent);
    portal = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Logged-in portal (valid session cookie). */
  const loggedIn = () => create('tok', true);

  beforeEach(() => {
    localStorage.removeItem(LEGACY_SESSION);
    query = {};
    replies = {
      // A copy per answer - a test changing the loaded project must not change the next test's one.
      '/tok': () => cookie ? of(structuredClone(project)) : throwError(() => ({ status: 401 })),
      '/tok/threads': () => of(threads()),
      // Envelopes of the getWithMeta() endpoints - extra information in `meta` (finding #6).
      '/threads/1': () => of({ data: detail(1), meta: { has_more_older_messages: true } }),
      '/threads/2': () => of({ data: detail(2), meta: { has_more_older_messages: true } }),
      '/new-messages': () => of({ data: [], meta: { status: 'active' } }),
      '/tok/files': () => of(portalFiles())
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
    localStorage.removeItem('pp_sidebar_collapsed');
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
   * @description Login: login name and password are both required; success (the API sets the
   *   session cookie) opens the portal with threads - nothing is stored by the component and the
   *   typed password is forgotten; 404 → project not found; 429 → too many attempts; other
   *   errors → invalid login.
   * @input '' / password only / login name only; ' jana ' + 'pw' → {project}; 404; 429; 401.
   * @output No post; 'portal', {username: 'jana', password: 'pw'}, threads 2, requests without
   *   headers, localStorage untouched, password cleared; 'error_project_not_found';
   *   'error_too_many_attempts'; 'error_invalid_login'.
   */
  it('logs in with the login name and password', fakeAsync(() => {
    create();
    portal.login();
    portal.loginPassword = 'pw';
    portal.login();
    portal.loginPassword = '';
    portal.loginUsername = 'jana';
    portal.login();
    expect(post).not.toHaveBeenCalled();

    portal.loginUsername = ' jana ';
    portal.loginPassword = 'pw';
    replies['/tok/login'] = () => throwError(() => ({ status: 404 }));
    portal.login();
    expect(portal.loginError).toBe('error_project_not_found');
    replies['/tok/login'] = () => throwError(() => ({ status: 429 }));
    portal.login();
    expect(portal.loginError).toBe('error_too_many_attempts');
    replies['/tok/login'] = () => throwError(() => ({ status: 401 }));
    portal.login();
    expect(portal.loginError).toBe('error_invalid_login');
    expect(portal.loginLoading).toBeFalse();

    replies['/tok/login'] = () => { cookie = true; return of({ project }); };
    const storedBefore = localStorage.length;
    portal.login();
    expect(post).toHaveBeenCalledWith('projects/public/tok/login', { username: 'jana', password: 'pw' });
    expect(portal.loginPassword).toBe('');
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
    expect([portal.state, portal.project, portal.threads.length, portal.activeTab]).toEqual(['login', null, 0, 'overview']);

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
   * @description Contacts loads the company settings once (null on error) and shows the supplier
   *   contact of the project; other sections only switch.
   * @input setActiveTab('contacts') ×2; project with lead + e-mail; new portal with failing settings.
   * @output getSiteSettings once, companySettings {RPSW}, mailto link rendered; null on error.
   */
  it('loads the contacts tab lazily', fakeAsync(() => {
    loggedIn();
    portal.project = { ...portal.project!, project_lead: 'Karel', contact_email: 'karel@firma.cz' };
    portal.setActiveTab('contacts');
    portal.setActiveTab('contacts');
    expect(getSiteSettings).toHaveBeenCalledTimes(1);
    expect(portal.companySettings).toEqual({ company_name: 'RPSW' });
    fixture.detectChanges();
    const contacts = fixture.nativeElement as HTMLElement;
    expect(contacts.querySelector('a[href="mailto:karel@firma.cz"]')).not.toBeNull();
    expect(contacts.textContent).toContain('Karel');
    expect(contacts.textContent).toContain('RPSW');
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
   * @description The language switcher sits once in the top-right corner (outside the login card;
   *   in the portal in the right part of the header, not in the menu): flag + chevron, the menu
   *   opens on click with all languages.
   * @input Login screen; click on the switcher; then the logged-in portal.
   * @output One .pp-lang-switcher outside the card, aria-expanded true and one item per language;
   *   in the portal one switcher inside .pp-header-right and none in the sidebar.
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
    expect(el.querySelector('.pp-header-right .pp-lang-switcher')).not.toBeNull();
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

  /**
   * @description Admin-like layout: the header shows the initials and name of the signed-in
   *   account and the project; the menu lists the sections (unread badge of Communication, done /
   *   total of Progress) with Help and logout at the bottom; a menu item opens its section.
   * @input Logged-in portal (account Jana Nová, 3 unread, 1 of 3 steps done); click on "Progress".
   * @output 'JN', 'Jana Nová', 'Web'; 7 + 3 items (My account, Help, logout); badge 3; '1/3'; active section checkpoints.
   */
  it('renders the header and the menu like the administration', fakeAsync(() => {
    loggedIn();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pp-avatar')!.textContent!.trim()).toBe('JN');
    expect(el.querySelector('.pp-header-user-name')!.textContent).toContain('Jana Nová');
    expect(el.querySelector('.pp-header-project')!.textContent).toContain('Web');
    expect(el.querySelectorAll('.pp-sidebar .pp-nav-item').length).toBe(10);
    expect(el.querySelector('.pp-nav-badge')!.textContent!.trim()).toBe('3');
    expect(el.querySelector('.pp-nav-count')!.textContent!.trim()).toBe('1/3');
    expect(el.querySelector('.pp-nav-item.active')!.textContent).toContain('tab_overview');
    (el.querySelectorAll('.pp-sidebar .pp-nav-item')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(portal.activeTab).toBe('checkpoints');
    expect(el.querySelector('.pp-page-title')!.textContent).toContain('tab_checkpoints');
    portal.project = { ...portal.project!, account: undefined };
    expect([portal.accountName, portal.accountInitials]).toEqual(['', '']);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description The menu button collapses the menu on desktop (remembered in localStorage,
   *   restored on the next load) and slides it in on mobile, where picking a section or the
   *   overlay closes it; an unavailable storage is ignored.
   * @input desktop: toggle ×1, new portal, toggle; mobile (matchMedia true): toggle, pick a section,
   *   toggle, overlay; storage throwing.
   * @output collapsed true + '1' stored, restored true, then false + '0'; mobileNavOpen true → false
   *   after the pick, true → false after closeMobileNav; no error without storage.
   */
  it('collapses or slides in the menu', fakeAsync(() => {
    loggedIn();
    portal.toggleSidebar();
    expect(portal.sidebarCollapsed).toBeTrue();
    expect(localStorage.getItem('pp_sidebar_collapsed')).toBe('1');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pp-app--collapsed')).not.toBeNull();
    fixture.destroy();
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    loggedIn();
    expect(portal.sidebarCollapsed).toBeTrue();
    portal.toggleSidebar();
    expect(localStorage.getItem('pp_sidebar_collapsed')).toBe('0');

    const media = spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);
    portal.toggleSidebar();
    expect(portal.mobileNavOpen).toBeTrue();
    expect(portal.sidebarCollapsed).toBeFalse();
    portal.setActiveTab('help');
    expect(portal.mobileNavOpen).toBeFalse();
    portal.toggleSidebar();
    portal.closeMobileNav();
    expect(portal.mobileNavOpen).toBeFalse();

    media.and.throwError('no matchMedia');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    expect(() => portal.toggleSidebar()).not.toThrow();
    expect(portal.sidebarCollapsed).toBeTrue();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Files are loaded fresh every time the section opens (signed links), listed with
   *   author and thread; the thread of a file opens in Communication (also a thread not in the
   *   list); a failed load shows the error; nothing is loaded without a session.
   * @input setActiveTab('files') twice; openFileThread(brief.pdf of thread 2); openFileThread(old.pdf of
   *   thread 9); failing load; logout + loadFiles.
   * @output GET …/files twice, 2 rows; Communication with thread 2 / 9 requested; filesError true; no request.
   */
  it('lists the files of the conversations', fakeAsync(() => {
    loggedIn();
    portal.setActiveTab('files');
    portal.setActiveTab('files');
    expect(get.calls.allArgs().filter((a: any[]) => a[0] === 'projects/public/tok/files').length).toBe(2);
    expect(portal.files.map(f => f.id)).toEqual([7, 6]);
    expect(portal.filesLoading).toBeFalse();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-file-row').length).toBe(2);
    expect(el.querySelector('.pp-file-row')!.textContent).toContain('Jana Nová');

    portal.openFileThread(portal.files[0]);
    expect(portal.activeTab).toBe('threads');
    expect(getWithMeta).toHaveBeenCalledWith('projects/public/tok/threads/2');
    portal.openFileThread(portal.files[1]);
    expect(getWithMeta).toHaveBeenCalledWith('projects/public/tok/threads/9');

    replies['/tok/files'] = () => throwError(() => ({ status: 500 }));
    portal.setActiveTab('files');
    expect(portal.filesError).toBeTrue();
    get.calls.reset();
    portal.logout();
    portal.loadFiles();
    expect(get).not.toHaveBeenCalled();
    expect(portal.files).toEqual([]);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Messages name their authors: "You" for the own account, a colleague's name for
   *   another client account, the supplier's name (or "Supplier"); waiting labels and the number
   *   of threads waiting on the client; the current step; priorities and dates translated.
   * @input own message (account 5), colleague (account 6 'Petr'), customer without name, supplier
   *   'Jana PM' / without name; threads waiting on customer / supplier / closed.
   * @output 'author_you', 'Petr', 'author_client', 'Jana PM', 'author_supplier'; isMine only for
   *   the own; 'waiting_on_you' / 'waiting_on_supplier' / ''; waitingOnYouCount 1; current step B.
   */
  it('names the authors and shows whose turn it is', fakeAsync(() => {
    loggedIn();
    const msg = (author_type: 'customer' | 'admin', author_label: string | null, author_account_id: number | null = null) =>
      ({ id: 1, body: '', created_at: '', author_type, author_label, author_account_id });
    expect(portal.authorName(msg('customer', 'Jana Nová', 5))).toBe('author_you');
    expect(portal.authorName(msg('customer', 'Petr', 6))).toBe('Petr');
    expect(portal.authorName(msg('customer', null, 6))).toBe('author_client');
    expect(portal.authorName(msg('admin', 'Jana PM'))).toBe('Jana PM');
    expect(portal.authorName(msg('admin', null))).toBe('author_supplier');
    expect(portal.isMine(msg('customer', 'x', 5))).toBeTrue();
    expect(portal.isMine(msg('admin', 'x', 5))).toBeFalse();

    expect(portal.waitingLabel(portal.threads[0])).toBe('waiting_on_you');
    expect(portal.waitingLabel(portal.threads[1])).toBe('waiting_on_supplier');
    expect(portal.waitingLabel({ ...portal.threads[1], waiting_on: null })).toBe('');
    expect(portal.waitingOnYouCount).toBe(1);
    expect(portal.currentCheckpoint!.label).toBe('B');
    portal.project!.checkpoints = portal.project!.checkpoints.map(c => ({ ...c, status: 'done' as const }));
    expect(portal.currentCheckpoint).toBeNull();
    expect(portal.priorityLabel('high')).toBe('priority_high');
    expect(portal.formatDate('2026-12-24')).toBe(new Date('2026-12-24T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }));
    expect(portal.formatDate(null)).toBe('');

    portal.setActiveTab('threads');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pp-waiting[data-waiting="customer"]')!.textContent).toContain('waiting_on_you');
    expect(el.querySelector('.pp-thread-item-meta')!.textContent).toContain('priority_medium');

    replies['/threads/1'] = () => of({ data: { ...detail(1), messages: [msg('customer', 'Jana Nová', 5), { ...msg('admin', 'PM'), id: 2 }] }, meta: {} });
    portal.openThread(portal.threads[0]);
    replies['/new-messages'] = () => of({ data: [{ ...msg('admin', 'PM'), id: 3 }], meta: { status: 'active', waiting_on: 'customer' } });
    tick();
    expect(portal.selectedThread!.waiting_on).toBe('customer');
    fixture.detectChanges();
    expect(el.querySelectorAll('.pp-message-mine').length).toBe(1);
    expect(el.querySelectorAll('.pp-message-supplier').length).toBe(2);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Overview: progress, threads waiting on the client (highlighted), unread
   *   messages, the current step with its due date and the description; a card opens its section.
   * @input Logged-in portal on the overview; click on the "waiting on you" card.
   * @output 33 %; .pp-stat--attention with 1; current step 'B' with the due date; description
   *   'Desc'; click → threads.
   */
  it('renders the overview', fakeAsync(() => {
    loggedIn();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const stats = el.querySelectorAll<HTMLButtonElement>('.pp-stat');
    expect(stats[0].textContent).toContain('33 %');
    expect(el.querySelector('.pp-stat--attention .pp-stat-value')!.textContent!.trim()).toBe('1');
    expect(el.querySelector('.pp-current-step')!.textContent).toContain('B');
    expect(el.querySelector('.pp-current-step .pp-due')!.textContent).toContain('due_date_prefix');
    expect(el.textContent).toContain('Desc');
    stats[1].click();
    expect(portal.activeTab).toBe('threads');
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description My account: the form starts from the saved settings (all off without data),
   *   clearing the e-mail turns every notification off, a notification without an e-mail is
   *   refused before sending, saving posts the own settings and takes the answer; a failure
   *   shows an error; reset puts the saved values back; the switches are disabled without e-mail.
   * @input setActiveTab('account'); e-mail + 2 switches → save (API answers the project with them);
   *   cleared e-mail; switch without e-mail; failing save; reset.
   * @output defaults; post('projects/public/tok/account', {email trimmed, language, flags}); saved +
   *   not dirty; flags off; 'email_required' without request; 'error'; draft = saved.
   */
  it('lets the client choose its e-mail notifications', fakeAsync(() => {
    loggedIn();
    portal.setActiveTab('account');
    expect(portal.accountSettings).toEqual({ email: '', language: 'cz', notify_replies: false, notify_checkpoint_status: false, notify_checkpoint_dates: false, notify_updates: false, notify_approvals: false });
    expect(portal.accountSettingsDirty).toBeFalse();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-switch').length).toBe(5);
    expect((el.querySelector('fieldset.pp-switches') as HTMLFieldSetElement).disabled).toBeTrue();

    portal.accountSettings = { email: ' jana@client.cz ', language: 'en', notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, notify_updates: true, notify_approvals: false };
    const saved = { ...project.account, email: 'jana@client.cz', language: 'en', notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, notify_updates: true, notify_approvals: false };
    replies['/tok/account'] = () => of({ ...project, account: saved });
    portal.saveAccountSettings();
    expect(post).toHaveBeenCalledWith('projects/public/tok/account', {
      email: 'jana@client.cz', language: 'en', notify_replies: true, notify_checkpoint_status: false, notify_checkpoint_dates: true, notify_updates: true, notify_approvals: false,
    });
    expect(portal.accountSaveResult).toBe('saved');
    expect(portal.project!.account!.notify_replies).toBeTrue();
    expect(portal.accountSettingsDirty).toBeFalse();
    post.calls.reset();
    portal.saveAccountSettings();
    expect(post).not.toHaveBeenCalled();

    portal.accountSettings.email = '';
    portal.onAccountEmailChange();
    expect([portal.accountSettings.notify_replies, portal.accountSettings.notify_checkpoint_dates]).toEqual([false, false]);
    portal.accountSettings.notify_replies = true;
    portal.saveAccountSettings();
    expect(portal.accountSaveResult).toBe('email_required');
    expect(post).not.toHaveBeenCalled();

    portal.accountSettings = { ...portal.accountSettings, email: 'x@y.cz' };
    replies['/tok/account'] = () => throwError(() => ({ status: 422 }));
    portal.saveAccountSettings();
    expect(portal.accountSaveResult).toBe('error');
    expect(portal.accountSaving).toBeFalse();
    portal.resetAccountSettings();
    expect(portal.accountSettings.email).toBe('jana@client.cz');
    expect(portal.accountSaveResult).toBeNull();
    fixture.destroy();
    discardPeriodicTasks();
  }));

  describe('phase 2', () => {
    const activity = () => [
      { type: 'approval_requested', title: 'Homepage', detail: null, at: '2026-11-12 09:00:00', is_new: true, target: { section: 'approvals', id: 4 } },
      { type: 'checkpoint', title: 'B', detail: 'active', at: '2026-11-11 09:00:00', is_new: false, target: { section: 'checkpoints', id: 2 } },
      { type: 'reply', title: 'Design', detail: null, at: '2026-11-10 09:00:00', is_new: false, target: { section: 'threads', id: 1 } },
      { type: 'approval_decided', title: 'Texts', detail: 'changes_requested', at: '2026-11-09 09:00:00', is_new: false, target: { section: 'approvals', id: 3 } },
    ];
    const approvals = () => [
      { id: 4, title: 'Homepage', description: 'Final design', status: 'pending', due_date: '2026-11-20', checkpoint_label: 'B', requested_by_label: 'Petr', requested_at: '2026-11-12 09:00:00',
        attachments: [{ id: 30, original_filename: 'home.png', mime_type: 'image/png', size_bytes: 4096, download_url: 'https://x/a/30' }], decisions: [] },
      { id: 3, title: 'Texts', description: null, status: 'changes_requested', due_date: null, requested_by_label: null, requested_at: '2026-11-08 09:00:00',
        decisions: [{ id: 1, decision: 'changes_requested', comment: 'Shorter', author_label: 'Jana Nová', account_id: 5, created_at: '2026-11-09 09:00:00' }] },
    ];
    const updates = () => [
      { id: 2, title: 'Week 2', body: 'Design done', author_label: 'Petr', published_at: '2026-11-11 09:00:00', attachments: [] },
    ];
    beforeEach(() => {
      replies['/tok/activity'] = () => of({ data: activity(), meta: { unseen: 1 } });
      replies['/tok/approvals'] = () => of(approvals());
      replies['/tok/updates'] = () => of(updates());
      replies['/activity/seen'] = () => of({});
    });

    /**
     * @description Sign-in by an e-mailed code: the mode switch clears the state; step 1 asks for
     *   a code (always the same answer - no account enumeration), step 2 signs in with it and
     *   opens the portal; a wrong code / too many attempts / a failed request show their reason.
     * @input  no session; setLoginMode('code'); identifier 'jana'; requestCode (ok, then 429, then 500);
     *   code '12 34 56' wrong (422), then right; rendered login card
     * @output post('…/login/code-request', { identifier: 'jana' }); codeRequested + 'login_code_sent';
     *   'error_too_many_attempts' / 'error_code_request_failed'; post('…/login/code', { identifier, code: '123456' });
     *   'error_code_invalid'; state 'portal'; two mode buttons and the one-time-code input rendered
     */
    it('signs in with a code sent by e-mail', fakeAsync(() => {
      create();
      portal.loginError = 'error_invalid_credentials';
      portal.setLoginMode('code');
      expect(portal.loginMode).toBe('code');
      expect(portal.loginError).toBeNull();
      expect(portal.codeRequested).toBeFalse();
      portal.requestCode();
      expect(post).not.toHaveBeenCalled();
      portal.loginUsername = ' jana ';
      replies['/login/code-request'] = () => of({});
      portal.requestCode();
      expect(post).toHaveBeenCalledWith('projects/public/tok/login/code-request', { identifier: 'jana' });
      expect([portal.codeRequested, portal.loginInfo]).toEqual([true, 'login_code_sent']);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.pp-login-modes button').length).toBe(2);
      expect(el.querySelector('input[autocomplete="one-time-code"]')).not.toBeNull();
      expect(el.querySelector('.pp-login-info')!.textContent).toContain('login_code_sent');

      portal.loginCode = '12 34 5';
      portal.loginWithCode();
      expect(post).not.toHaveBeenCalledWith('projects/public/tok/login/code', jasmine.anything());
      portal.loginCode = '12 34 56';
      replies['/login/code'] = () => throwError(() => ({ status: 422 }));
      portal.loginWithCode();
      expect(post).toHaveBeenCalledWith('projects/public/tok/login/code', { identifier: 'jana', code: '123456' });
      expect(portal.loginError).toBe('error_code_invalid');
      cookie = true;
      replies['/login/code'] = () => of({ project: structuredClone(project) });
      portal.loginWithCode();
      expect(portal.state).toBe('portal');
      expect(portal.loginInfo).toBeNull();

      replies['/login/code-request'] = () => throwError(() => ({ status: 429 }));
      portal.loginUsername = 'jana';
      portal.requestCode();
      expect(portal.loginError).toBe('error_too_many_attempts');
      replies['/login/code-request'] = () => throwError(() => ({ status: 500 }));
      portal.requestCode();
      expect(portal.loginError).toBe('error_code_request_failed');
      fixture.destroy();
      discardPeriodicTasks();
    }));

    /**
     * @description A one-time link of an e-mail (`?access=`) signs in once and is dropped from the
     *   address; a spent link falls back to an existing session, otherwise to the code login with
     *   the reason; `?section=` opens that section after the sign-in.
     * @input  ?access=L1&section=approvals (ok); ?access=L2 failing without / with a session cookie
     * @output post('…/login/link', { link: 'L1' }); navigate removing `access` with replaceUrl;
     *   portal on 'approvals'; then login in code mode with 'error_link_invalid'; then portal
     */
    it('signs in with the link of an e-mail and opens the requested section', fakeAsync(() => {
      query = { access: 'L1', section: 'approvals' };
      replies['/login/link'] = () => of({ project: structuredClone(project) });
      cookie = true;
      create('tok', true);
      expect(post).toHaveBeenCalledWith('projects/public/tok/login/link', { link: 'L1' });
      expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { access: null }, replaceUrl: true }));
      expect(portal.state).toBe('portal');
      expect(portal.activeTab).toBe('approvals');
      expect(portal.approvals.length).toBe(2);
      fixture.destroy();
      discardPeriodicTasks();

      TestBed.resetTestingModule();
      query = { access: 'L2' };
      replies['/login/link'] = () => throwError(() => ({ status: 422 }));
      create('tok', false);
      expect(portal.state).toBe('login');
      expect(portal.loginMode).toBe('code');
      expect(portal.loginError).toBe('error_link_invalid');
      fixture.destroy();
      discardPeriodicTasks();

      TestBed.resetTestingModule();
      create('tok', true);
      expect(portal.state).toBe('portal');
      fixture.destroy();
      discardPeriodicTasks();
    }));

    /**
     * @description "What is new": loaded with the portal, marked seen at once on the overview
     *   (badge gone, new items still highlighted), labelled per type and opening its section;
     *   pending approvals show a banner and a menu badge.
     * @input  logged in on the overview; activity (1 unseen); approvals (1 pending)
     * @output post('…/activity/seen'); activityUnseen 0; 4 news items, 1 highlighted; a click on
     *   an item drops the highlight at once (no reload); labels; banner; openActivity → approvals /
     *   checkpoints / thread 1
     */
    it('shows what is new and opens it', fakeAsync(() => {
      loggedIn();
      expect(portal.activity.length).toBe(4);
      expect(post).toHaveBeenCalledWith('projects/public/tok/activity/seen', {});
      expect(portal.activityUnseen).toBe(0);
      expect(portal.pendingApprovalsCount).toBe(1);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.pp-news-item').length).toBe(4);
      expect(el.querySelectorAll('.pp-news-item--new').length).toBe(1);
      expect(el.querySelector('.pp-banner')).not.toBeNull();
      expect(el.querySelector('.pp-nav-badge--attention')!.textContent!.trim()).toBe('1');

      const [requested, checkpoint, reply, decided] = portal.activity;
      portal.openActivity(requested);
      expect(portal.activity.filter(i => i.is_new).length).toBe(0);
      portal.setActiveTab('overview');
      fixture.detectChanges();
      expect(el.querySelectorAll('.pp-news-item--new').length).toBe(0);
      expect(portal.activityLabel(requested)).toBe('news_approval_requested');
      expect(portal.activityLabel(checkpoint)).toBe('news_checkpoint'.replace('{status}', ''));
      expect(portal.activityLabel(decided)).toBe('news_approval_changes_requested');
      portal.openActivity(requested);
      expect(portal.activeTab).toBe('approvals');
      portal.openActivity(checkpoint);
      expect(portal.activeTab).toBe('checkpoints');
      portal.openActivity(reply);
      expect(portal.activeTab).toBe('threads');
      expect(portal.selectedThread?.id).toBe(1);
      fixture.destroy();
      discardPeriodicTasks();
      flush();
    }));

    /**
     * @description Approvals: approve at once; "request changes" needs a comment; the answer
     *   replaces the request; a failure (e.g. already decided) shows the reason and reloads; a
     *   decided request has no buttons and shows its history.
     * @input  approvals section; decide(4, approved); request changes without / with comment; failure
     * @output post('…/approvals/4/decision', { decision: 'approved' }); 'approval_comment_required' without
     *   request; { decision: 'changes_requested', comment: 'Bigger logo' }; 'approval_decision_failed' + reload;
     *   rendered: 2 cards, 1 action row, 1 history entry
     */
    it('lets the client approve or request changes', fakeAsync(() => {
      loggedIn();
      portal.setActiveTab('approvals');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.pp-approval').length).toBe(2);
      expect(el.querySelectorAll('.pp-approval-actions').length).toBe(1);
      expect(el.querySelectorAll('.pp-decisions li').length).toBe(1);
      expect(el.querySelector('.pp-approval .pp-attachment-name')!.textContent).toContain('home.png');

      replies['/approvals/4/decision'] = () => of({ ...approvals()[0], status: 'approved' });
      portal.decide(portal.approvals[0], 'approved');
      expect(post).toHaveBeenCalledWith('projects/public/tok/approvals/4/decision', { decision: 'approved' });
      expect(portal.approvals[0].status).toBe('approved');
      expect(portal.pendingApprovalsCount).toBe(0);
      post.calls.reset();
      portal.decide(portal.approvals[0], 'approved');
      expect(post).not.toHaveBeenCalled();

      portal.approvals = approvals() as any;
      portal.toggleChangesForm(portal.approvals[0]);
      expect(portal.changesFormId).toBe(4);
      portal.decide(portal.approvals[0], 'changes_requested');
      expect(portal.decisionError).toBe('approval_comment_required');
      expect(post).not.toHaveBeenCalled();
      portal.changesComment = ' Bigger logo ';
      replies['/approvals/4/decision'] = () => of({ ...approvals()[0], status: 'changes_requested' });
      portal.decide(portal.approvals[0], 'changes_requested');
      expect(post).toHaveBeenCalledWith('projects/public/tok/approvals/4/decision', { decision: 'changes_requested', comment: 'Bigger logo' });
      expect([portal.changesFormId, portal.changesComment]).toEqual([null, '']);

      portal.approvals = approvals() as any;
      get.calls.reset();
      replies['/approvals/4/decision'] = () => throwError(() => ({ status: 422 }));
      portal.decide(portal.approvals[0], 'approved');
      expect(portal.decisionError).toBe('approval_decision_failed');
      expect(get).toHaveBeenCalledWith('projects/public/tok/approvals');
      expect(portal.decidingId).toBeNull();
      expect(portal.approvalStatusLabel('approved')).toBe('approval_status_approved');
      fixture.destroy();
      discardPeriodicTasks();
    }));

    /**
     * @description Updates load when the section opens; files of updates / approvals name their
     *   source and open their section; the account shows how it signs in.
     * @input  setActiveTab('updates'); files with source update / approval / thread; account without password
     * @output get('…/updates'); 1 card 'Week 2'; labels 'file_source_update: Week 2' / 'file_source_approval: Homepage' / 'Hosting';
     *   openFileThread → updates / approvals; account text 'account_signin_code'
     */
    it('shows the updates, the sources of files and the sign-in of the account', fakeAsync(() => {
      loggedIn();
      portal.setActiveTab('updates');
      expect(get).toHaveBeenCalledWith('projects/public/tok/updates');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.pp-update').length).toBe(1);
      expect(el.querySelector('.pp-update')!.textContent).toContain('Week 2');

      const base = portalFiles()[0] as any;
      const fromUpdate = { ...base, source: 'update', source_title: 'Week 2', thread_id: null, thread_subject: null };
      const fromApproval = { ...base, source: 'approval', source_title: 'Homepage', thread_id: null, thread_subject: null };
      expect(portal.fileSourceLabel(fromUpdate)).toBe('file_source_update: Week 2');
      expect(portal.fileSourceLabel(fromApproval)).toBe('file_source_approval: Homepage');
      expect(portal.fileSourceLabel(base)).toBe('Hosting');
      portal.openFileThread(fromApproval);
      expect(portal.activeTab).toBe('approvals');
      portal.openFileThread(fromUpdate);
      expect(portal.activeTab).toBe('updates');

      portal.project = { ...portal.project!, account: { ...portal.project!.account!, has_password: false, email: 'jana@client.cz', email_verified: true } };
      portal.setActiveTab('account');
      fixture.detectChanges();
      expect(el.textContent).toContain('account_signin_code');
      expect(el.textContent).toContain('account_email_verified');
      fixture.destroy();
      discardPeriodicTasks();
    }));
  });
});
