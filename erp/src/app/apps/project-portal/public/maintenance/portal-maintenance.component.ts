/**
 * @file portal-maintenance.component.ts
 * @path src/app/apps/project-portal/public/maintenance/portal-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance page of the public project portal (/projects/maintenance) in the light
 *   look of the client portal: the text of the administrator (or the default one), the language
 *   switcher and "Try again", which returns to the page the visitor came from once the portal is
 *   online again. One status check on load does the same.
 * @dependencies PublicDataService (status), ProjectPortalLocalizationService (texts
 *   `maintenance_*`), PortalLanguageSwitcherComponent.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';
import { PortalLanguageSwitcherComponent } from '../language-switcher/portal-language-switcher.component';
import { PORTAL_MAINTENANCE_URL, PORTAL_STATUS_ENDPOINT, PortalStatus } from './portal-maintenance';

@Component({
  selector: 'app-portal-maintenance',
  standalone: true,
  imports: [PortalLanguageSwitcherComponent],
  templateUrl: './portal-maintenance.component.html',
  styleUrls: ['../../../../admin/shared-styles/theme.css', '../order-form/order-form.component.css', './portal-maintenance.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalMaintenanceComponent implements OnInit {
  readonly portalI18n = inject(ProjectPortalLocalizationService);
  private readonly publicData = inject(PublicDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Text of the administrator (null = the default text of the page). */
  message: string | null = null;
  /** A status check is running. */
  checking = false;

  /**
   * @description Text of the portal by key.
   * @param key Key of the portal texts.
   */
  t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  ngOnInit(): void {
    this.portalI18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    this.check();
  }

  /**
   * @description Address to return to: only a portal address of this site (`/projects/…`),
   *   never an outside URL or the maintenance page itself.
   */
  get returnUrl(): string | null {
    const target = this.route.snapshot.queryParamMap.get('return');
    return target && /^\/projects\/[^/]/.test(target) && !target.startsWith(PORTAL_MAINTENANCE_URL) && !target.startsWith('//') ? target : null;
  }

  /** @description Asks for the status; online again = back to the page of the visitor. */
  check(): void {
    this.checking = true;
    this.publicData.getFresh<PortalStatus>(PORTAL_STATUS_ENDPOINT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.checking = false;
          if (res?.is_portal_active && this.returnUrl) {
            this.router.navigateByUrl(this.returnUrl);
            return;
          }
          this.message = res?.maintenance_message ?? null;
          this.cdr.markForCheck();
        },
        error: () => { this.checking = false; this.cdr.markForCheck(); },
      });
  }
}
