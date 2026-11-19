/**
 * @file page-header.component.ts
 * @path src/app/admin/components/page-header/page-header.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The one header of every admin page (core and applications): the page title
 *   (h1), an optional subtitle, the actions of the page on the right and the help button ("?")
 *   at the right end - the same size, font, spacing and alignment on every page.
 * @usage
 *   <app-page-header [title]="t('table_header')" [subtitle]="t('subtitle')">
 *     <a phBefore class="…">← Back</a>            (optional, above the title - e.g. a back link)
 *     <span phMeta class="…">Public</span>         (optional, inline after the title - badges)
 *     <p phSub>…</p>                              (optional, rich subtitle instead of [subtitle])
 *     <app-action-menu-builder …></app-action-menu-builder>   (actions, right)
 *   </app-page-header>
 *   [help]="false" hides the help button (a page without its knowledge base page).
 * @dependencies PageHelpComponent (route data `help` of the page).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PageHelpComponent } from '../page-help/page-help.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [PageHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
})
export class PageHeaderComponent {
  /** Title of the page (the h1). */
  @Input({ required: true }) title = '';
  /** Optional one-line description under the title. */
  @Input() subtitle: string | null | undefined = null;
  /** Show the help button ("?") of the page route (default yes). */
  @Input() help = true;
}
