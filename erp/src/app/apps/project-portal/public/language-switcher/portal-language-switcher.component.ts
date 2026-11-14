/**
 * @file portal-language-switcher.component.ts
 * @path src/app/apps/project-portal/public/language-switcher/portal-language-switcher.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Language switcher of the public pages of the portal (client portal, order form):
 *   the flag of the current language with a chevron; the menu lists the languages of the portal
 *   texts and switches them (ProjectPortalLocalizationService, remembered in the browser).
 * @usage `<app-portal-language-switcher [label]="t('language_switcher_title')">`
 */

import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';

@Component({
  selector: 'app-portal-language-switcher',
  standalone: true,
  templateUrl: './portal-language-switcher.component.html',
  styleUrls: ['../../../../admin/shared-styles/theme.css', './portal-language-switcher.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalLanguageSwitcherComponent {
  /** Title / accessible name of the button (translated by the host page). */
  @Input() label = '';

  readonly portalI18n = inject(ProjectPortalLocalizationService);

  /** Whether the menu of the languages is open. */
  isOpen = false;

  /** @description Languages of the portal with flag and own name. */
  get languages() {
    return this.portalI18n.availableLanguages;
  }

  /** @description The current language (flag of the button). */
  get current() {
    return this.languages.find(l => l.code === this.portalI18n.getCurrentLanguage());
  }

  /** @description Opens / closes the menu. */
  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  /** @description Closes the menu (click outside). */
  close(): void {
    this.isOpen = false;
  }

  /**
   * @description Switches the language of the portal texts and closes the menu.
   * @param code Language code.
   */
  select(code: string): void {
    this.portalI18n.setLanguage(code);
    this.isOpen = false;
  }
}
