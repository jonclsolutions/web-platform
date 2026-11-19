/**
 * @file portal-session.service.spec.ts
 * @path src/app/apps/project-portal/public/portal-session.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalSessionService (state of one portal session): start (threads,
 *   news, approvals), requests without the admin session, a 401 opening the login, the 15 s
 *   polling of the thread list (the open thread stays read), refresh, logout, "What is new"
 *   (seen at once on the overview, highlight), loaders of approvals / updates / files / company
 *   data, expanded steps and the navigation between sections.
 * @dependencies portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { PortalTestContext, failWith, setUpPortal, testProject, testThreads } from './portal.testing';

describe('PortalSessionService', () => {
  let ctx: PortalTestContext;

  /**
   * @description start() loads the threads, the news and the approvals of the project; the
   *   derived numbers follow; every request skips the admin session (the stub throws otherwise).
   * @input started session; activity with 2 unseen; approvals (1 pending).
   * @output project 'Web'; threads 2, unread 3, waiting on you 1; activityUnseen 2; pending 1;
   *   progress {1, 3, 33}; paths projects/public/tok/…
   */
  it('starts with the project, the threads, the news and the approvals', fakeAsync(() => {
    ctx = setUpPortal({ start: false });
    ctx.replies['/tok/activity'] = () => of({ data: [{ type: 'reply', is_new: true }], meta: { unseen: 2 } });
    ctx.replies['/tok/approvals'] = () => of([{ id: 4, status: 'pending' }, { id: 3, status: 'approved' }]);
    ctx.session.start('tok', testProject());
    expect(ctx.session.active).toBeTrue();
    expect(ctx.session.project()!.name).toBe('Web');
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/threads');
    expect(ctx.getWithMeta).toHaveBeenCalledWith('projects/public/tok/activity');
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/approvals');
    expect([ctx.session.threads().length, ctx.session.totalUnreadCount(), ctx.session.waitingOnYouCount()]).toEqual([2, 3, 1]);
    expect(ctx.session.activityUnseen()).toBe(2);
    expect(ctx.session.pendingApprovalsCount()).toBe(1);
    expect(ctx.session.checkpointProgress()).toEqual({ done: 1, total: 3, percent: 33 });
    expect(ctx.session.path()).toBe('projects/public/tok');
    expect(ctx.session.path('files')).toBe('projects/public/tok/files');
    ctx.session.project.set(null);
    expect(ctx.session.checkpointProgress()).toEqual({ done: 0, total: 0, percent: 0 });
    discardPeriodicTasks();
  }));

  /**
   * @description The thread list is polled every 15 s; the open thread keeps 0 unread; errors are
   *   silent; a 401 (session ended) opens the login of the project and stops the polling.
   * @input open thread 1; poll with unread 5 for thread 1; failing poll (500); poll answering 401.
   * @output thread 1 unread 0, total 1; still active; navigate(['/projects/login', 'tok'], replaceUrl), inactive, no more polls.
   */
  it('polls the thread list and leaves on an ended session', fakeAsync(() => {
    ctx = setUpPortal();
    ctx.session.openThreadId = 1;
    ctx.replies['/tok/threads'] = () => of([{ ...testThreads()[0], unread_count: 5 }, testThreads()[1]]);
    tick(15000);
    expect(ctx.session.threads()[0].unread_count).toBe(0);
    expect(ctx.session.totalUnreadCount()).toBe(1);

    ctx.replies['/tok/threads'] = failWith(500);
    tick(15000);
    expect(ctx.session.active).toBeTrue();
    expect(ctx.navigate).not.toHaveBeenCalled();

    ctx.replies['/tok/threads'] = failWith(401);
    tick(15000);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects/login', 'tok'], { replaceUrl: true });
    expect(ctx.session.active).toBeFalse();
    ctx.get.calls.reset();
    tick(30000);
    expect(ctx.get).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Any request answering 401 opens the login (the error still reaches the caller).
   * @input post answering 401.
   * @output navigate to the login; the subscriber's error handler runs.
   */
  it('opens the login on any 401', fakeAsync(() => {
    ctx = setUpPortal();
    ctx.replies['/tok/account'] = failWith(401);
    let failed = false;
    ctx.session.post(ctx.session.path('account'), {}).subscribe({ error: () => (failed = true) });
    expect(failed).toBeTrue();
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects/login', 'tok'], { replaceUrl: true });
    discardPeriodicTasks();
  }));

  /**
   * @description Refresh reloads the project, threads, news and approvals and tells the open
   *   section (refreshed$); not twice at once; a failure opens the login; no session → nothing.
   * @input refresh ok; refresh failing; refresh after the login opened.
   * @output GET project + threads, refreshed$ once, refreshing false; login; no request.
   */
  it('refreshes the portal data', fakeAsync(() => {
    ctx = setUpPortal();
    let refreshed = 0;
    ctx.session.refreshed$.subscribe(() => refreshed++);
    ctx.get.calls.reset();
    ctx.session.refresh();
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok');
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/threads');
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/approvals');
    expect(ctx.getWithMeta).toHaveBeenCalledWith('projects/public/tok/activity');
    expect(refreshed).toBe(1);
    expect(ctx.session.refreshing()).toBeFalse();

    ctx.session.refreshing.set(true);
    ctx.get.calls.reset();
    ctx.session.refresh();
    expect(ctx.get).not.toHaveBeenCalled();
    ctx.session.refreshing.set(false);

    ctx.replies['/tok'] = failWith(500);
    ctx.session.refresh();
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects/login', 'tok'], { replaceUrl: true });
    ctx.get.calls.reset();
    ctx.session.refresh();
    expect(ctx.get).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Logout ends the session on the API (also when that fails) and clears the
   *   state; without a session it only opens the login.
   * @input logout ok; new session with a failing logout; logout again.
   * @output post('…/logout'); project null, threads [], expanded steps empty; login opened.
   */
  it('logs out', fakeAsync(() => {
    ctx = setUpPortal();
    ctx.session.toggleCheckpoint(1);
    ctx.session.logout();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/logout', {});
    expect(ctx.session.project()).toBeNull();
    expect(ctx.session.threads()).toEqual([]);
    expect(ctx.session.expandedCheckpointIds().size).toBe(0);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects/login', 'tok'], { replaceUrl: true });

    ctx.post.calls.reset();
    ctx.session.logout();
    expect(ctx.post).not.toHaveBeenCalled();

    ctx.session.start('tok', testProject());
    ctx.replies['/tok/logout'] = failWith(500);
    ctx.session.logout();
    expect(ctx.session.project()).toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description "What is new": seen at once while the overview is open (badge 0, post once);
   *   the highlight stays until clearNewHighlight(); nothing to clear = same array.
   * @input overview open, activity with 1 unseen; markActivitySeen again; clearNewHighlight twice.
   * @output post('…/activity/seen') once; unseen 0; is_new false after clearing; unchanged array.
   */
  it('marks the news as seen on the overview', fakeAsync(() => {
    ctx = setUpPortal({ start: false });
    ctx.replies['/tok/activity'] = () => of({ data: [{ type: 'reply', is_new: true }, { type: 'update', is_new: false }], meta: { unseen: 1 } });
    ctx.replies['/activity/seen'] = () => of({});
    ctx.session.overviewOpen = true;
    ctx.session.start('tok', testProject());
    expect(ctx.post).toHaveBeenCalledOnceWith('projects/public/tok/activity/seen', {});
    expect(ctx.session.activityUnseen()).toBe(0);
    ctx.session.markActivitySeen();
    expect(ctx.post).toHaveBeenCalledTimes(1);
    expect(ctx.session.activity()[0].is_new).toBeTrue();
    ctx.session.clearNewHighlight();
    expect(ctx.session.activity().some(i => i.is_new)).toBeFalse();
    const items = ctx.session.activity();
    ctx.session.clearNewHighlight();
    expect(ctx.session.activity()).toBe(items);
    discardPeriodicTasks();
  }));

  /**
   * @description Loaders of the sections: updates, files (error flag), company data once (null on
   *   error); nothing is loaded without a session.
   * @input loadUpdates, loadFiles ok / failing, loadCompanySettings ×2, failing settings; logout + loaders.
   * @output lists set; filesError true; getSiteSettings once, {RPSW}; null; no request.
   */
  it('loads the data of the sections', fakeAsync(() => {
    ctx = setUpPortal();
    ctx.replies['/tok/updates'] = () => of([{ id: 2, title: 'Week 2' }]);
    ctx.session.loadUpdates();
    expect(ctx.session.updates().map(u => u.id)).toEqual([2]);
    expect(ctx.session.updatesLoading()).toBeFalse();
    ctx.session.loadFiles();
    expect(ctx.session.files().map(f => f.id)).toEqual([7, 6]);
    ctx.replies['/tok/files'] = failWith(500);
    ctx.session.loadFiles();
    expect(ctx.session.filesError()).toBeTrue();
    expect(ctx.session.filesLoading()).toBeFalse();

    ctx.session.loadCompanySettings();
    ctx.session.loadCompanySettings();
    expect(ctx.getSiteSettings).toHaveBeenCalledTimes(1);
    expect(ctx.session.companySettings()).toEqual({ company_name: 'RPSW' });
    ctx.session.companySettings.set(null);
    ctx.getSiteSettings.and.returnValue(failWith(500)());
    ctx.session.loadCompanySettings();
    expect(ctx.session.companySettings()).toBeNull();
    expect(ctx.session.companySettingsLoading()).toBeFalse();

    ctx.session.logout();
    ctx.get.calls.reset();
    ctx.session.loadFiles();
    ctx.session.loadUpdates();
    ctx.session.loadApprovals();
    expect(ctx.get).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Steps expand and collapse; thread changes reach the list; sections and threads
   *   open through the router.
   * @input toggleCheckpoint(1) ×2; markThreadRead(1); setThreadStatus(2, 'closed'); openSection; openThreadInCommunication.
   * @output {1} then {}; unread 0; status closed; navigate(['/projects', 'tok', …]); requestedThread set.
   */
  it('keeps the state of the sections and navigates', fakeAsync(() => {
    ctx = setUpPortal();
    ctx.session.toggleCheckpoint(1);
    expect([...ctx.session.expandedCheckpointIds()]).toEqual([1]);
    ctx.session.toggleCheckpoint(1);
    expect(ctx.session.expandedCheckpointIds().size).toBe(0);

    ctx.session.markThreadRead(1);
    ctx.session.setThreadStatus(2, 'closed');
    expect(ctx.session.threads().map(t => [t.unread_count, t.status])).toEqual([[0, 'active'], [1, 'closed']]);

    ctx.session.openSection('files');
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'files']);
    const thread = ctx.session.threads()[1];
    ctx.session.openThreadInCommunication(thread);
    expect(ctx.session.requestedThread()).toBe(thread);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'threads']);
    TestBed.resetTestingModule();
    discardPeriodicTasks();
  }));

  /**
   * @description One browser holds one session per project: when the tab becomes active again
   *   (focus / visible) the portal asks who is signed in - the same account changes nothing,
   *   another account (signed in in another tab) replaces the project and the sections reload,
   *   no session opens the login; events closer than 1 s ask once.
   * @input focus (same account); visibilitychange 2 s later with account 6; focus with 401.
   * @output GET of the project, refreshed$ not emitted; account 6, threads reloaded, refreshed$ once;
   *   login opened; two quick focus events → one request.
   */
  it('follows the account signed in in another tab', fakeAsync(() => {
    ctx = setUpPortal();
    let refreshed = 0;
    ctx.session.refreshed$.subscribe(() => refreshed++);
    ctx.get.calls.reset();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    expect(ctx.get.calls.allArgs().filter((a: any[]) => a[0] === 'projects/public/tok').length).toBe(1);
    expect(refreshed).toBe(0);

    tick(2000);
    ctx.replies['/tok'] = () => of({ ...testProject(), account: { id: 6, username: 'petr', display_name: 'Petr' } });
    ctx.get.calls.reset();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.session.project()!.account!.id).toBe(6);
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/threads');
    expect(refreshed).toBe(1);

    tick(2000);
    ctx.replies['/tok'] = failWith(401);
    window.dispatchEvent(new Event('focus'));
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects/login', 'tok'], { replaceUrl: true });
    expect(ctx.session.active).toBeFalse();
    discardPeriodicTasks();
  }));
});
