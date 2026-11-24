/**
 * @file nav-badge.component.ts
 * @path src/app/admin/components/nav-badge/nav-badge.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Badge of the admin navigation (AdminNotificationsService.navBadge()): the red
 *   number of unread records and / or the orange dot of things needing attention (texts missing
 *   in a language …). Its label is the tooltip and the screen-reader text - it names every kind
 *   behind the badge with its count ("Chybějící texty webu: 123 (angličtina 120)").
 * @dependencies NavBadge (admin-notifications.service).
 * @usage `<app-nav-badge [badge]="itemBadge(item)" class="nav-badge--item" />` - the class of the
 *   host only places it (margin, corner of a collapsed menu icon); `--nb-size` sets its height.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavBadge } from '../../../core/services/admin-notifications.service';

/**
 * @description Renders one navigation badge - nothing when there is no badge.
 */
@Component({
  selector: 'app-nav-badge',
  standalone: true,
  template: `
    @if (badge(); as b) {
      @if (b.text) {
        <span class="nb-count">{{ b.text }}</span>
      }
      @if (b.attention) {
        <span class="nb-dot"></span>
      }
    }
  `,
  styleUrl: './nav-badge.component.css',
  host: {
    '[attr.role]': 'badge() ? "img" : null',
    '[attr.aria-label]': 'badge()?.label ?? null',
    '[attr.title]': 'badge()?.label ?? null',
    '[class.nb-empty]': '!badge()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavBadgeComponent {
  /** The badge (null = nothing to show). */
  readonly badge = input<NavBadge | null>(null);
}
