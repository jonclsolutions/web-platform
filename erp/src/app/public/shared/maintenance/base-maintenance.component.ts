/**
 * @file base-maintenance.component.ts
 * @path src/app/public/shared/maintenance/base-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared base of the maintenance pages of the public web and the e-shop (VT-15):
 * one template (maintenance-page.component.html) and one look for both, with a language dropdown.
 * The dropdown uses the same LocalizationService as the header of the main pages, so the
 * language is the one chosen there, and a choice made here is kept for the next visit
 * (localStorage `selectedLanguage`, shared by the web and the e-shop). While the page is shown
 * it polls nothing - one status check on load sends the visitor back as soon as the section is
 * active again.
 * @usage `class WebMaintenanceComponent extends BaseMaintenanceComponent` with
 *   `templateUrl: '../../shared/maintenance/maintenance-page.component.html'`, the translation
 *   key / module and `isSectionActive()` + `activeUrl`.
 * @dependencies
 * - BasePublicComponent: translations, site settings, social links.
 * - LocalizationService: languages of the module, current language, setLanguage().
 */

import { Directive, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../base-public.component';
import { LangMeta } from '../../../shared/services/localization.service';

@Directive()
export abstract class BaseMaintenanceComponent extends BasePublicComponent {
  protected override readonly loadSiteSettings = true;
  protected router = inject(Router);

  /** Where the visitor is sent once the section is active again. */
  protected abstract readonly activeUrl: string;
  /** Link of the "back to the web" button - null shows the "try again" button instead (the web itself is in maintenance). */
  readonly homeLink: string | null = null;

  /** Active languages of the module (the same list as the header of the main pages). */
  languages: LangMeta[] = [];
  /** Whether the language dropdown is open. */
  isLangOpen = false;

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
   * logged. Run on load and by the "try again" button.
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

  /** @description Language shown on the dropdown button. */
  get activeLang(): LangMeta | undefined {
    const code = this.localizationService.getCurrentLanguage();
    return this.languages.find(l => l.code === code);
  }

  /** @description Current language code. */
  get currentLang(): string {
    return this.localizationService.getCurrentLanguage();
  }

  /** @description Opens / closes the language dropdown. */
  toggleLang(): void {
    this.isLangOpen = !this.isLangOpen;
  }

  /**
   * @description Switches the page language - stored in the browser by LocalizationService, so
   * the next visit (and the main pages) start in it.
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.localizationService.setLanguage(code);
    this.isLangOpen = false;
  }

  /**
   * @description Closes the dropdown on a click outside it.
   * @param event Click anywhere on the page.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isLangOpen && !(event.target as HTMLElement | null)?.closest('.maintenance-lang')) {
      this.isLangOpen = false;
      this.cdr.markForCheck();
    }
  }
}
