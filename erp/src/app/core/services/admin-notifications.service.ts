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
 * @note Attention kinds (`attention: true`, e.g. texts missing in a language) are a current state
 *   that needs work, not unread records: opening the page does not clear them (they drop when
 *   the work is done) and their notice is a warning. A badge (2026-11) shows the red NUMBER of
 *   unread records only; attention is an orange DOT next to it - at the page, the section, the
 *   module and the module switcher, so it never gets lost. Its label (tooltip + screen reader)
 *   names every kind behind it with its count, texts missing per language ("Chybějící texty
 *   webu: 123 (angličtina 120, čeština 3)").
 * @note A switched off language being prepared (`preparing` of an attention kind: what it still
 *   lacks - visitors do not see it, so it is not in the count) gives a GREY dot on the same
 *   places, only when nothing is orange; the label says "vypnuté jazyky: polština 14".
 * @usage AdminLayoutComponent calls start() while a user is signed in and stop() otherwise.
 * @dependencies DataHandler (getQuietly / postQuietly), Router, AlertDialogService,
 *   AdminLocalizationService (section `notifications`, the admin locale for language names),
 *   language-url (`cz` -> `cs` for Intl language names).
 */

import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, Subscription, distinctUntilChanged, filter, fromEvent, map, startWith, switchMap, timer } from 'rxjs';
import { DataHandler } from './data-handler.service';
import { AlertDialogService } from './alert-dialog.service';
import { AdminLocalizationService } from './admin-localization.service';
import { urlCodeOfLanguage } from '../../shared/utils/language-url';

/** One kind of records with the number of unread ones (`core/notifications`). */
export interface NotificationKind {
  /** Key of the kind, e.g. web_inquiries. */
  kind: string;
  /** Module of the kind ('core' or an application id). */
  module: string;
  /** Admin page of the records, e.g. /admin/web/user-request. */
  link: string;
  /** Unread records (attention kind: things needing work now). */
  count: number;
  /** A current state needing work (orange, never marked as seen) - absent for unread kinds. */
  attention?: boolean;
  /** Split of an attention count per language (texts missing), e.g. { en: 120, cz: 3 }. */
  languages?: Record<string, number>;
  /**
   * The same missing in the switched off languages (being prepared - not part of `count`, a grey
   * dot instead of the orange one), e.g. { pl: 14 }.
   */
  preparing?: Record<string, number>;
}

/**
 * Badge of a menu item / section / module: the red number of unread records and / or the orange
 * dot of things needing attention, with the label naming what is behind them.
 */
export interface NavBadge {
  /** Red number of unread records ("99+" above NOTIFICATIONS_BADGE_MAX); null without any. */
  text: string | null;
  /** Orange dot: something needs attention (texts missing in a language …). */
  attention: boolean;
  /** Grey dot: only a switched off language lacks something (shown when nothing is orange). */
  preparing: boolean;
  /** Tooltip and screen-reader text, e.g. "Nové poptávky: 3 · Chybějící texty webu: 123 (angličtina 120)". */
  label: string;
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
   * @description Badge of the admin page with this link (see navBadge()).
   * @param link Admin page, e.g. /admin/web/user-request.
   */
  badgeFor(link: string): NavBadge | null {
    return this.navBadge(this.kinds().filter(k => k.link === link));
  }

  /**
   * @description Badge of several admin pages (a collapsed menu section).
   * @param links Admin pages.
   */
  badgeForLinks(links: string[]): NavBadge | null {
    return this.navBadge(this.kinds().filter(k => links.includes(k.link)));
  }

  /**
   * @description Badge of a module ('core' or an application id).
   * @param module Module id.
   */
  moduleBadge(module: string): NavBadge | null {
    return this.navBadge(this.kinds().filter(k => k.module === module));
  }

  /**
   * @description Badge of a set of kinds: the red number of unread records and the orange dot
   *   when something needs attention (both can show); the grey dot when only a switched off
   *   language lacks something; null when there is nothing.
   * @param kinds Kinds behind the badge.
   */
  navBadge(kinds: NotificationKind[]): NavBadge | null {
    const active = kinds.filter(k => k.count > 0 || AdminNotificationsService.preparingCount(k) > 0);
    if (!active.length) return null;
    const unread = active.filter(k => !k.attention).reduce((sum, k) => sum + k.count, 0);
    const attention = active.some(k => k.attention && k.count > 0);
    return {
      text: this.badge(unread),
      attention,
      preparing: !attention && active.some(k => AdminNotificationsService.preparingCount(k) > 0),
      label: active.map(k => this.kindLabel(k)).join(' · '),
    };
  }

  /**
   * @description What the switched off languages of a kind still lack (the grey dot).
   * @param kind Kind.
   * @returns Sum of `preparing`, 0 without it.
   */
  static preparingCount(kind: NotificationKind): number {
    return Object.values(kind.preparing ?? {}).reduce((sum, count) => sum + (count > 0 ? count : 0), 0);
  }

  /**
   * @description One kind in a badge label: its name and count, texts missing per language, and
   *   what the switched off languages lack.
   * @param kind Kind with a count or `preparing`.
   * @returns e.g. "Nové poptávky: 3", "Chybějící texty webu: 123 (angličtina 120, čeština 3)",
   *   "Chybějící názvy stránek webu – vypnuté jazyky: polština 14" (no count when only the
   *   switched off languages lack something).
   */
  kindLabel(kind: NotificationKind): string {
    const languages = this.languageList(kind.languages);
    const preparing = this.languageList(kind.preparing);
    const head = kind.count > 0 || !preparing.length ? `${this.kindTitle(kind)}: ${kind.count}` : this.kindTitle(kind);
    return head + (languages.length ? ` (${languages.join(', ')})` : '')
      + (preparing.length ? ` – ${this.i18n.getValue('notifications.preparing_label')}: ${preparing.join(', ')}` : '');
  }

  /**
   * @param counts Language → count.
   * @returns "angličtina 120" items, the biggest first (zeros left out).
   */
  private languageList(counts: Record<string, number> | undefined): string[] {
    return Object.entries(counts ?? {})
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([code, count]) => `${this.languageName(code)} ${count}`);
  }

  /**
   * @description Name of a kind (`notifications.kind_<kind>`), the generic one without a text.
   * @param kind Kind.
   */
  private kindTitle(kind: NotificationKind): string {
    const key = `notifications.kind_${kind.kind}`;
    const title = this.i18n.getValue(key);
    return title && title !== key ? title : this.i18n.getValue('notifications.kind_generic');
  }

  /**
   * @description Name of a language in the admin language ("angličtina"), the code when the
   *   browser does not know it.
   * @param code Language code of the translations (`cz` = Czech).
   */
  private languageName(code: string): string {
    try {
      const names = new Intl.DisplayNames([this.i18n.getDateLocale()], { type: 'language' });
      return names.of(urlCodeOfLanguage(code)) ?? code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
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
    this.markSeen(this.kinds().filter(k => k.count > 0 && !k.attention && k.link === link).map(k => k.kind));
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
   *   records of its sub-pages) - not the attention kinds, they stay until the work is done.
   * @param url Address of the page (query and fragment ignored).
   */
  private markSeenAt(url: string): void {
    const path = url.split(/[?#]/)[0];
    this.markSeen(this.kinds()
      .filter(k => k.count > 0 && !k.attention && (path === k.link || path.startsWith(k.link + '/')))
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
   * @description Pops up the notice of a kind; a click opens its page. An attention kind pops up
   *   as a warning (orange).
   * @param kind Kind whose number grew.
   */
  private notify(kind: NotificationKind): void {
    const messageKey = kind.attention ? 'notifications.attention_toast_message' : 'notifications.toast_message';
    const message = this.i18n.getValue(messageKey).replace('{count}', String(kind.count));
    this.alert.open(this.kindTitle(kind), message, kind.attention ? 'warning' : 'info', () => this.router.navigateByUrl(kind.link));
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
