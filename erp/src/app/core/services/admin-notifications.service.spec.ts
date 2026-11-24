/**
 * @file admin-notifications.service.spec.ts
 * @path src/app/core/services/admin-notifications.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminNotificationsService - polling of `core/notifications` (now and
 *   every minute, only while the tab is visible), the first answer as the start (no notices),
 *   notices when a number grows (title per kind, click opens the page, off in this browser),
 *   marking the kinds of an opened page / a clicked menu item as seen, an older answer arriving
 *   after a newer change is ignored, badge texts and totals.
 * @dependencies
 * - DataHandler, Router, AlertDialogService, AdminLocalizationService - all mocked.
 */

import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { DataHandler } from './data-handler.service';
import { AlertDialogService } from './alert-dialog.service';
import { AdminLocalizationService } from './admin-localization.service';
import {
  AdminNotificationsService, NotificationKind, NOTIFICATIONS_POLL_MS, NOTIFICATION_TOASTS_STORAGE_KEY,
} from './admin-notifications.service';

describe('AdminNotificationsService', () => {
  let service: AdminNotificationsService;
  let polls: Subject<any>[];
  let dataHandler: { getQuietly: jasmine.Spy; postQuietly: jasmine.Spy };
  let alert: { open: jasmine.Spy };
  let router: { url: string; events: Subject<any>; navigateByUrl: jasmine.Spy };
  let hidden: boolean;

  const TEXTS: Record<string, string> = {
    'notifications.kind_web_inquiries': 'Nové poptávky',
    'notifications.kind_web_texts_missing': 'Chybějící texty webu',
    'notifications.kind_generic': 'Nové záznamy',
    'notifications.toast_message': 'Nepřečtené: {count}.',
    'notifications.attention_toast_message': 'Vyžaduje vaši pozornost: {count}. Kliknutím otevřete stránku.',
  };

  const kind = (name: string, count: number, link = `/admin/web/${name}`, module = 'web'): NotificationKind =>
    ({ kind: name, module, link, count });
  const answer = (...kinds: NotificationKind[]) => ({ kinds, checked_at: '2026-11-20T10:00:00+01:00' });

  /** Answers the oldest pending poll. */
  const respond = (...kinds: NotificationKind[]) => {
    const poll = polls.shift()!;
    poll.next(answer(...kinds));
    poll.complete();
  };

  beforeEach(() => {
    try { localStorage.removeItem(NOTIFICATION_TOASTS_STORAGE_KEY); } catch { /* no storage */ }
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    polls = [];
    dataHandler = {
      getQuietly: jasmine.createSpy('getQuietly').and.callFake(() => {
        const poll = new Subject<any>();
        polls.push(poll);
        return poll;
      }),
      postQuietly: jasmine.createSpy('postQuietly').and.callFake((_url: string, body: { kinds: string[] }) =>
        of(answer(...service.kinds().map(k => (body.kinds.includes(k.kind) ? { ...k, count: 0 } : k))))),
    };
    alert = { open: jasmine.createSpy('open').and.returnValue(Promise.resolve()) };
    router = { url: '/admin/core/dashboard', events: new Subject<any>(), navigateByUrl: jasmine.createSpy('navigateByUrl') };
    TestBed.configureTestingModule({
      providers: [
        { provide: DataHandler, useValue: dataHandler },
        { provide: AlertDialogService, useValue: alert },
        { provide: Router, useValue: router },
        { provide: AdminLocalizationService, useValue: { getValue: (path: string) => TEXTS[path] ?? path, getDateLocale: () => 'cs-CZ' } },
      ],
    });
    service = TestBed.inject(AdminNotificationsService);
  });

  afterEach(() => {
    service.stop();
    delete (document as any).hidden;
    try { localStorage.removeItem(NOTIFICATION_TOASTS_STORAGE_KEY); } catch { /* no storage */ }
  });

  /**
   * @description Asks at once and then every minute; the first answer is the start - its counts
   *   show, but no notice pops up.
   * @input start(); answer inquiries 2; 60 s pass.
   * @output 1 request at start, counts set, no notice; a 2nd request after a minute.
   */
  it('polls now and every minute; the first answer pops up nothing', fakeAsync(() => {
    service.start();
    tick();
    expect(dataHandler.getQuietly).toHaveBeenCalledOnceWith('core/notifications');
    respond(kind('user-request', 2));
    expect(service.badgeFor('/admin/web/user-request')).toEqual({ text: '2', attention: false, label: 'Nové záznamy: 2' });
    expect(alert.open).not.toHaveBeenCalled();
    tick(NOTIFICATIONS_POLL_MS);
    expect(dataHandler.getQuietly).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));

  /**
   * @description A number that grew pops up a notice titled by its kind (unknown kind: the generic
   *   title); a click opens the page of the kind. Numbers that did not grow pop up nothing.
   * @input first answer inquiries 1, orders 3; next inquiries 2, orders 3, unknown kind 1.
   * @output 2 notices: "Nové poptávky" / "Nepřečtené: 2." and "Nové záznamy"; the action of the
   *   first navigates to /admin/web/user-request.
   */
  it('pops up a notice for every number that grew', fakeAsync(() => {
    service.start();
    tick();
    respond(kind('web_inquiries', 1, '/admin/web/user-request'), kind('shop_orders', 3, '/admin/shop/orders', 'shop'));
    tick(NOTIFICATIONS_POLL_MS);
    respond(kind('web_inquiries', 2, '/admin/web/user-request'), kind('shop_orders', 3, '/admin/shop/orders', 'shop'),
      kind('new_kind', 1, '/admin/web/other'));
    expect(alert.open).toHaveBeenCalledTimes(2);
    const [title, message, type, action] = alert.open.calls.argsFor(0);
    expect([title, message, type]).toEqual(['Nové poptávky', 'Nepřečtené: 2.', 'info']);
    action();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/web/user-request');
    expect(alert.open.calls.argsFor(1)[0]).toBe('Nové záznamy');
    discardPeriodicTasks();
  }));

  /**
   * @description Notices switched off in this browser: no notice, the numbers still show; the
   *   choice is stored and read by a new instance.
   * @input setToastsEnabled(false); first answer 1, next answer 4.
   * @output storage 'off'; no notice; count 4.
   */
  it('pops up nothing while the notices are off', fakeAsync(() => {
    service.setToastsEnabled(false);
    expect(localStorage.getItem(NOTIFICATION_TOASTS_STORAGE_KEY)).toBe('off');
    service.start();
    tick();
    respond(kind('web_inquiries', 1));
    tick(NOTIFICATIONS_POLL_MS);
    respond(kind('web_inquiries', 4));
    expect(alert.open).not.toHaveBeenCalled();
    expect(service.moduleBadge('web')?.text).toBe('4');
    discardPeriodicTasks();
  }));

  /**
   * @description The page that is open when the first answer comes, a later navigation (to the
   *   page or its sub-page, query ignored) and a click on a menu item mark the kinds as seen: the
   *   number is 0 at once and the API is told.
   * @input url = inquiries page; answer inquiries 2, applications 1, orders 5; navigation to
   *   /admin/web/job-applications/7?tab=a; markSeenLink(orders).
   * @output seen [web_inquiries], then [web_job_applications], then [shop_orders]; all 0.
   */
  it('marks the kinds of an opened page and of a clicked menu item as seen', fakeAsync(() => {
    router.url = '/admin/web/user-request?page=2';
    service.start();
    tick();
    respond(kind('web_inquiries', 2, '/admin/web/user-request'), kind('web_job_applications', 1, '/admin/web/job-applications'),
      kind('shop_orders', 5, '/admin/shop/orders', 'shop'));
    expect(dataHandler.postQuietly).toHaveBeenCalledWith('core/notifications/seen', { kinds: ['web_inquiries'] });
    expect(service.badgeFor('/admin/web/user-request')).toBeNull();

    router.events.next(new NavigationEnd(1, '/admin/web/job-applications/7?tab=a', '/admin/web/job-applications/7?tab=a'));
    expect(dataHandler.postQuietly).toHaveBeenCalledWith('core/notifications/seen', { kinds: ['web_job_applications'] });

    service.markSeenLink('/admin/shop/orders');
    expect(dataHandler.postQuietly).toHaveBeenCalledWith('core/notifications/seen', { kinds: ['shop_orders'] });
    expect(service.navBadge(service.kinds().filter(k => k.module !== 'core'))).toBeNull();
    expect(dataHandler.postQuietly).toHaveBeenCalledTimes(3);
    discardPeriodicTasks();
  }));

  /**
   * @description Attention kinds (texts missing in a language): an orange dot without a number
   *   (also next to the red number of unread records - it never gets lost), the label names the
   *   kinds with counts and the languages; never marked as seen by opening the page; a grown
   *   number pops up a warning notice.
   * @input url = text editor page; answer web_texts_missing 3 (en 2, cz 1, attention) + inquiries
   *   0; then inquiries 2; then texts 5 and inquiries 0.
   * @output page and module: no number, dot, label 'Chybějící texty webu: 3 (angličtina 2,
   *   čeština 1)', no seen request; module red '2' + dot, label of both; notice type 'warning'.
   */
  it('shows attention kinds in orange and never marks them as seen', fakeAsync(() => {
    router.url = '/admin/web/edit-website';
    service.start();
    tick();
    const texts = (count: number) => ({ ...kind('web_texts_missing', count, '/admin/web/edit-website'), attention: true, languages: { cz: 1, en: count - 1 } });
    respond(texts(3), kind('web_inquiries', 0, '/admin/web/user-request'));
    const missingLabel = 'Chybějící texty webu: 3 (angličtina 2, čeština 1)';
    expect(service.badgeFor('/admin/web/edit-website')).toEqual({ text: null, attention: true, label: missingLabel });
    expect(service.moduleBadge('web')).toEqual({ text: null, attention: true, label: missingLabel });
    service.markSeenLink('/admin/web/edit-website');
    expect(dataHandler.postQuietly).not.toHaveBeenCalled();

    tick(NOTIFICATIONS_POLL_MS);
    respond(texts(3), kind('web_inquiries', 2, '/admin/web/user-request'));
    expect(service.moduleBadge('web')).toEqual({ text: '2', attention: true, label: `${missingLabel} · Nové poptávky: 2` });
    expect(service.badgeForLinks(['/admin/web/user-request'])).toEqual({ text: '2', attention: false, label: 'Nové poptávky: 2' });

    tick(NOTIFICATIONS_POLL_MS);
    alert.open.calls.reset();
    respond(texts(5), kind('web_inquiries', 0, '/admin/web/user-request'));
    expect(alert.open).toHaveBeenCalledTimes(1);
    const [, message, type] = alert.open.calls.argsFor(0);
    expect([message, type]).toEqual(['Vyžaduje vaši pozornost: 5. Kliknutím otevřete stránku.', 'warning']);
    discardPeriodicTasks();
  }));

  /**
   * @description A poll answer that arrives after a newer "seen" is ignored (it would bring back
   *   the number the user has just cleared).
   * @input first answer inquiries 2; next poll pending; markSeenLink(inquiries); the pending poll
   *   answers inquiries 2.
   * @output count stays 0, no notice.
   */
  it('ignores a poll answer older than a seen', fakeAsync(() => {
    service.start();
    tick();
    respond(kind('web_inquiries', 2, '/admin/web/user-request'));
    tick(NOTIFICATIONS_POLL_MS);
    service.markSeenLink('/admin/web/user-request');
    respond(kind('web_inquiries', 3, '/admin/web/user-request'));
    expect(service.badgeFor('/admin/web/user-request')).toBeNull();
    expect(alert.open).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description A hidden tab does not ask; it asks at once when it becomes visible again.
   * @input hidden tab; start(); 3 minutes pass; tab visible.
   * @output no request while hidden; 1 request after visibilitychange.
   */
  it('asks only while the tab is visible', fakeAsync(() => {
    hidden = true;
    service.start();
    tick();
    tick(3 * NOTIFICATIONS_POLL_MS);
    expect(dataHandler.getQuietly).not.toHaveBeenCalled();
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    tick();
    expect(dataHandler.getQuietly).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  /**
   * @description stop() ends the polling and forgets the counts.
   * @input start(); answer 3; stop(); 2 minutes pass.
   * @output kinds []; still 1 request.
   */
  it('stop() ends the polling and clears the counts', fakeAsync(() => {
    service.start();
    tick();
    respond(kind('web_inquiries', 3));
    service.stop();
    tick(2 * NOTIFICATIONS_POLL_MS);
    expect(service.kinds()).toEqual([]);
    expect(dataHandler.getQuietly).toHaveBeenCalledTimes(1);
  }));

  /**
   * @description Badge text: nothing for 0, the number, "99+" above 99.
   * @input 0, 7, 99, 100, 2500.
   * @output null, '7', '99', '99+', '99+'.
   */
  it('formats badges', () => {
    expect([0, 7, 99, 100, 2500].map(n => service.badge(n))).toEqual([null, '7', '99', '99+', '99+']);
  });
});
