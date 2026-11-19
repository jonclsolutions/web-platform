/**
 * @file admin-auth-shell.component.ts
 * @path src/app/admin/auth/admin-auth-shell/admin-auth-shell.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The shared sign-in layout (AuthShellComponent) for the sign-in pages of the
 *   administration (login, account activation, password reset): the tagline and the language
 *   switcher with the languages of the admin (AdminLocalizationService - the language chosen
 *   here is the language of the admin after the sign-in). The page projects the content of the
 *   card.
 * @usage `<app-admin-auth-shell> …content of the card… </app-admin-auth-shell>`
 * @dependencies AuthShellComponent, AuthLanguageSwitcherComponent, AdminLocalizationService
 *   (texts `login.hero.title`, `login.language.label`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminLanguageMeta, AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AuthShellComponent } from '../../../shared/components/auth-shell/auth-shell.component';
import { AuthLanguageSwitcherComponent } from '../../../shared/components/auth-language-switcher/auth-language-switcher.component';

@Component({
  selector: 'app-admin-auth-shell',
  standalone: true,
  imports: [AuthShellComponent, AuthLanguageSwitcherComponent],
  template: `
    <app-auth-shell [tagline]="text('login.hero.title')">
      <app-auth-language-switcher authLang [languages]="languages" [current]="currentLanguage"
                                  [label]="text('login.language.label')" (selected)="selectLanguage($event)" />
      <ng-content></ng-content>
    </app-auth-shell>
  `,
  styles: [':host { display: block; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuthShellComponent {
  private readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Languages of the admin. */
  readonly languages: readonly AdminLanguageMeta[] = this.i18n.availableLanguages;

  constructor() {
    // OnPush: redraw the tagline and the switcher once the translations are (re)loaded.
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  /** @description Code of the current admin language. */
  get currentLanguage(): string {
    return this.i18n.getCurrentLanguage();
  }

  /**
   * @description Admin text by its full key.
   * @param key Key with the section (e.g. `login.hero.title`).
   */
  text(key: string): string {
    return this.i18n.getValue(key);
  }

  /**
   * @description Switches the language of the page (and of the admin after the sign-in).
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.i18n.setLanguage(code);
  }
}
