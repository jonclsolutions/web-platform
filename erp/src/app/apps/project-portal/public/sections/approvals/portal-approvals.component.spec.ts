/**
 * @file portal-approvals.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/approvals/portal-approvals.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalApprovalsComponent: the requests reload when the section
 *   opens; approve at once; "request changes" needs a comment; the answer replaces the request;
 *   a failure shows the reason and reloads; a decided request has no buttons and shows its history.
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { of } from 'rxjs';
import { failWith, setUpPortal } from '../../portal.testing';
import { PortalApprovalsComponent } from './portal-approvals.component';

describe('PortalApprovalsComponent', () => {
  const approvals = () => [
    { id: 4, title: 'Homepage', description: 'Final design', status: 'pending', due_date: '2026-11-20', checkpoint_label: 'B', requested_by_label: 'Petr', requested_at: '2026-11-12 09:00:00',
      attachments: [{ id: 30, original_filename: 'home.png', mime_type: 'image/png', size_bytes: 4096, download_url: 'https://x/a/30' }], decisions: [] },
    { id: 3, title: 'Texts', description: null, status: 'changes_requested', due_date: null, requested_by_label: null, requested_at: '2026-11-08 09:00:00',
      decisions: [{ id: 1, decision: 'changes_requested', comment: 'Shorter', author_label: 'Jana Nová', account_id: 5, created_at: '2026-11-09 09:00:00' }] },
  ];

  /**
   * @description Approvals: rendered from the reloaded list; approve; request changes with and
   *   without a comment; a failure; no second decision of a decided request.
   * @input approvals section; decide(4, approved); request changes without / with comment; failure.
   * @output GET …/approvals on open; 2 cards, 1 action row, 1 history entry ('author_you');
   *   post('…/approvals/4/decision', { decision: 'approved' }), pending 0; no post for the decided one;
   *   'approval_comment_required' without request; { decision: 'changes_requested', comment: 'Bigger logo' };
   *   'approval_decision_failed' + reload; decidingId null.
   */
  it('lets the client approve or request changes', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalApprovalsComponent] });
    ctx.replies['/tok/approvals'] = () => of(approvals());
    ctx.get.calls.reset();
    const fixture = TestBed.createComponent(PortalApprovalsComponent);
    const view = fixture.componentInstance;
    fixture.detectChanges();
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/approvals');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-approval').length).toBe(2);
    expect(el.querySelectorAll('.pp-approval-actions').length).toBe(1);
    expect(el.querySelectorAll('.pp-decisions li').length).toBe(1);
    expect(el.querySelector('.pp-decisions li')!.textContent).toContain('author_you');
    expect(el.querySelector('.pp-approval .pp-attachment-name')!.textContent).toContain('home.png');
    expect(el.querySelector('.pp-approval .pp-attachment-size')!.textContent).toContain('4 KB');

    ctx.replies['/approvals/4/decision'] = () => of({ ...approvals()[0], status: 'approved' });
    view.decide(ctx.session.approvals()[0], 'approved');
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/approvals/4/decision', { decision: 'approved' });
    expect(ctx.session.approvals()[0].status).toBe('approved');
    expect(ctx.session.pendingApprovalsCount()).toBe(0);
    ctx.post.calls.reset();
    view.decide(ctx.session.approvals()[0], 'approved');
    expect(ctx.post).not.toHaveBeenCalled();

    ctx.session.approvals.set(approvals() as any);
    view.toggleChangesForm(ctx.session.approvals()[0]);
    expect(view.changesFormId).toBe(4);
    view.decide(ctx.session.approvals()[0], 'changes_requested');
    expect(view.decisionError).toBe('approval_comment_required');
    expect(ctx.post).not.toHaveBeenCalled();
    view.changesComment = ' Bigger logo ';
    ctx.replies['/approvals/4/decision'] = () => of({ ...approvals()[0], status: 'changes_requested' });
    view.decide(ctx.session.approvals()[0], 'changes_requested');
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/approvals/4/decision', { decision: 'changes_requested', comment: 'Bigger logo' });
    expect([view.changesFormId, view.changesComment]).toEqual([null, '']);

    ctx.session.approvals.set(approvals() as any);
    ctx.get.calls.reset();
    ctx.replies['/approvals/4/decision'] = failWith(422);
    view.decide(ctx.session.approvals()[0], 'approved');
    expect(view.decisionError).toBe('approval_decision_failed');
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/approvals');
    expect(view.decidingId).toBeNull();
    expect(view.approvalStatusLabel('approved')).toBe('approval_status_approved');
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('approval_decision_failed');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
