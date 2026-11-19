/**
 * @file portal-contacts.component.ts
 * @path src/app/apps/project-portal/public/sections/contacts/portal-contacts.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Contacts of the project portal (/projects/:token/contacts): the contact person of
 *   the supplier for the project (phone / e-mail links) and the company data of the supplier
 *   (public site settings, loaded once per session).
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { PortalSessionService } from '../../portal-session.service';
import { portalTexts } from '../../portal-ui';

@Component({
  selector: 'app-portal-contacts',
  standalone: true,
  templateUrl: './portal-contacts.component.html',
  styleUrls: ['../portal-section.css', './portal-contacts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalContactsComponent implements OnInit {
  readonly session = inject(PortalSessionService);
  readonly t = portalTexts();

  ngOnInit(): void {
    this.session.loadCompanySettings();
  }
}
