/**
 * @file portal-session.service.ts
 * @path src/app/apps/project-portal/public/portal-session.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description State of one signed-in portal session, shared by the layout and the sections of
 *   /projects/:token: the project with the account, the conversations (silently polled every
 *   15 s for the unread badges), "What is new", the approval requests (menu badges) and the data
 *   a section keeps while the client moves between sections (updates, files, company data,
 *   expanded steps). Every request goes through `get` / `getWithMeta` / `post`.
 * @usage Provided by PortalLayoutComponent (one instance per opened portal, destroyed with it);
 *   the layout calls `start(token, project)` with the project of the session resolver.
 *
 * @security The session is NOT handled by JavaScript at all: the API sets it as an HttpOnly /
 *   Secure / SameSite=Strict cookie limited to the routes of this project and the browser sends
 *   it by itself (same origin) - nothing is stored in localStorage, so an XSS cannot read it.
 *   Requests go without the admin session (SKIP_ADMIN_AUTH_CONTEXT); any 401 (the session
 *   expired after 24 h of inactivity, or was ended) sends the client to the login of the project.
 *   UX only - the API checks the session on every request.
 *   One browser holds ONE session per project (one cookie): signing in as another account of
 *   the same project in another tab replaces it. Whenever this tab becomes active again, the
 *   portal asks who is signed in and switches to that account, so it never shows one account
 *   while the API acts as another.
 * @note Every request goes through `leaveOnMaintenance()`: a 503 (the portal was switched off by
 *   the supplier) opens the maintenance page, which returns here once it is online.
 * @dependencies PublicDataService, Router, maintenance/portal-maintenance (leaveOnMaintenance)
 */

import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, filter, finalize, fromEvent, merge, switchMap, takeUntil, throttleTime, throwError, timer } from 'rxjs';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { SKIP_ADMIN_AUTH_CONTEXT } from '../../../core/interceptors/skip-admin-auth';
import { ApiEnvelope } from '../../../shared/interfaces/api-envelope';
import { leaveOnMaintenance } from './maintenance/portal-maintenance';
import {
  CompanySettings, PortalActivityItem, PortalApproval, PortalFile, PortalSection, PortalUpdate, ProjectThread, PublicProject,
} from './portal.models';

/** Interval of the thread list polling and of the polling of an open thread. */
export const PORTAL_POLL_INTERVAL_MS = 15000;

@Injectable()
export class PortalSessionService implements OnDestroy {
  private readonly api = inject(PublicDataService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private readonly stopGlobalPolling$ = new Subject<void>();

  /** Access token of the project (from the address). */
  token = '';
  /** Whether the portal holds a session (the session itself is only in the HttpOnly cookie). */
  private hasSession = false;

  /** Project with the signed-in account. */
  readonly project = signal<PublicProject | null>(null);
  /** Conversations (Communication) with their unread counts. */
  readonly threads = signal<ProjectThread[]>([]);
  /** "What is new" (overview) and the number of items not seen yet (menu badge). */
  readonly activity = signal<PortalActivityItem[]>([]);
  readonly activityUnseen = signal(0);
  readonly activityLoading = signal(false);
  /** Approval requests (pending ones = menu badge). */
  readonly approvals = signal<PortalApproval[]>([]);
  readonly approvalsLoading = signal(false);
  /** Updates of the supplier. */
  readonly updates = signal<PortalUpdate[]>([]);
  readonly updatesLoading = signal(false);
  /** Files of the project (fresh signed links on every load). */
  readonly files = signal<PortalFile[]>([]);
  readonly filesLoading = signal(false);
  readonly filesError = signal(false);
  /** Company data of the supplier (Contacts, loaded once). */
  readonly companySettings = signal<CompanySettings | null>(null);
  readonly companySettingsLoading = signal(false);
  /** Steps of Progress whose description is expanded. */
  readonly expandedCheckpointIds = signal<ReadonlySet<number>>(new Set());
  /** The header refresh is running. */
  readonly refreshing = signal(false);

  /** Thread Communication opens when it starts (a news item, a file) - taken by the section. */
  readonly requestedThread = signal<ProjectThread | null>(null);
  /** Thread open in Communication: the thread list polling keeps its unread count at 0. */
  openThreadId: number | null = null;
  /** The overview is open: news loaded later are marked as seen at once. */
  overviewOpen = false;

  /** Emits after a successful refresh of the header - the open section reloads its own data. */
  readonly refreshed$ = new Subject<void>();

  /** Unread messages of all conversations (menu badge, overview). */
  readonly totalUnreadCount = computed(() => this.threads().reduce((sum, t) => sum + (t.unread_count ?? 0), 0));
  /** Active threads where the supplier waits for the client's answer. */
  readonly waitingOnYouCount = computed(() => this.threads().filter(t => t.waiting_on === 'customer').length);
  /** Approval requests waiting for the client's decision (menu badge). */
  readonly pendingApprovalsCount = computed(() => this.approvals().filter(a => a.status === 'pending').length);
  /** Done / total steps and the percentage. */
  readonly checkpointProgress = computed(() => {
    const checkpoints = this.project()?.checkpoints ?? [];
    const done = checkpoints.filter(c => c.status === 'done').length;
    return { done, total: checkpoints.length, percent: checkpoints.length > 0 ? Math.round((done / checkpoints.length) * 100) : 0 };
  });

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopGlobalPolling$.next();
    this.stopGlobalPolling$.complete();
  }

  // ── Requests ──────────────────────────────────────────────────────────

  /** GET of a portal endpoint (the browser sends the session cookie). */
  get<T>(path: string): Observable<T> {
    return this.guard(this.api.get<T>(path, undefined, undefined, SKIP_ADMIN_AUTH_CONTEXT));
  }

  /** GET of a portal endpoint keeping the envelope (`meta`). */
  getWithMeta<T, M>(path: string): Observable<ApiEnvelope<T, M>> {
    return this.guard(this.api.getWithMeta<T, M>(path, undefined, undefined, SKIP_ADMIN_AUTH_CONTEXT));
  }

  /** POST to a portal endpoint (the browser sends the session cookie). */
  post<T>(path: string, body: unknown): Observable<T> {
    return this.guard(this.api.post<T>(path, body, undefined, SKIP_ADMIN_AUTH_CONTEXT));
  }

  /**
   * @description Maintenance (503) opens the maintenance page; an ended session (401) opens the
   *   login; the error still reaches the caller.
   * @param request Request of the portal.
   */
  private guard<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      leaveOnMaintenance(this.router),
      catchError(err => {
        if (err?.status === 401) this.goToLogin();
        return throwError(() => err);
      })
    );
  }

  /** Path of an endpoint of this project, e.g. `path('threads')` = projects/public/{token}/threads. */
  path(endpoint = ''): string {
    return `projects/public/${this.token}${endpoint ? '/' + endpoint : ''}`;
  }

  // ── Session ───────────────────────────────────────────────────────────

  /**
   * @description Opens the portal of a signed-in account: threads, news and approvals load and
   *   the thread list polling starts.
   * @param token Access token of the project.
   * @param project Project of the session resolver (with the account).
   */
  start(token: string, project: PublicProject): void {
    this.token = token;
    this.hasSession = true;
    this.project.set(project);
    this.loadThreads();
    this.loadActivity();
    this.loadApprovals();
    this.startGlobalThreadsPolling();
    this.watchSignedInAccount();
  }

  /** @description The portal holds a session (not logged out). */
  get active(): boolean {
    return this.hasSession;
  }

  /** @description Opens the login of this project (no session / logged out); Back does not return here. */
  goToLogin(): void {
    this.hasSession = false;
    this.stopGlobalPolling$.next();
    this.router.navigate(['/projects/login', this.token], { replaceUrl: true });
  }

  /** @description Ends the session on the API (the cookie is dropped) and opens the login. */
  logout(): void {
    if (!this.hasSession) { this.goToLogin(); return; }
    this.post(this.path('logout'), {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({ complete: () => this.finishLogout(), error: () => this.finishLogout() });
  }

  private finishLogout(): void {
    this.stopGlobalPolling$.next();
    this.project.set(null);
    this.threads.set([]);
    this.activity.set([]);
    this.activityUnseen.set(0);
    this.approvals.set([]);
    this.updates.set([]);
    this.files.set([]);
    this.companySettings.set(null);
    this.expandedCheckpointIds.set(new Set());
    this.goToLogin();
  }

  /**
   * @description Reloads the project, the threads, the news and the approvals; the open section
   *   reloads its own data (`refreshed$`). A failure ends in the login.
   */
  refresh(): void {
    if (!this.hasSession || this.refreshing()) return;
    this.refreshing.set(true);
    this.get<PublicProject>(this.path())
      .pipe(finalize(() => this.refreshing.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: (project) => this.reload(project),
        error: () => this.goToLogin(),
      });
  }

  /**
   * @description Takes a freshly loaded project: the threads, the news and the approvals reload
   *   and the open section reloads its own data (`refreshed$`).
   * @param project Project of the API (with the signed-in account).
   */
  private reload(project: PublicProject): void {
    this.project.set(project);
    this.loadThreads();
    this.loadActivity();
    this.loadApprovals();
    this.refreshed$.next();
  }

  /**
   * @description When the tab becomes active again (window focus, page visible), asks the API who
   *   is signed in: another account of the project (signed in in another tab - the browser holds
   *   one session cookie per project) → the portal switches to it; no session (logged out
   *   elsewhere, 401) → the login. At most once a second; other errors are ignored.
   */
  private watchSignedInAccount(): void {
    merge(
      fromEvent(window, 'focus'),
      fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible'))
    ).pipe(
      throttleTime(1000),
      switchMap(() => this.get<PublicProject>(this.path()).pipe(catchError(() => EMPTY))),
      takeUntil(this.stopGlobalPolling$),
      takeUntil(this.destroy$)
    ).subscribe(project => {
      if (project?.account?.id !== this.project()?.account?.id) this.reload(project);
    });
  }

  // ── Navigation between sections ──────────────────────────────────────

  /**
   * @description Opens a section of the left menu.
   * @param section Section.
   */
  openSection(section: PortalSection): void {
    this.router.navigate(['/projects', this.token, section]);
  }

  /**
   * @description Opens a conversation in Communication (from a news item or a file).
   * @param thread Thread of the list, or a stub with its id and subject.
   */
  openThreadInCommunication(thread: ProjectThread): void {
    this.requestedThread.set(thread);
    this.openSection('threads');
  }

  // ── Conversations ─────────────────────────────────────────────────────

  /** @description Loads the thread list. */
  loadThreads(): void {
    this.get<ProjectThread[]>(this.path('threads'))
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (threads) => this.threads.set(threads), error: () => {} });
  }

  /**
   * @description Sets the unread count of a thread of the list to 0 (the thread was opened).
   * @param id Thread id.
   */
  markThreadRead(id: number): void {
    this.threads.update(list => list.map(t => (t.id === id && t.unread_count ? { ...t, unread_count: 0 } : t)));
  }

  /**
   * @description Copies the status of an open thread to the list.
   * @param id Thread id.
   * @param status New status.
   */
  setThreadStatus(id: number, status: string): void {
    this.threads.update(list => list.map(t => (t.id === id ? { ...t, status } : t)));
  }

  /**
   * @description While the client is signed in, silently reloads the thread list every 15 s - the
   *   unread badges update in every section. The open thread keeps 0 (its own polling shows its
   *   messages). A failed poll is skipped silently; a 401 opens the login and stops the polling.
   */
  private startGlobalThreadsPolling(): void {
    this.stopGlobalPolling$.next();
    timer(PORTAL_POLL_INTERVAL_MS, PORTAL_POLL_INTERVAL_MS).pipe(
      // A failed poll is skipped - the next one tries again (a 401 has stopped the polling).
      switchMap(() => this.get<ProjectThread[]>(this.path('threads')).pipe(catchError(() => EMPTY))),
      takeUntil(this.stopGlobalPolling$),
      takeUntil(this.destroy$)
    ).subscribe(threads => {
      this.threads.set(this.openThreadId === null ? threads : threads.map(t => (t.id === this.openThreadId ? { ...t, unread_count: 0 } : t)));
    });
  }

  // ── What is new ───────────────────────────────────────────────────────

  /** @description Loads "What is new" with the number of unseen items. */
  loadActivity(): void {
    if (!this.hasSession) return;
    this.activityLoading.set(true);
    this.getWithMeta<PortalActivityItem[], { unseen: number }>(this.path('activity'))
      .pipe(finalize(() => this.activityLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.activity.set(Array.isArray(res.data) ? res.data : []);
          this.activityUnseen.set(res.meta?.unseen ?? 0);
          if (this.overviewOpen && this.activityUnseen() > 0) this.markActivitySeen();
        },
        error: () => { /* the overview shows no news */ },
      });
  }

  /**
   * @description The client has seen the news (the overview is open): the badge goes away, the
   *   items stay highlighted while the overview stays open (leaving it clears them).
   */
  markActivitySeen(): void {
    if (!this.hasSession || this.activityUnseen() === 0) return;
    this.activityUnseen.set(0);
    this.post(this.path('activity/seen'), {}).pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
  }

  /** @description Removes the "new" highlight of all news items. */
  clearNewHighlight(): void {
    if (!this.activity().some(item => item.is_new)) return;
    this.activity.update(items => items.map(item => (item.is_new ? { ...item, is_new: false } : item)));
  }

  // ── Approvals, updates, files, company data ──────────────────────────

  /** @description Loads the approval requests (pending first). */
  loadApprovals(): void {
    if (!this.hasSession) return;
    this.approvalsLoading.set(true);
    this.get<PortalApproval[]>(this.path('approvals'))
      .pipe(finalize(() => this.approvalsLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({ next: (rows) => this.approvals.set(Array.isArray(rows) ? rows : []), error: () => {} });
  }

  /** @description Loads the published updates of the supplier. */
  loadUpdates(): void {
    if (!this.hasSession) return;
    this.updatesLoading.set(true);
    this.get<PortalUpdate[]>(this.path('updates'))
      .pipe(finalize(() => this.updatesLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({ next: (rows) => this.updates.set(Array.isArray(rows) ? rows : []), error: () => {} });
  }

  /** @description Loads the files of the project (newest first, fresh signed links). */
  loadFiles(): void {
    if (!this.hasSession) return;
    this.filesLoading.set(true);
    this.filesError.set(false);
    this.get<PortalFile[]>(this.path('files'))
      .pipe(finalize(() => this.filesLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: (files) => this.files.set(Array.isArray(files) ? files : []),
        error: () => this.filesError.set(true),
      });
  }

  /** @description Loads the company data of the supplier once (public site settings). */
  loadCompanySettings(): void {
    if (this.companySettings() || this.companySettingsLoading()) return;
    this.companySettingsLoading.set(true);
    this.api.getSiteSettings()
      .pipe(finalize(() => this.companySettingsLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => this.companySettings.set(res?.settings ?? null),
        error: () => this.companySettings.set(null),
      });
  }

  /**
   * @description Expands / collapses the description of a step.
   * @param id Checkpoint id.
   */
  toggleCheckpoint(id: number): void {
    this.expandedCheckpointIds.update(ids => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
}
