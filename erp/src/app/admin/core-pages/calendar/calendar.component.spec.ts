/**
 * @file calendar.component.spec.ts
 * @path src/app/admin/core-pages/calendar/calendar.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CalendarComponent: the month grid (6 weeks from Monday, today,
 *   days of other months), the request of the shown range, events in their days (max 3 chips +
 *   "+N"), overdue items, the panel of open work, module filter, month navigation, the list view,
 *   the day detail, safe links only, the load error, the redraw on a language switch and the
 *   personal events (create, edit, done toggle, delete; no link, open the form) and the modules
 *   the user may see (filter and items).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / i18n stubs); provideRouter (links of the items).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CalendarComponent, AgendaEvent, AgendaReminder, isoDate, parseIsoDate } from './calendar.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('CalendarComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<CalendarComponent>;
  let component: CalendarComponent;

  const event = (id: string, date: string, overrides: Partial<AgendaEvent> = {}): AgendaEvent => ({
    id, type: 'coupon_end', module: 'shop', date, subject: id.toUpperCase(), link: '/admin/shop/coupons', severity: 'warning', ...overrides,
  });
  const EVENTS: AgendaEvent[] = [
    event('a', '2026-11-05', { type: 'project_deadline', module: 'web', link: '/admin/web/projects?open_project=7', severity: 'danger' }),
    event('b', '2026-11-20'), event('c', '2026-11-20'), event('d', '2026-11-20'), event('e', '2026-11-20'),
    event('f', '2026-11-13', { type: 'activation_expiry', module: 'core', link: '/admin/core/administrators' }),
    event('evil', '2026-11-14', { link: 'https://evil.example.com' }),
  ];
  const PERSONAL: AgendaEvent = event('personal-9', '2026-11-12', {
    type: 'personal', module: 'personal', subject: 'Call the accountant', link: null, severity: 'info',
    personal: { id: 9, time: '09:30', note: 'Invoices', done: false },
  });
  const ALL = ['personal', 'web', 'shop', 'core'];
  const REMINDERS: AgendaReminder[] = [
    { type: 'job_applications_new', module: 'web', count: 3, since: '2026-11-08', link: '/admin/web/job-applications' },
    { type: 'shop_orders_open', module: 'shop', count: 2, since: '2026-11-10', link: '/admin/shop/orders' },
  ];

  /** Creates the page; `answer` is the API answer of core/agenda. */
  const create = (answer: any = of({ today: '2026-11-11', modules: ALL, events: EVENTS, reminders: REMINDERS })) => {
    (ctx.dataHandler as any).get.and.returnValue(answer);
    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    component.month = new Date(2026, 10, 1);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [CalendarComponent], providers: [...ctx.providers, provideRouter([])] }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  /**
   * @description Local dates without a UTC shift.
   * @input isoDate(new Date(2026, 0, 5)); parseIsoDate('2026-03-09').
   * @output '2026-01-05'; 9 March 2026.
   */
  it('converts dates', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(parseIsoDate('2026-03-09').getDate()).toBe(9);
  });

  /**
   * @description The month grid of November 2026 starts on Monday 26 October and has 6 weeks; the
   *   shown range is requested; today (from the API) is marked and selected; links outside the
   *   admin are dropped.
   * @input November 2026, API today 2026-11-11.
   * @output get('core/agenda?from=2026-10-26&to=2026-12-06'); 6 × 7 days, first 26 (out of month);
   *   today cell marked; 6 events (the external link dropped).
   */
  it('builds the month grid of the shown range', () => {
    create();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/agenda?from=2026-10-26&to=2026-12-06');
    expect(component.weeks.length).toBe(6);
    expect(component.weeks.every(w => w.length === 7)).toBeTrue();
    expect([component.weeks[0][0].date, component.weeks[0][0].inMonth]).toEqual(['2026-10-26', false]);
    expect(component.events.map(e => e.id)).not.toContain('evil');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.cal-day').length).toBe(42);
    expect(el.querySelector('.cal-day--today .cal-day-num')?.textContent?.trim()).toBe('11');
    expect(component.selectedDate).toBe('2026-11-11');
  });

  /**
   * @description Events in their days: at most 3 chips and "+N"; an overdue item is marked; the
   *   chip links to the admin page with its query.
   * @input 4 events on 20 November, overdue project on 5 November.
   * @output 20 Nov: 3 chips + 'calendar.more'; 5 Nov chip overdue with href
   *   /admin/web/projects?open_project=7, the name as text and the full title as label.
   */
  it('shows the events in their days', () => {
    create();
    const el: HTMLElement = fixture.nativeElement;
    const day = (date: string) => Array.from(el.querySelectorAll('.cal-day'))[component.weeks.flat().findIndex(d => d.date === date)] as HTMLElement;
    expect(day('2026-11-20').querySelectorAll('.cal-chip').length).toBe(3);
    expect(day('2026-11-20').querySelector('.cal-more')?.textContent?.trim()).toBe('calendar.more');
    const overdue = day('2026-11-05').querySelector('.cal-chip') as HTMLAnchorElement;
    expect(overdue.classList).toContain('cal-chip--overdue');
    expect(overdue.getAttribute('href')).toBe('/admin/web/projects?open_project=7');
    expect(overdue.textContent?.trim()).toBe('A');
    expect(overdue.getAttribute('aria-label')).toBe('calendar.event_project_deadline');
    expect(component.eventTitle(EVENTS[0])).toBe('calendar.event_project_deadline');
  });

  /**
   * @description The panel of open work: counters with links, total on the today cell, the age
   *   of the oldest item; the module filter hides events, reminders and counts of a module.
   * @input Reminders web 3 + shop 2; switch e-shop off.
   * @output 2 reminder rows, total 5 (badge of today); since 'calendar.since_days' (3 days);
   *   e-shop off: 1 reminder, total 3, no shop events, filter chip off.
   */
  it('lists the open work and filters the modules', () => {
    create();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.cal-reminder').length).toBe(2);
    expect(component.reminderTotal).toBe(5);
    expect(el.querySelector('.cal-today-badge')?.textContent?.trim()).toBe('5');
    expect(component.sinceLabel(REMINDERS[0])).toBe('calendar.since_days');
    expect(component.sinceLabel({ ...REMINDERS[0], since: '2026-11-10' })).toBe('calendar.since_yesterday');
    expect((el.querySelector('.cal-reminder') as HTMLAnchorElement).getAttribute('href')).toBe('/admin/web/job-applications');

    component.toggleModule('shop');
    fixture.detectChanges();
    expect(component.visibleReminders.map(r => r.type)).toEqual(['job_applications_new']);
    expect(component.reminderTotal).toBe(3);
    expect(component.visibleEvents.some(e => e.module === 'shop')).toBeFalse();
    expect(el.querySelector('.cal-filter[data-module="shop"]')?.classList).toContain('cal-filter--off');
    expect(component.moduleCount('web')).toBe(2);
  });

  /**
   * @description Month navigation loads the new range; "Today" returns to the month of today.
   * @input Next month; then today.
   * @output get(... from=2026-11-30&to=2027-01-10); label of December; back: November range again,
   *   today selected.
   */
  it('moves between months', () => {
    create();
    component.shiftMonth(1);
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/agenda?from=2026-11-30&to=2027-01-10');
    expect(component.month.getMonth()).toBe(11);
    component.selectedDate = '2026-12-03';
    component.goToday();
    expect(component.month.getMonth()).toBe(10);
    expect(component.selectedDate).toBe('2026-11-11');
    expect((ctx.dataHandler as any).get.calls.mostRecent().args[0]).toBe('core/agenda?from=2026-10-26&to=2026-12-06');
  });

  /**
   * @description The list view groups the events of the month by day; the day detail lists the
   *   selected day.
   * @input List view; select 20 November in the grid.
   * @output groups 05, 13, 20 (in order, today none); 4 rows on 20; detail of 20 Nov with 4 rows.
   */
  it('shows the list and the selected day', () => {
    create();
    component.selectDay(component.weeks.flat().find(d => d.date === '2026-11-20')!);
    fixture.detectChanges();
    expect(component.selectedEvents.length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.cal-side .cal-row').length).toBe(4);

    component.setView('list');
    fixture.detectChanges();
    expect(component.groups.map(g => g.date)).toEqual(['2026-11-05', '2026-11-13', '2026-11-20']);
    expect(fixture.nativeElement.querySelectorAll('.cal-list .cal-row').length).toBe(6);
  });

  /**
   * @description A failed load shows the error and an empty calendar; an older answer never
   *   overwrites a newer month.
   * @input API error; then two requests answered in reverse order.
   * @output error banner, no events; the second answer wins.
   */
  it('handles errors and stale answers', () => {
    create(throwError(() => new Error('500')));
    expect(component.loadError).toBeTrue();
    expect(fixture.nativeElement.querySelector('.cd-error-banner')).not.toBeNull();

    let first: any;
    (ctx.dataHandler as any).get.and.returnValues({ subscribe: (o: any) => { first = o; } }, of({ today: '2026-11-11', modules: ALL, events: [EVENTS[1]], reminders: [] }));
    component.load();
    component.load();
    first.next({ today: '2026-11-11', modules: ALL, events: EVENTS, reminders: REMINDERS });
    expect(component.events.map(e => e.id)).toEqual(['b']);
  });

  /**
   * @description A new personal event: the header button opens an empty form on the selected
   *   day; an empty title is refused; a valid form is POSTed (empty time / note → null) and the
   *   calendar of its month is reloaded with the day selected.
   * @input Click "add"; save empty; fill title + date 2026-12-02; save.
   * @output form date 2026-11-11; no post + 'title_required' shown; post('core/calendar-events',
   *   {date, time: null, title, note: null, is_done: false}); form closed; month December; day selected.
   */
  it('creates a personal event', () => {
    create();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.cal-add-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.form?.date).toBe('2026-11-11');
    expect(el.querySelector('.cal-modal')).not.toBeNull();

    component.saveForm();
    fixture.detectChanges();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    expect(el.querySelector('.cal-field-error')?.textContent).toContain('calendar.title_required');

    component.form!.title = '  Renew domain  ';
    component.form!.date = '2026-12-02';
    component.saveForm();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/calendar-events',
      { date: '2026-12-02', time: null, title: 'Renew domain', note: null, is_done: false });
    expect(component.form).toBeNull();
    expect(component.month.getMonth()).toBe(11);
    expect(component.selectedDate).toBe('2026-12-02');
  });

  /**
   * @description A personal event has no link: it is kept, its chip / row opens the form; the
   *   edit is PUT, the row toggles done and the delete asks first.
   * @input Agenda with a personal event on 12 Nov; click its chip; save; toggle done; delete.
   * @output chip is a button; form with its data; put('core/calendar-events/9', {...}); toggle
   *   put {is_done: true}; confirm opened, delete('core/calendar-events/9'); hint "09:30 · Invoices".
   */
  it('edits, completes and deletes a personal event', async () => {
    create(of({ today: '2026-11-11', modules: ALL, events: [...EVENTS, PERSONAL], reminders: [] }));
    const el: HTMLElement = fixture.nativeElement;
    expect(component.events.some(e => e.id === 'personal-9')).toBeTrue();
    expect(component.eventHint(PERSONAL)).toBe('09:30 · Invoices');
    expect(component.eventTitle(PERSONAL)).toBe('Call the accountant');
    expect(component.moduleCount('personal')).toBe(1);

    const chip = el.querySelector('button.cal-chip[data-module="personal"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    chip.click();
    fixture.detectChanges();
    expect(component.form).toEqual({ id: 9, date: '2026-11-12', time: '09:30', title: 'Call the accountant', note: 'Invoices', is_done: false });
    expect(el.querySelector('.cal-btn--danger')).not.toBeNull();

    component.form!.is_done = true;
    component.saveForm();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/calendar-events/9',
      { date: '2026-11-12', time: '09:30', title: 'Call the accountant', note: 'Invoices', is_done: true });

    component.toggleDone(PERSONAL);
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/calendar-events/9', { is_done: true });

    component.openEditEvent(PERSONAL);
    await component.deleteForm();
    expect(ctx.confirm.open).toHaveBeenCalled();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/calendar-events/9');
    expect(component.form).toBeNull();
  });

  /**
   * @description A declined confirmation deletes nothing; module events never open the form.
   * @input confirm → false; openEditEvent(module event).
   * @output no delete; form stays; form null for a module event.
   */
  it('keeps a personal event when the delete is declined', async () => {
    create(of({ today: '2026-11-11', modules: ALL, events: [PERSONAL], reminders: [] }));
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    component.openEditEvent(PERSONAL);
    await component.deleteForm();
    expect((ctx.dataHandler as any).delete).not.toHaveBeenCalled();
    expect(component.form).not.toBeNull();

    component.closeForm();
    component.openEditEvent(EVENTS[0]);
    expect(component.form).toBeNull();
  });

  /**
   * @description Only the modules of the API answer are offered and shown (a user without the
   *   e-shop sees no e-shop filter and no e-shop item, even if one came); no `modules` = personal only.
   * @input modules ['personal', 'web']; then an answer without `modules`.
   * @output filters personal + web; no shop / core events or reminders; then filter personal only
   *   and no module item.
   */
  it('offers only the modules the user may see', () => {
    create(of({ today: '2026-11-11', modules: ['personal', 'web', 'evil'], events: [...EVENTS, PERSONAL], reminders: REMINDERS }));
    const el: HTMLElement = fixture.nativeElement;
    expect(component.modules).toEqual(['personal', 'web']);
    expect(Array.from(el.querySelectorAll('.cal-filter')).map(f => f.getAttribute('data-module'))).toEqual(['personal', 'web']);
    expect(component.events.every(e => ['personal', 'web'].includes(e.module))).toBeTrue();
    expect(component.reminders.map(r => r.module)).toEqual(['web']);

    (ctx.dataHandler as any).get.and.returnValue(of({ today: '2026-11-11', events: EVENTS, reminders: REMINDERS }));
    component.load();
    expect(component.modules).toEqual(['personal']);
    expect(component.events).toEqual([]);
    expect(component.reminders).toEqual([]);
  });

  /**
   * @description OnPush: a switch of the admin language redraws the page.
   * @input translations$ emits.
   * @output markForCheck called.
   */
  it('redraws when the admin language changes', () => {
    create();
    const markForCheck = spyOn((component as any).cd, 'markForCheck');
    ctx.i18n.translations$.next({});
    expect(markForCheck).toHaveBeenCalled();
  });
});
