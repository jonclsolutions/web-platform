/**
 * @file base-maintenance.component.ts
 * @path src/app/public/shared/maintenance/base-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared base of the maintenance pages of the public web and the e-shop (VT-15):
 * one template (maintenance-page.component.html) passing the texts and data of the module to the
 * one maintenance look of the application (MaintenanceShellComponent, also used by the project
 * portal), with a language switcher.
 * The dropdown uses the same LocalizationService as the header of the main pages, so the
 * language is the one chosen there, and a choice made here is kept for the next visit
 * (localStorage `selectedLanguage`, shared by the web and the e-shop). While the page is shown
 * it polls nothing - one status check on load sends the visitor back as soon as the section is
 * active again.
 * @usage `class WebMaintenanceComponent extends BaseMaintenanceComponent` with
 *   `templateUrl` = public/shared/maintenance/maintenance-page.component.html, the translation
 *   key / module and `isSectionActive()` + `activeUrl`.
 * @dependencies
 * - BasePublicComponent: translations, site settings, social links.
 * - LocalizationService: languages of the module, current language, setLanguage().
 * - MaintenanceShellComponent: the look (imported by the page components).
 */

import { Directive, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../base-public.component';
import { LangMeta } from '../../../shared/services/localization.service';
import { AuthLanguage } from '../../../shared/components/auth-language-switcher/auth-language-switcher.component';
import { MaintenanceSocialLink } from '../../../shared/components/maintenance-shell/maintenance-shell.component';
import { LanguageRoutingService } from '../../../shared/services/language-routing.service';

@Directive()
export abstract class BaseMaintenanceComponent extends BasePublicComponent {
  protected override readonly loadSiteSettings = true;
  protected router = inject(Router);
  /** Switching the language together with the URL. */
  protected languageRouting = inject(LanguageRoutingService);

  /** Where the visitor is sent once the section is active again. */
  protected abstract readonly activeUrl: string;
  /** Active languages of the module (the same list as the header of the main pages). */
  languages: LangMeta[] = [];

  /**
   * @description Is the section (web / e-shop) active again?
   * @returns Observable of the status answer's flag.
   */
  protected abstract isSectionActive(): Observable<boolean>;

  /** @description Loads the languages and checks the status once. */
  protected override onInit(): void {
    this.localizationService.fetchLanguages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.languages = res.languages;
        this.cdr.markForCheck();
      });
    this.checkStatusAndRedirect();
  }

  /**
   * @description Sends the visitor back when the section is active again; an error is only
   * logged. Run once on load.
   */
  checkStatusAndRedirect(): void {
    this.isSectionActive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (active) => {
          if (active) this.router.navigate([this.activeUrl]);
        },
        error: (err) => console.error('Error checking the status during maintenance:', err)
      });
  }

  /** @description Current language code. */
  get currentLang(): string {
    return this.localizationService.getCurrentLanguage();
  }

  /** Languages and social links in the shape of the maintenance look (kept stable for OnPush). */
  private languageCache: { source: LangMeta[]; value: AuthLanguage[] } = { source: [], value: [] };
  private socialCache: { source: any[]; value: MaintenanceSocialLink[] } = { source: [], value: [] };

  /** @description Languages of the module for the switcher of the maintenance page. */
  get switcherLanguages(): AuthLanguage[] {
    if (this.languageCache.source !== this.languages) {
      this.languageCache = { source: this.languages, value: this.languages.map(l => ({ code: l.code, name: l.label, icon: l.flag })) };
    }
    return this.languageCache.value;
  }

  /** @description Social links of the site settings with the URL of their icon. */
  get maintenanceSocialLinks(): MaintenanceSocialLink[] {
    if (this.socialCache.source !== this.socialLinks) {
      this.socialCache = {
        source: this.socialLinks,
        value: (this.socialLinks ?? []).map(link => ({ name: link.name, url: link.url, icon: this.getIconUrl(link.icon_path) })),
      };
    }
    return this.socialCache.value;
  }

  /**
   * @description Switches the page language - stored in the browser by LocalizationService, so
   * the next visit (and the main pages) start in it; the URL moves to the language
   * (`/cs/maintenance` → `/en/maintenance`).
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.languageRouting.switchTo(code);
  }
}
