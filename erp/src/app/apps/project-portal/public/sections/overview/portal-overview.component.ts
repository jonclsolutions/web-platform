/**
 * @file portal-overview.component.ts
 * @path src/app/apps/project-portal/public/sections/overview/portal-overview.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Overview of the project portal (/projects/:token/overview): key numbers (progress,
 *   threads waiting on the client, unread messages, estimated completion), the banner of pending
 *   approvals, "What is new since your last visit", the current step, the description and the
 *   technologies of the project.
 * @note Opening the overview marks the news as seen (the menu badge goes away), the items stay
 *   highlighted until the client leaves it.
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PortalSessionService } from '../../portal-session.service';
import { PortalActivityItem, PortalSection, ProjectCheckpoint } from '../../portal.models';
import { formatPortalDate, portalTexts } from '../../portal-ui';
import { ProjectPortalLocalizationService } from '../../project-portal-localization.service';

/** Sections a news item can open. */
const NEWS_SECTIONS: PortalSection[] = ['checkpoints', 'threads', 'approvals', 'updates'];

@Component({
  selector: 'app-portal-overview',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './portal-overview.component.html',
  styleUrls: ['../portal-section.css', './portal-overview.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalOverviewComponent implements OnInit, OnDestroy {
  readonly session = inject(PortalSessionService);
  private readonly i18n = inject(ProjectPortalLocalizationService);
  readonly t = portalTexts();

  /** The step being worked on: the active one, else the first one not done (null when all are done / none). */
  readonly currentCheckpoint = computed<ProjectCheckpoint | null>(() => {
    const checkpoints = this.session.project()?.checkpoints ?? [];
    return checkpoints.find(c => c.status === 'active') ?? checkpoints.find(c => c.status !== 'done') ?? null;
  });

  ngOnInit(): void {
    this.session.overviewOpen = true;
    this.session.markActivitySeen();
  }

  ngOnDestroy(): void {
    // Leaving the overview: its news have been seen (stored on the server), drop the highlight.
    this.session.overviewOpen = false;
    this.session.clearNewHighlight();
  }

  /** @description Estimated completion ("24. prosince 2026 – 31. ledna 2027"), null when not set. */
  get estimatedCompletionLabel(): string | null {
    const project = this.session.project();
    const from = project?.estimated_completion_from;
    const to = project?.estimated_completion_to;
    if (!from && !to) return null;
    const lang = this.i18n.getCurrentLanguage();
    if (from && to) return `${formatPortalDate(from, lang)} – ${formatPortalDate(to, lang)}`;
    return formatPortalDate((from || to)!, lang);
  }

  /**
   * @description Date in the portal language.
   * @param iso Date.
   */
  formatDate(iso: string | null | undefined): string {
    return formatPortalDate(iso, this.i18n.getCurrentLanguage());
  }

  /**
   * @description Text of a news item ("New update", "Step changed to Done", …).
   * @param item News item.
   */
  activityLabel(item: PortalActivityItem): string {
    if (item.type === 'checkpoint') return this.t('news_checkpoint').replace('{status}', this.checkpointStatusLabel(item.detail ?? ''));
    if (item.type === 'approval_decided') return this.t('news_approval_' + item.detail);
    return this.t('news_' + item.type);
  }

  /**
   * @description Translated state of a step (an unknown state is shown as it is).
   * @param status new | active | done.
   */
  checkpointStatusLabel(status: string): string {
    return ['new', 'active', 'done'].includes(status) ? this.t('checkpoint_status_' + status) : status;
  }

  /**
   * @description Opens the section of a news item (a thread directly).
   * @param item News item.
   */
  openActivity(item: PortalActivityItem): void {
    this.session.markActivitySeen();
    const section = NEWS_SECTIONS.find(s => s === item.target.section) ?? 'overview';
    if (section === 'threads' && item.target.id) {
      const thread = this.session.threads().find(t => t.id === item.target.id)
        ?? { id: item.target.id, subject: item.title, priority: 'medium', status: 'active', last_message_at: null };
      this.session.openThreadInCommunication(thread);
      return;
    }
    this.session.openSection(section);
  }
}
