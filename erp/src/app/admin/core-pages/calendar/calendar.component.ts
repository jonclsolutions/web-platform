/**
 * @file calendar.component.ts
 * @path src/app/admin/core-pages/calendar/calendar.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calendar of the admin (core/calendar) - read only. Shows the important dates the
 *   admin already holds (coupon start / end, project deadlines, follow-ups of sales leads, expiring
 *   order-form and activation links) in a month view or as a list, and the open work of the
 *   modules (new job applicants, unresolved tickets, e-shop orders to process …) in the panel
 *   "Waiting for you". Every item opens its admin page. The API (GET core/agenda) returns only
 *   what the user's permissions allow; the page itself needs no permission.
 *   Personal events: every admin adds own reminders / notes (date, optional time, title, note,
 *   done) - visible only to the owner, like the personal external links (API core/calendar-events).
 * @note The dates of the modules are read only; no external calendar is connected.
 * @dependencies
 * - DataHandler (GET core/agenda, POST / PUT / DELETE core/calendar-events), AdminLocalizationService
 *   (section `calendar`, date locale), ConfirmDialogService (delete), Router (opening an item).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/** Module of an item (colour and filter); `personal` = own events of the admin. */
export type AgendaModule = 'web' | 'shop' | 'core' | 'personal';

/** Own event of the admin (only in items of the module `personal`). */
export interface PersonalEventData {
  id: number;
  /** HH:MM or null (all day). */
  time: string | null;
  note: string | null;
  done: boolean;
}

/** Form of a personal event (new or edited). */
export interface PersonalEventForm {
  id: number | null;
  date: string;
  time: string;
  title: string;
  note: string;
  is_done: boolean;
}

/** One dated item of `core/agenda`. */
export interface AgendaEvent {
  id: string;
  /** coupon_start | coupon_end | project_deadline | lead_follow_up | lead_form_expiry | activation_expiry */
  type: string;
  module: AgendaModule;
  /** YYYY-MM-DD */
  date: string;
  /** Name of the record (coupon code, project, lead, e-mail of the account). */
  subject: string;
  /** Admin page of the item (`/admin/...`, optionally with a query); null for a personal event. */
  link: string | null;
  /** danger = overdue. */
  severity: 'info' | 'warning' | 'danger';
  /** Personal event: its data (editable in the calendar). */
  personal?: PersonalEventData;
}

/** One open-work counter of `core/agenda`. */
export interface AgendaReminder {
  type: string;
  module: AgendaModule;
  count: number;
  /** Date of the oldest item (YYYY-MM-DD) or null. */
  since: string | null;
  link: string;
}

/** One day of the month grid. */
export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: AgendaEvent[];
}

/** Events of one day of the list view. */
export interface AgendaDayGroup {
  date: string;
  isToday: boolean;
  events: AgendaEvent[];
}

/** Modules in the order of the filter. */
export const AGENDA_MODULES: AgendaModule[] = ['personal', 'web', 'shop', 'core'];

/** Chips shown in one day cell before "+N more". */
export const DAY_CELL_LIMIT = 3;

/**
 * @description Date as YYYY-MM-DD in local time (no UTC shift).
 * @param date The date.
 */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @description Local date of a YYYY-MM-DD text.
 * @param iso YYYY-MM-DD.
 */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHelpComponent],
  templateUrl: './calendar.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', './calendar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarComponent implements OnInit {
  private readonly dataHandler = inject(DataHandler);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmDialog = inject(ConfirmDialogService);

  /**
   * Modules of the filter: only those the user may see (API `modules` - tab + page permissions);
   * before the first answer only the personal events.
   */
  modules: AgendaModule[] = ['personal'];
  readonly dayLimit = DAY_CELL_LIMIT;

  /** Shown view. */
  view: 'month' | 'list' = 'month';
  /** First day of the shown month. */
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  /** Today (from the API once loaded - the server's date). */
  today = isoDate(new Date());
  /** Selected day (detail panel). */
  selectedDate = this.today;
  /** Modules switched off in the filter. */
  hidden = new Set<AgendaModule>();

  loading = true;
  loadError = false;
  events: AgendaEvent[] = [];
  reminders: AgendaReminder[] = [];

  /** Month grid (6 weeks) and the list of the shown month. */
  weeks: CalendarDay[][] = [];
  groups: AgendaDayGroup[] = [];

  /** Request counter - an older answer never overwrites a newer month. */
  private request = 0;

  /** Personal event being added / edited (modal), null = closed. */
  form: PersonalEventForm | null = null;
  /** The form was sent once (shows the missing fields). */
  formSubmitted = false;
  saving = false;

  ngOnInit(): void {
    // OnPush: the labels follow a switch of the admin language at once.
    this.i18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cd.markForCheck());
    this.load();
  }

  /** @description Text of the section `calendar`. */
  t(key: string): string {
    return this.i18n.getValue(`calendar.${key}`);
  }

  /** @description Locale of the dates (admin language). */
  private get locale(): string {
    return this.i18n.getDateLocale();
  }

  /** @description "listopad 2026" → "Listopad 2026". */
  get monthLabel(): string {
    const label = this.month.toLocaleDateString(this.locale, { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  /** @description Short weekday names, Monday first. */
  get weekdays(): string[] {
    return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(this.locale, { weekday: 'short' }));
  }

  /** @description Range of the month grid: Monday before the 1st … 6 weeks. */
  private get range(): { from: Date; to: Date } {
    const from = new Date(this.month);
    from.setDate(1 - ((from.getDay() + 6) % 7));
    const to = new Date(from);
    to.setDate(from.getDate() + 41);
    return { from, to };
  }

  /** @description Loads the agenda of the shown month. */
  load(): void {
    const { from, to } = this.range;
    const request = ++this.request;
    this.loading = true;
    this.loadError = false;
    this.cd.markForCheck();

    this.dataHandler.get<{ today: string; modules?: AgendaModule[]; events: AgendaEvent[]; reminders: AgendaReminder[] }>(`core/agenda?from=${isoDate(from)}&to=${isoDate(to)}`).subscribe({
      next: res => {
        if (request !== this.request) return;
        if (res?.today && /^\d{4}-\d{2}-\d{2}$/.test(res.today)) this.today = res.today;
        // Known modules only, in the fixed order; events of another module are never shown.
        const allowed = Array.isArray(res?.modules) ? res.modules : ['personal'];
        this.modules = AGENDA_MODULES.filter(m => m === 'personal' || allowed.includes(m));
        this.events = Array.isArray(res?.events)
          ? res.events.filter(e => this.modules.includes(e.module) && (this.isPersonal(e) || this.isSafeLink(e.link))) : [];
        this.reminders = Array.isArray(res?.reminders)
          ? res.reminders.filter(r => this.modules.includes(r.module) && this.isSafeLink(r.link)) : [];
        this.loading = false;
        this.build();
      },
      error: () => {
        if (request !== this.request) return;
        this.loading = false;
        this.loadError = true;
        this.events = [];
        this.build();
      },
    });
  }

  /** @description Own event of the admin (no link, editable). */
  isPersonal(event: AgendaEvent): boolean {
    return event.module === 'personal' && !!event.personal;
  }

  /** @description Only links into the admin are opened (never another site). */
  private isSafeLink(link: unknown): boolean {
    return typeof link === 'string' && link.startsWith('/admin/') && !link.includes('//');
  }

  /** @description Builds the grid and the list from the events and the filter. */
  private build(): void {
    const visible = this.visibleEvents;
    const byDate = new Map<string, AgendaEvent[]>();
    for (const event of visible) {
      byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
    }

    const { from } = this.range;
    this.weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
      const date = new Date(from);
      date.setDate(from.getDate() + w * 7 + d);
      const iso = isoDate(date);
      return {
        date: iso, day: date.getDate(), inMonth: date.getMonth() === this.month.getMonth(),
        isToday: iso === this.today, isWeekend: d >= 5, events: byDate.get(iso) ?? [],
      };
    }));

    const monthPrefix = isoDate(this.month).slice(0, 7);
    this.groups = [...byDate.entries()]
      .filter(([date]) => date.startsWith(monthPrefix))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({ date, isToday: date === this.today, events }));
    this.cd.markForCheck();
  }

  /** @description Events of the switched-on modules. */
  get visibleEvents(): AgendaEvent[] {
    return this.events.filter(e => !this.hidden.has(e.module));
  }

  /** @description Reminders of the switched-on modules. */
  get visibleReminders(): AgendaReminder[] {
    return this.reminders.filter(r => !this.hidden.has(r.module));
  }

  /** @description Open items in total (badge of today). */
  get reminderTotal(): number {
    return this.visibleReminders.reduce((sum, r) => sum + r.count, 0);
  }

  /** @description Events of the selected day. */
  get selectedEvents(): AgendaEvent[] {
    return this.visibleEvents.filter(e => e.date === this.selectedDate);
  }

  /** @description Number of events of a module in the shown range (filter chip). */
  moduleCount(module: AgendaModule): number {
    return this.events.filter(e => e.module === module).length + this.reminders.filter(r => r.module === module).length;
  }

  /** @description Switches a module of the filter on / off. */
  toggleModule(module: AgendaModule): void {
    if (this.hidden.has(module)) this.hidden.delete(module);
    else this.hidden.add(module);
    this.build();
  }

  /** @description Previous / next month. */
  shiftMonth(delta: number): void {
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
    this.load();
  }

  /** @description Back to the month of today, today selected. */
  goToday(): void {
    const today = parseIsoDate(this.today);
    this.selectedDate = this.today;
    if (today.getFullYear() !== this.month.getFullYear() || today.getMonth() !== this.month.getMonth()) {
      this.month = new Date(today.getFullYear(), today.getMonth(), 1);
      this.load();
      return;
    }
    this.cd.markForCheck();
  }

  /** @description Month / list view. */
  setView(view: 'month' | 'list'): void {
    this.view = view;
    this.cd.markForCheck();
  }

  /** @description Selects a day (detail panel). */
  selectDay(day: CalendarDay): void {
    this.selectedDate = day.date;
    this.cd.markForCheck();
  }

  /** @description Text of an event: e.g. "Coupon XMAS ends"; a personal event = its title. */
  eventTitle(event: AgendaEvent): string {
    return this.isPersonal(event) ? event.subject : this.t(`event_${event.type}`).replace('{subject}', event.subject);
  }

  /**
   * @description Explanation of an event (detail panel / list); a personal event: time (or "all
   *   day") and its note.
   */
  eventHint(event: AgendaEvent): string {
    if (!this.isPersonal(event)) return this.t(`hint_${event.type}`);
    const when = event.personal!.time ?? this.t('all_day');
    return event.personal!.note ? `${when} · ${event.personal!.note}` : when;
  }

  /** @description Opens the form of a new personal event on a day (default: the selected day). */
  openNewEvent(date: string = this.selectedDate): void {
    this.form = { id: null, date, time: '', title: '', note: '', is_done: false };
    this.formSubmitted = false;
    this.cd.markForCheck();
  }

  /** @description Opens the form of an own event. */
  openEditEvent(event: AgendaEvent): void {
    if (!this.isPersonal(event)) return;
    const p = event.personal!;
    this.form = { id: p.id, date: event.date, time: p.time ?? '', title: event.subject, note: p.note ?? '', is_done: p.done };
    this.formSubmitted = false;
    this.cd.markForCheck();
  }

  /** @description Closes the form (not while saving). */
  closeForm(): void {
    if (this.saving) return;
    this.form = null;
    this.cd.markForCheck();
  }

  /** @description The form has a title and a valid date. */
  get formValid(): boolean {
    return !!this.form && this.form.title.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(this.form.date);
  }

  /** @description Saves the form (create / update), reloads the calendar and shows the day. */
  saveForm(): void {
    this.formSubmitted = true;
    if (!this.form || !this.formValid || this.saving) {
      this.cd.markForCheck();
      return;
    }
    const form = this.form;
    const body = { date: form.date, time: form.time || null, title: form.title.trim(), note: form.note.trim() || null, is_done: form.is_done };
    const request$ = form.id === null
      ? this.dataHandler.post<AgendaEvent>('core/calendar-events', body)
      : this.dataHandler.put<AgendaEvent>(`core/calendar-events/${form.id}`, body);
    this.saving = true;
    this.cd.markForCheck();
    request$.subscribe({
      next: () => {
        this.saving = false;
        this.form = null;
        this.selectedDate = form.date;
        this.showMonthOf(form.date);
      },
      error: () => {
        // The reason is shown by DataHandler.handleError().
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Marks an own event done / not done straight from the list. */
  toggleDone(event: AgendaEvent): void {
    if (!this.isPersonal(event)) return;
    const done = !event.personal!.done;
    this.dataHandler.put<AgendaEvent>(`core/calendar-events/${event.personal!.id}`, { is_done: done }).subscribe({
      next: () => this.load(),
    });
  }

  /** @description Deletes the edited event after a confirmation. */
  async deleteForm(): Promise<void> {
    if (!this.form || this.form.id === null || this.saving) return;
    const id = this.form.id;
    const confirmed = await this.confirmDialog.open(this.t('delete_title'), this.t('delete_message'), { confirm: this.t('delete'), cancel: this.t('cancel') });
    if (!confirmed) return;
    this.saving = true;
    this.cd.markForCheck();
    this.dataHandler.delete(`core/calendar-events/${id}`).subscribe({
      next: () => {
        this.saving = false;
        this.form = null;
        this.load();
      },
      error: () => {
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Shows the month of a date (reloads). */
  private showMonthOf(iso: string): void {
    const date = parseIsoDate(iso);
    this.month = new Date(date.getFullYear(), date.getMonth(), 1);
    this.load();
  }

  /** @description Name of a module. */
  moduleLabel(module: AgendaModule): string {
    return this.t(`module_${module}`);
  }

  /** @description Long date of a day: "středa 11. listopadu". */
  dayLabel(iso: string): string {
    return parseIsoDate(iso).toLocaleDateString(this.locale, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /** @description Short date: "11. 11. 2026". */
  shortDate(iso: string): string {
    return parseIsoDate(iso).toLocaleDateString(this.locale, { day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  /** @description Days since a date (0 = today). */
  daysSince(iso: string | null): number {
    if (!iso) return 0;
    return Math.max(0, Math.round((parseIsoDate(this.today).getTime() - parseIsoDate(iso).getTime()) / 86_400_000));
  }

  /** @description "oldest today" / "oldest yesterday" / "oldest 3 days ago". */
  sinceLabel(reminder: AgendaReminder): string {
    if (!reminder.since) return '';
    const days = this.daysSince(reminder.since);
    if (days === 0) return this.t('since_today');
    if (days === 1) return this.t('since_yesterday');
    return this.t('since_days').replace('{days}', String(days));
  }

  /**
   * @description Path and query of an item link for routerLink.
   * @param link `/admin/...?...`
   */
  linkPath(link: string): string {
    return link.split('?')[0];
  }

  /** @description Query of an item link (`open_project=5` → { open_project: '5' }). */
  linkQuery(link: string): Record<string, string> | null {
    const query = link.split('?')[1];
    return query ? Object.fromEntries(new URLSearchParams(query).entries()) : null;
  }

  /** @description Opens the admin page of an item. */
  open(link: string): void {
    if (this.isSafeLink(link)) this.router.navigateByUrl(link);
  }
}
