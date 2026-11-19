/**
 * @file portal-overview.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/overview/portal-overview.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalOverviewComponent: key numbers (each opens its section), the
 *   current step, the estimated completion per language, "What is new" (seen at once, highlight
 *   until leaving, labels, opening a news item) and the banner of pending approvals.
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush } from '@angular/core/testing';
import { of } from 'rxjs';
import { PortalTestContext, setUpPortal, testProject } from '../../portal.testing';
import { PortalOverviewComponent } from './portal-overview.component';

describe('PortalOverviewComponent', () => {
  let ctx: PortalTestContext;
  let fixture: ComponentFixture<PortalOverviewComponent>;
  let overview: PortalOverviewComponent;

  const activity = () => [
    { type: 'approval_requested', title: 'Homepage', detail: null, at: '2026-11-12 09:00:00', is_new: true, target: { section: 'approvals', id: 4 } },
    { type: 'checkpoint', title: 'B', detail: 'active', at: '2026-11-11 09:00:00', is_new: false, target: { section: 'checkpoints', id: 2 } },
    { type: 'reply', title: 'Design', detail: null, at: '2026-11-10 09:00:00', is_new: false, target: { section: 'threads', id: 1 } },
    { type: 'approval_decided', title: 'Texts', detail: 'changes_requested', at: '2026-11-09 09:00:00', is_new: false, target: { section: 'approvals', id: 3 } },
    { type: 'reply', title: 'Old thread', detail: null, at: '2026-11-08 09:00:00', is_new: false, target: { section: 'threads', id: 9 } },
  ];

  /** Sets up the portal (news with 1 unseen, 1 pending approval) and opens the overview. */
  function create(): void {
    ctx = setUpPortal({ imports: [PortalOverviewComponent], start: false });
    ctx.replies['/tok/activity'] = () => of({ data: activity(), meta: { unseen: 1 } });
    ctx.replies['/tok/approvals'] = () => of([{ id: 4, status: 'pending' }, { id: 3, status: 'changes_requested' }]);
    ctx.replies['/activity/seen'] = () => of({});
    ctx.session.start('tok', testProject());
    fixture = TestBed.createComponent(PortalOverviewComponent);
    overview = fixture.componentInstance;
    fixture.detectChanges();
  }
  function finish(): void {
    fixture.destroy();
    discardPeriodicTasks();
  }

  /**
   * @description Overview: progress, threads waiting on the client (highlighted), unread
   *   messages, the current step with its due date and the description; a card opens its section.
   * @input overview of the test project; click on the "waiting on you" card; all steps done.
   * @output 33 %; .pp-stat--attention with 1; current step 'B' with the due date; 'Desc';
   *   openSection('threads'); no current step.
   */
  it('renders the key numbers and the current step', fakeAsync(() => {
    create();
    const el = fixture.nativeElement as HTMLElement;
    const stats = el.querySelectorAll<HTMLButtonElement>('.pp-stat');
    expect(stats[0].textContent).toContain('33 %');
    expect(el.querySelector('.pp-stat--attention .pp-stat-value')!.textContent!.trim()).toBe('1');
    expect(el.querySelector('.pp-stat--unread .pp-stat-value')!.textContent!.trim()).toBe('3');
    expect(el.querySelector('.pp-current-step')!.textContent).toContain('B');
    expect(el.querySelector('.pp-current-step .pp-due')!.textContent).toContain('due_date_prefix');
    expect(el.textContent).toContain('Desc');
    stats[1].click();
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'threads']);
    stats[0].click();
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'checkpoints']);
    expect(overview.formatDate('2026-12-24')).toBe(new Date('2026-12-24T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }));
    expect(overview.formatDate(null)).toBe('');

    const project = ctx.session.project()!;
    ctx.session.project.set({ ...project, checkpoints: project.checkpoints.map(c => ({ ...c, status: 'done' as const })) });
    expect(overview.currentCheckpoint()).toBeNull();
    finish();
  }));

  /**
   * @description Estimated completion: none without dates, one date, a range in the portal language.
   * @input no dates; from 2026-03-01; + to 2026-04-01 in English.
   * @output null; the Czech date; a range with '–' and 'March'.
   */
  it('formats the estimated completion', fakeAsync(() => {
    create();
    expect(overview.estimatedCompletionLabel).toBeNull();
    ctx.session.project.set({ ...ctx.session.project()!, estimated_completion_from: '2026-03-01' });
    expect(overview.estimatedCompletionLabel).toBe(new Date('2026-03-01T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }));
    ctx.session.project.set({ ...ctx.session.project()!, estimated_completion_to: '2026-04-01' });
    ctx.language$.next('en');
    expect(overview.estimatedCompletionLabel).toContain('–');
    expect(overview.estimatedCompletionLabel).toContain('March');
    finish();
    flush();
  }));

  /**
   * @description "What is new": marked seen at once on the overview (badge gone, new items still
   *   highlighted), labelled per type and opening its section (a thread directly - also one no
   *   longer in the list); pending approvals show a banner; leaving drops the highlight.
   * @input overview with 5 news (1 unseen) and 1 pending approval; openActivity of each kind; destroy.
   * @output post('…/activity/seen'); unseen 0; 5 items, 1 highlighted; banner; labels;
   *   navigation to approvals / checkpoints; thread 1 and stub thread 9 requested in Communication;
   *   highlight cleared and overviewOpen false after leaving.
   */
  it('shows what is new and opens it', fakeAsync(() => {
    create();
    expect(ctx.session.overviewOpen).toBeTrue();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/activity/seen', {});
    expect(ctx.session.activityUnseen()).toBe(0);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-news-item').length).toBe(5);
    expect(el.querySelectorAll('.pp-news-item--new').length).toBe(1);
    expect(el.querySelector('.pp-banner')).not.toBeNull();
    (el.querySelector('.pp-banner') as HTMLButtonElement).click();
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'approvals']);

    const [requested, checkpoint, reply, decided, gone] = ctx.session.activity();
    expect(overview.activityLabel(requested)).toBe('news_approval_requested');
    expect(overview.activityLabel(checkpoint)).toBe('news_checkpoint');
    expect(overview.checkpointStatusLabel('active')).toBe('checkpoint_status_active');
    expect(overview.checkpointStatusLabel('odd')).toBe('odd');
    expect(overview.activityLabel(decided)).toBe('news_approval_changes_requested');
    expect(overview.activityLabel(reply)).toBe('news_reply');

    overview.openActivity(checkpoint);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'checkpoints']);
    overview.openActivity(reply);
    expect(ctx.session.requestedThread()!.id).toBe(1);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'threads']);
    overview.openActivity(gone);
    expect(ctx.session.requestedThread()).toEqual(jasmine.objectContaining({ id: 9, subject: 'Old thread' }));
    overview.openActivity({ ...requested, target: { section: 'nowhere', id: null } });
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'overview']);

    finish();
    expect(ctx.session.overviewOpen).toBeFalse();
    expect(ctx.session.activity().some(i => i.is_new)).toBeFalse();
  }));
});
