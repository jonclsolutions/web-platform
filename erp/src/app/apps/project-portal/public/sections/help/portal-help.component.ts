/**
 * @file portal-help.component.ts
 * @path src/app/apps/project-portal/public/sections/help/portal-help.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Help of the project portal (/projects/:token/help): one card per topic (texts of
 *   the portal language `help_<topic>_title` / `help_<topic>_text`) and the support box.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { portalTexts } from '../../portal-ui';

/** Topics of the help, in their order. */
export const PORTAL_HELP_TOPICS = ['login', 'login_code', 'overview', 'checkpoints', 'threads', 'waiting', 'approvals', 'updates', 'attachments', 'files', 'contacts', 'layout', 'notifications'];

@Component({
  selector: 'app-portal-help',
  standalone: true,
  templateUrl: './portal-help.component.html',
  styleUrls: ['../portal-section.css', './portal-help.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalHelpComponent {
  readonly t = portalTexts();
  readonly topics = PORTAL_HELP_TOPICS;
}
