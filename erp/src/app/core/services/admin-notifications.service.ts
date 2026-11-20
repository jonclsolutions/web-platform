/**
 * @file admin-notifications.service.ts
 * @path src/app/core/services/admin-notifications.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Notifications of the administration: the numbers of unread records the signed-in
 *   admin has in every kind (new inquiries, job applications, orders, products under their stock
 *   limit, overdue leads, security events …) - `core/notifications`, counted by the API as what
 *   came after the admin's last look at the kind. The side menu shows a number at the page of a
 *   kind, the module switcher the totals of the modules. The service asks every minute while the
 *   tab is visible (a hidden tab does not ask; it asks at once when it becomes visible again),
 *   quietly (no error dialog on a failure). Opening the page of a kind (or clicking its menu
 *   item) marks the kind as seen. When a number grows, a notice pops up top right (toast; a click
 *   opens the page) - the admin can switch the notices off in this browser (personal info page).
 * @usage AdminLayoutComponent calls start() while a user is signed in and stop() otherwise.
 * @dependencies DataHandler (getQuietly / postQuietly), Router, AlertDialogService,
 *   AdminLocalizationService (section `notifications`).
 */

import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Subscription, distinctUntilChanged, filter, fromEvent, map, startWith, switchMap, timer } from 'rxjs';
import { DataHandler } from './data-handler.service';
import { AlertDialogService } from './alert-dialog.service';
import { AdminLocalizationService } from './admin-localization.service';

/** One kind of records with the number of unread ones (`core/notifications`). */
export interface NotificationKind {
  /** Key of the kind, e.g. web_inquiries. */
  kind: string;
  /** Module of the kind ('core' or an application id). */
  module: string;
  /** Admin page of the records, e.g. /admin/web/user-request. */
  link: string;
  /** Unread records. */
  count: number;
}

/** Answer of `core/notifications` and `core/notifications/seen`. */
interface NotificationsAnswer {
  kinds: NotificationKind[];
  checked_at: string;
}

/** How often the counts are asked for while the tab is visible. */
export const NOTIFICATIONS_POLL_MS = 60_000;
/** Highest number shown in a badge; more shows as "99+". */
export const NOTIFICATIONS_BADGE_MAX = 99;
/** Browser storage key of the "pop-up notices" choice ('off' = switched off). */
export const NOTIFICATION_TOASTS_STORAGE_KEY = 'admin_notification_toasts';

@Injectable({ providedIn: 'root' })
export class AdminNotificationsService {
  private readonly dataHandler = inject(DataHandler);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertDialogService);
  private readonly i18n = inject(AdminLocalizationService);

  /** Kinds the signed-in admin may see, with their unread counts (empty until the first answer). */
  readonly kinds = signal<NotificationKind[]>([]);
  /** Pop-up notices are on in this browser. */
  readonly toastsEnabled = signal<boolean>(AdminNotificationsService.readToastsChoice());

  private subscription: Subscription | null = null;
  /** The first answer arrived (its counts are the start - no notices for them). */
  private loaded = false;
  /** A poll is running (the next tick is skipped). */
  private polling = false;
  /** Number of the newest request / local change - an older answer arriving later is ignored. */
  private sequence = 0;

  /**
   * @description Starts asking (now and every minute while the tab is visible) and marking the
   *   kinds of opened pages as seen. Calling it again does nothing.
   */
  start(): void {
    if (this.subscription) return;
    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => !document.hidden),
      distinctUntilChanged()
    );
    this.subscription = visible$
      .pipe(switchMap(visible => (visible ? timer(0, NOTIFICATIONS_POLL_MS) : EMPTY)))
      .subscribe(() => this.refresh());
    this.subscription.add(this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => this.markSeenAt(event.urlAfterRedirects)));
  }

  /** @description Stops asking and forgets the counts (sign-out, leaving the administration). */
  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.sequence++;
    this.loaded = false;
    this.polling = false;
    this.kinds.set([]);
  }

  /** @description Asks for the counts now (quietly; skipped while another poll runs). */
  refresh(): void {
    if (this.polling) return;
    const sequence = ++this.sequence;
    this.polling = true;
    this.dataHandler.getQuietly<NotificationsAnswer>('core/notifications').subscribe({
      next: answer => {
        this.polling = false;
        if (sequence === this.sequence) this.apply(answer?.kinds ?? [], true);
      },
      error: () => (this.polling = false),
    });
  }

  /**
   * @description Unread records of the admin page with this link.
   * @param link Admin page, e.g. /admin/web/user-request.
   */
  countFor(link: string): number {
    return this.kinds().filter(k => k.link === link).reduce((sum, k) => sum + k.count, 0);
  }

  /**
   * @description Unread records of a module ('core' or an application id).
   * @param module Module id.
   */
  moduleTotal(module: string): number {
    return this.kinds().filter(k => k.module === module).reduce((sum, k) => sum + k.count, 0);
  }

  /** @description Unread records of all applications (every module but the core). */
  appsTotal(): number {
    return this.kinds().filter(k => k.module !== 'core').reduce((sum, k) => sum + k.count, 0);
  }

  /**
   * @description Text of a badge: the number, "99+" above NOTIFICATIONS_BADGE_MAX, null for 0.
   * @param count Unread records.
   */
  badge(count: number): string | null {
    if (count <= 0) return null;
    return count > NOTIFICATIONS_BADGE_MAX ? `${NOTIFICATIONS_BADGE_MAX}+` : String(count);
  }

  /**
   * @description The admin clicked the menu item of a page: its kinds are seen (also when the
   *   page is already open - the router does not navigate to the same address again).
   * @param link Admin page.
   */
  markSeenLink(link: string): void {
    this.markSeen(this.kinds().filter(k => k.count > 0 && k.link === link).map(k => k.kind));
  }

  /**
   * @description Switches the pop-up notices on / off in this browser.
   * @param enabled On.
   */
  setToastsEnabled(enabled: boolean): void {
    this.toastsEnabled.set(enabled);
    try {
      localStorage.setItem(NOTIFICATION_TOASTS_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      /* storage unavailable (private mode) - the choice holds until the page is reloaded */
    }
  }

  /**
   * @description Takes over an answer: pops up a notice for every kind whose number grew since
   *   the last answer (not for the first answer and not for the answer of a "seen"), then marks
   *   the kinds of the page that is open as seen (after the first answer).
   * @param kinds Kinds of the answer.
   * @param fromPoll The answer of a poll (a "seen" answer never pops up notices).
   */
  private apply(kinds: NotificationKind[], fromPoll: boolean): void {
    const previous = new Map(this.kinds().map(k => [k.kind, k.count]));
    const first = !this.loaded;
    this.loaded = true;
    this.kinds.set(kinds);
    if (fromPoll && !first && this.toastsEnabled()) {
      kinds.filter(k => k.count > (previous.get(k.kind) ?? 0)).forEach(k => this.notify(k));
    }
    if (first) this.markSeenAt(this.router.url);
  }

  /**
   * @description Marks the kinds of the page at this address as seen (its own records and the
   *   records of its sub-pages).
   * @param url Address of the page (query and fragment ignored).
   */
  private markSeenAt(url: string): void {
    const path = url.split(/[?#]/)[0];
    this.markSeen(this.kinds()
      .filter(k => k.count > 0 && (path === k.link || path.startsWith(k.link + '/')))
      .map(k => k.kind));
  }

  /**
   * @description Clears the numbers of the kinds at once and tells the API; the fresh answer is
   *   taken over (without notices). A failure is quiet - the next poll shows the numbers again.
   * @param kinds Kind keys.
   */
  private markSeen(kinds: string[]): void {
    if (!kinds.length) return;
    const sequence = ++this.sequence;
    this.kinds.update(list => list.map(k => (kinds.includes(k.kind) ? { ...k, count: 0 } : k)));
    this.dataHandler.postQuietly<NotificationsAnswer>('core/notifications/seen', { kinds }).subscribe({
      next: answer => {
        if (sequence === this.sequence) this.apply(answer?.kinds ?? [], false);
      },
      error: () => {},
    });
  }

  /**
   * @description Pops up the notice of a kind; a click opens its page.
   * @param kind Kind whose number grew.
   */
  private notify(kind: NotificationKind): void {
    const titleKey = `notifications.kind_${kind.kind}`;
    const title = this.i18n.getValue(titleKey);
    const message = this.i18n.getValue('notifications.toast_message').replace('{count}', String(kind.count));
    this.alert.open(title && title !== titleKey ? title : this.i18n.getValue('notifications.kind_generic'), message, 'info',
      () => this.router.navigateByUrl(kind.link));
  }

  /** @description The "pop-up notices" choice of this browser (on unless switched off). */
  private static readToastsChoice(): boolean {
    try {
      return localStorage.getItem(NOTIFICATION_TOASTS_STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  }
}
