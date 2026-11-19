/**
 * @file portal-help.component.ts
 * @path src/app/apps/project-portal/public/sections/help/portal-help.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Help of the project portal (/projects/:token/help) for clients without any
 *   technical knowledge: one card per topic (texts of the portal language `help_<topic>_title` /
 *   `help_<topic>_text`, line breaks kept - steps and bullet lists) and the support box.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { portalTexts } from '../../portal-ui';

/** Topics of the help, in their order: getting started and signing in, the parts of the menu, own account and security. */
export const PORTAL_HELP_TOPICS = [
  'first_steps', 'login', 'login_code', 'account_switch', 'layout',
  'overview', 'checkpoints', 'threads', 'waiting', 'attachments', 'approvals', 'updates', 'files', 'contacts',
  'account', 'notifications', 'security', 'maintenance',
];

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
