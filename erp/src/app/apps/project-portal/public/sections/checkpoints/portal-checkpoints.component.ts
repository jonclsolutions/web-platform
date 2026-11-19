/**
 * @file portal-checkpoints.component.ts
 * @path src/app/apps/project-portal/public/sections/checkpoints/portal-checkpoints.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Progress of the project portal (/projects/:token/checkpoints): the overall progress
 *   bar and the numbered steps with their state and due date; a step with a description expands
 *   (the expanded steps are kept while the client moves between sections).
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PortalSessionService } from '../../portal-session.service';
import { formatPortalDate, portalTexts } from '../../portal-ui';
import { ProjectPortalLocalizationService } from '../../project-portal-localization.service';

@Component({
  selector: 'app-portal-checkpoints',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './portal-checkpoints.component.html',
  styleUrls: ['../portal-section.css', './portal-checkpoints.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalCheckpointsComponent {
  readonly session = inject(PortalSessionService);
  private readonly i18n = inject(ProjectPortalLocalizationService);
  readonly t = portalTexts();

  /**
   * @description Date in the portal language.
   * @param iso Date.
   */
  formatDate(iso: string | null | undefined): string {
    return formatPortalDate(iso, this.i18n.getCurrentLanguage());
  }
}
