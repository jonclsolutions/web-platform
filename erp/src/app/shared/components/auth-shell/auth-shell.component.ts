/**
 * @file auth-shell.component.ts
 * @path src/app/shared/components/auth-shell/auth-shell.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared layout of the sign-in pages (admin login, account activation, password
 *   reset, sign-in of the project portal): dark page with the brand grid, the logo with a short
 *   tagline on the left, the card on the right (whatever the page needs - a form, a code, a
 *   message) and the language switcher in the top-right corner. On a narrow screen the logo sits
 *   above the card.
 * @usage
 *   <app-auth-shell [tagline]="t.hero.title">
 *     <app-auth-language-switcher authLang ... />
 *     ...content of the card (form.auth-form, .auth-card-footer)...
 *   </app-auth-shell>
 *   The page styles its content with shared/styles/auth-form.css.
 * @dependencies none
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Logo of the left side (the big logo of the brand). */
export const AUTH_SHELL_LOGO = 'assets/images/logos/logo_big.svg';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  templateUrl: './auth-shell.component.html',
  styleUrls: ['../../styles/base.css', '../../styles/auth-form.css', './auth-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShellComponent {
  /** Short line under the logo (translated by the page; empty = none). */
  @Input() tagline = '';
  /** Logo of the left side. */
  @Input() logo = AUTH_SHELL_LOGO;
}
