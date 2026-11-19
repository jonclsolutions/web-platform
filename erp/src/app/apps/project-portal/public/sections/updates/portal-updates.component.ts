/**
 * @file portal-updates.component.ts
 * @path src/app/apps/project-portal/public/sections/updates/portal-updates.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Updates of the project portal (/projects/:token/updates): what the supplier
 *   published about the project, newest first, with files. Reloaded when the section opens and
 *   after a refresh of the header.
 * @dependencies PortalSessionService (provided by PortalLayoutComponent)
 */

import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PortalSessionService } from '../../portal-session.service';
import { formatFileSize, portalTexts } from '../../portal-ui';

@Component({
  selector: 'app-portal-updates',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './portal-updates.component.html',
  styleUrls: ['../portal-section.css', './portal-updates.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalUpdatesComponent implements OnInit {
  readonly session = inject(PortalSessionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly t = portalTexts();
  readonly formatFileSize = formatFileSize;

  ngOnInit(): void {
    this.session.loadUpdates();
    this.session.refreshed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.session.loadUpdates());
  }
}
