/**
 * @file portal-approvals.component.ts
 * @path src/app/apps/project-portal/public/sections/approvals/portal-approvals.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Approvals of the project portal (/projects/:token/approvals): the approval requests
 *   of the supplier (pending first) with their files and the history of decisions; a pending one
 *   can be approved or returned with requested changes (a comment is required). The requests are
 *   reloaded when the section opens (the menu badge comes from the same list).
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { PortalSessionService } from '../../portal-session.service';
import { PortalApproval } from '../../portal.models';
import { formatFileSize, formatPortalDate, portalTexts } from '../../portal-ui';
import { ProjectPortalLocalizationService } from '../../project-portal-localization.service';

@Component({
  selector: 'app-portal-approvals',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './portal-approvals.component.html',
  styleUrls: ['../portal-section.css', './portal-approvals.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalApprovalsComponent implements OnInit, OnDestroy {
  readonly session = inject(PortalSessionService);
  private readonly i18n = inject(ProjectPortalLocalizationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  readonly t = portalTexts();
  readonly formatFileSize = formatFileSize;

  /** Approval with an open "request changes" form, its comment. */
  changesFormId: number | null = null;
  changesComment = '';
  /** Approval whose decision is being sent. */
  decidingId: number | null = null;
  /** Key of the text of the last decision error. */
  decisionError: string | null = null;

  ngOnInit(): void {
    this.session.loadApprovals();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Date in the portal language.
   * @param iso Date.
   */
  formatDate(iso: string | null | undefined): string {
    return formatPortalDate(iso, this.i18n.getCurrentLanguage());
  }

  /** @description Translated state of an approval / decision. */
  approvalStatusLabel(status: string): string {
    return this.t('approval_status_' + status);
  }

  /**
   * @description Opens / closes the "request changes" form of an approval.
   * @param approval Approval.
   */
  toggleChangesForm(approval: PortalApproval): void {
    this.changesFormId = this.changesFormId === approval.id ? null : approval.id;
    this.changesComment = '';
    this.decisionError = null;
    this.cdr.markForCheck();
  }

  /**
   * @description Sends the client's decision: approve, or request changes (a comment is required).
   * @param approval Pending approval.
   * @param decision approved | changes_requested
   */
  decide(approval: PortalApproval, decision: 'approved' | 'changes_requested'): void {
    if (!this.session.active || this.decidingId !== null || approval.status !== 'pending') return;
    const comment = this.changesComment.trim();
    if (decision === 'changes_requested' && !comment) {
      this.decisionError = 'approval_comment_required';
      this.cdr.markForCheck();
      return;
    }
    this.decidingId = approval.id;
    this.decisionError = null;
    this.cdr.markForCheck();
    this.session.post<PortalApproval>(this.session.path(`approvals/${approval.id}/decision`), decision === 'approved' ? { decision } : { decision, comment })
      .pipe(finalize(() => { this.decidingId = null; this.cdr.markForCheck(); }), takeUntil(this.destroy$))
      .subscribe({
        next: (saved) => {
          this.session.approvals.update(list => list.map(a => (a.id === approval.id ? saved : a)));
          this.changesFormId = null;
          this.changesComment = '';
        },
        error: () => {
          this.decisionError = 'approval_decision_failed';
          this.session.loadApprovals();
        },
      });
  }
}
