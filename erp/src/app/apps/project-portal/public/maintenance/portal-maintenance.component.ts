/**
 * @file portal-maintenance.component.ts
 * @path src/app/apps/project-portal/public/maintenance/portal-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance page of the public project portal (/projects/maintenance) in the one
 *   maintenance look of the application (MaintenanceShellComponent): the text of the
 *   administrator (or the default one), the language switcher of the portal texts, the contacts
 *   of the site and "Try again", which returns to the page the visitor came from once the portal
 *   is online again. One status check on load does the same.
 * @dependencies PublicDataService (status, site settings), ProjectPortalLocalizationService (texts
 *   `maintenance_*`), MaintenanceShellComponent.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';
import { MaintenanceShellComponent, MaintenanceSocialLink } from '../../../../shared/components/maintenance-shell/maintenance-shell.component';
import { PORTAL_MAINTENANCE_URL, PORTAL_STATUS_ENDPOINT, PortalStatus } from './portal-maintenance';

@Component({
  selector: 'app-portal-maintenance',
  standalone: true,
  imports: [MaintenanceShellComponent],
  templateUrl: './portal-maintenance.component.html',
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
  /** Contact e-mail / phone of the site settings ('' = none). */
  email = '';
  phone = '';
  /** Social links of the site settings. */
  socialLinks: MaintenanceSocialLink[] = [];

  /** Languages of the portal texts (switcher). */
  readonly languages = this.portalI18n.availableLanguages;

  /**
   * @description Text of the portal by key.
   * @param key Key of the portal texts.
   */
  t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  ngOnInit(): void {
    this.portalI18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    // Contacts of the site (cached at the start of the application).
    this.publicData.siteSettingsValue$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(res => {
      this.email = res?.settings?.contact_email ?? '';
      this.phone = res?.settings?.contact_phone ?? '';
      this.socialLinks = (res?.social_links ?? []).map((link: any) => ({
        name: link.name, url: link.url, icon: this.publicData.getStorageUrl(link.icon_path),
      }));
      this.cdr.markForCheck();
    });
    this.check();
  }

  /** @description Code of the current language of the portal texts. */
  get currentLanguage(): string {
    return this.portalI18n.getCurrentLanguage();
  }

  /**
   * @description Switches the language of the portal texts (remembered in the browser).
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.portalI18n.setLanguage(code);
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
