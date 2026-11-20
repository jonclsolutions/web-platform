/**
 * @file maintenance-shell.component.ts
 * @path src/app/shared/components/maintenance-shell/maintenance-shell.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The one look of every maintenance page (public web, e-shop, project portal):
 *   the dark page of the public website with two violet shapes (top left, bottom right), the
 *   language switcher in the top
 *   left corner, the logo at the top, the notice in the middle (heading, text, optional note and
 *   one action - a link back or "try again"), the contacts and social links in the bottom right
 *   corner and an optional quiet link to the admin sign-in. Presentational: the page passes the
 *   texts and data of its module and reacts to `languageSelected` / `action`; the look lives only
 *   here.
 * @usage
 *   <app-maintenance-shell [heading]="…" [text]="…" [languages]="…" [currentLanguage]="…"
 *     [actionLabel]="…" (action)="retry()" (languageSelected)="switch($event)" />
 * @dependencies AuthLanguageSwitcherComponent (language switcher), RouterLink.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthLanguage, AuthLanguageSwitcherComponent } from '../auth-language-switcher/auth-language-switcher.component';

/** Logo at the top of the maintenance page. */
export const MAINTENANCE_LOGO = 'assets/images/logos/logo_big.svg';

/** One social link of the contacts. */
export interface MaintenanceSocialLink {
  name: string;
  url: string;
  /** URL of the icon. */
  icon: string;
}

@Component({
  selector: 'app-maintenance-shell',
  standalone: true,
  imports: [RouterLink, AuthLanguageSwitcherComponent],
  templateUrl: './maintenance-shell.component.html',
  styleUrls: ['../../styles/base.css', './maintenance-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceShellComponent {
  /** Heading of the notice. */
  @Input() heading = '';
  /** Main text of the notice (plain text, line breaks kept). */
  @Input() text = '';
  /** Smaller note under the text ('' = none). */
  @Input() note = '';

  /** Languages of the switcher (empty = no switcher). */
  @Input() languages: readonly AuthLanguage[] = [];
  /** Code of the current language. */
  @Input() currentLanguage = '';
  /** Accessible name of the switcher. */
  @Input() languageLabel = '';

  /** Text of the action ('' = no action). */
  @Input() actionLabel = '';
  /** Router link of the action; null = a button emitting `action` (e.g. "Try again"). */
  @Input() actionLink: string | null = null;
  /** The action is running (button disabled). */
  @Input() actionBusy = false;

  /** Contact e-mail ('' = none). */
  @Input() email = '';
  /** Contact phone ('' = none). */
  @Input() phone = '';
  /** Social links. */
  @Input() socialLinks: readonly MaintenanceSocialLink[] = [];

  /** Label of the quiet admin sign-in link ('' = no link). */
  @Input() adminLoginLabel = '';

  /** Logo at the top. */
  @Input() logo = MAINTENANCE_LOGO;

  /** Code of the chosen language. */
  @Output() languageSelected = new EventEmitter<string>();
  /** The action button was clicked (only without `actionLink`). */
  @Output() action = new EventEmitter<void>();

  /** @description tel: link of the phone (spaces removed). */
  get phoneHref(): string {
    return 'tel:' + this.phone.replace(/\s/g, '');
  }

  /** @description Whether the contacts corner has anything to show. */
  get hasContacts(): boolean {
    return !!(this.email || this.phone || this.socialLinks.length);
  }
}
