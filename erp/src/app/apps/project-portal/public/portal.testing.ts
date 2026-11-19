/**
 * @file portal.testing.ts
 * @path src/app/apps/project-portal/public/portal.testing.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test setup shared by the specs of the project portal (layout, session service,
 *   sections): sample data of the API, a PublicDataService stub that answers by the end of the
 *   path (`replies`) and records the requests, a ProjectPortalLocalizationService stub (texts =
 *   keys) and `setUpPortal()` that configures TestBed with them, a Router spy and a started
 *   PortalSessionService.
 * @usage Only imported by *.spec.ts (not part of the application build).
 * @dependencies jasmine, TestBed; src/testing/upload-rules-stub (rules of the API)
 */

import { HttpContext } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { SKIP_ADMIN_AUTH } from '../../../core/interceptors/skip-admin-auth';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { provideUploadRulesStub } from '../../../../testing/upload-rules-stub';
import { PROJECT_PORTAL_AVAILABLE_LANGUAGES, ProjectPortalLocalizationService } from './project-portal-localization.service';
import { PortalSessionService } from './portal-session.service';
import { PublicProject } from './portal.models';

/** Project of the API: 3 steps (1 done, B active with a due date, A with a description), account 5. */
export const testProject = (): PublicProject => ({
  id: 1, name: 'Web', description: 'Desc', platform: null, project_lead: null, contact_phone: null, contact_email: null, technologies: null,
  estimated_completion_from: null, estimated_completion_to: null,
  checkpoints: [{ id: 1, label: 'A', status: 'done', description: 'Design of all pages' }, { id: 2, label: 'B', status: 'active', due_date: '2026-12-24' }, { id: 3, label: 'C', status: 'new' }],
  account: { id: 5, username: 'jana', display_name: 'Jana Nová' },
});

/** Threads of the API: 1 waiting on the client (2 unread), 2 waiting on the supplier (1 unread). */
export const testThreads = () => [
  { id: 1, subject: 'Design', priority: 'medium', status: 'active', last_message_at: null, unread_count: 2, waiting_on: 'customer' as const, messages: [{ id: 1, body: 'logo colours', author_type: 'admin' as const, author_label: null, created_at: '' }] },
  { id: 2, subject: 'Hosting', priority: 'low', status: 'active', last_message_at: null, unread_count: 1, waiting_on: 'supplier' as const },
];

/** Files of the API (thread 2 exists, thread 9 no longer in the list). */
export const testFiles = () => [
  { id: 7, original_filename: 'brief.pdf', size_bytes: 2048, download_url: 'https://x/f/7', thread_id: 2, thread_subject: 'Hosting', author_type: 'customer' as const, author_label: 'Jana Nová', created_at: '2026-11-10 10:00:00' },
  { id: 6, original_filename: 'old.pdf', size_bytes: 1024, download_url: 'https://x/f/6', thread_id: 9, thread_subject: 'Gone', author_type: 'admin' as const, author_label: null, created_at: '2026-11-09 10:00:00' },
];

/** Detail of a thread (one message of the client, id 10). */
export const testThreadDetail = (id = 1) => ({ ...testThreads()[0], id, messages: [{ id: 10, body: 'Hi', author_type: 'customer' as const, author_label: null, created_at: '' }] });

/** A file of the given name and size (bytes). */
export const testFile = (name: string, size = 10): File => {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

/** A change event of a file input with the files. */
export const fileEvent = (...list: File[]) => ({ target: { files: list, value: 'x' } } as unknown as Event);

/** Stubs and spies of one test. */
export interface PortalTestContext {
  /** Answers by the end of the path (the longest matching key wins; unknown → {}). */
  replies: Record<string, () => Observable<any>>;
  get: jasmine.Spy;
  getWithMeta: jasmine.Spy;
  post: jasmine.Spy;
  getSiteSettings: jasmine.Spy;
  navigate: jasmine.Spy;
  language$: BehaviorSubject<string>;
  translations$: BehaviorSubject<any>;
  session: PortalSessionService;
}

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

/**
 * @description Configures TestBed for the portal: the stubs, a Router spy (navigate) unless
 *   `realRouter`, PortalSessionService provided at the root of the test.
 * @param options imports (component under test), providers, realRouter (keep the router of the
 *   providers), start (start the session with the test project - default true).
 * @returns The context; call `TestBed.createComponent` afterwards.
 */
export function setUpPortal(options: { imports?: any[]; providers?: (Provider | EnvironmentProviders)[]; realRouter?: boolean; start?: boolean } = {}): PortalTestContext {
  const ctx = {
    replies: {
      // A copy per answer - a test changing the loaded project must not change the next one.
      '/tok': () => of(testProject()),
      '/tok/threads': () => of(testThreads()),
      '/threads/1': () => of({ data: testThreadDetail(1), meta: { has_more_older_messages: true } }),
      '/threads/2': () => of({ data: testThreadDetail(2), meta: { has_more_older_messages: true } }),
      '/new-messages': () => of({ data: [], meta: { status: 'active' } }),
      '/tok/files': () => of(testFiles()),
    } as Record<string, () => Observable<any>>,
    language$: new BehaviorSubject('cz'),
    translations$: new BehaviorSubject<any>({}),
  } as PortalTestContext;
  const route = (url: string) => {
    const path = url.split('?')[0];
    const key = Object.keys(ctx.replies).filter(k => path.endsWith(k)).sort((a, b) => b.length - a.length)[0];
    return key ? ctx.replies[key]() : of({});
  };
  ctx.get = jasmine.createSpy('get').and.callFake(route);
  ctx.getWithMeta = jasmine.createSpy('getWithMeta').and.callFake(route);
  ctx.post = jasmine.createSpy('post').and.callFake(route);
  ctx.getSiteSettings = jasmine.createSpy('getSiteSettings').and.returnValue(of({ settings: { company_name: 'RPSW' } }));

  TestBed.configureTestingModule({
    imports: options.imports ?? [],
    providers: [
      PortalSessionService,
      // Every request of the portal goes without the admin session (SKIP_ADMIN_AUTH_CONTEXT).
      { provide: PublicDataService, useValue: {
        get: (path: string, _p: unknown, _h: unknown, context?: HttpContext) => portalRequest(context, () => ctx.get(path)),
        getWithMeta: (path: string, _p: unknown, _h: unknown, context?: HttpContext) => portalRequest(context, () => ctx.getWithMeta(path)),
        post: (path: string, body: unknown, _h: unknown, context?: HttpContext) => portalRequest(context, () => ctx.post(path, body)),
        getFresh: () => of({ is_portal_active: true, maintenance_message: null }),
        getSiteSettings: () => ctx.getSiteSettings(),
      } },
      provideUploadRulesStub(),
      { provide: ProjectPortalLocalizationService, useValue: {
        translations$: ctx.translations$, currentLanguage$: ctx.language$, availableLanguages: PROJECT_PORTAL_AVAILABLE_LANGUAGES,
        getValue: (k: string) => k, getCurrentLanguage: () => ctx.language$.value, setLanguage: jasmine.createSpy('setLanguage'),
      } },
      ...(options.providers ?? []),
    ],
  });
  if (!options.realRouter) {
    ctx.navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  }
  ctx.session = TestBed.inject(PortalSessionService);
  if (options.start !== false) ctx.session.start('tok', testProject());
  return ctx;
}

/** A failing answer with the HTTP status. */
export const failWith = (status: number) => () => throwError(() => ({ status }));
