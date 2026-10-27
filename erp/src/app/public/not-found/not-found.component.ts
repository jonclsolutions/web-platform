/**
 * @file not-found.component.ts
 * @path src/app/public/not-found/not-found.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Public "page not found" (404), shared by the public web and the e-shop. The area
 *   comes from the route data (`publicNotFoundRoute()`, see public-not-found.config.ts): it decides
 *   the translations (`not_found` of the web / shop module), the target of the button and the look
 *   (dark web / light e-shop). The page is rendered inside the layout of its area (header, footer,
 *   navigation), and only for a URL no route knows - the URL stays as typed.
 * @refactor-note (2026-10-23) `icon_path` removed - pointed to a non-existing file with a dev path
 *   (`/erp/src/assets/...`); the illustration is inline SVG in the template now (open finding #46).
 * @refactor-note (2026-10-27) Moved from `public/web-pages/not-found` to `public/not-found` and
 *   made shared: before, only the route `/404` existed (outside any layout, no catch-all route),
 *   an unknown URL did not render anything. Adds `<meta name="robots" content="noindex">` while
 *   shown (a single-page app answers HTTP 200 for every URL - search engines must not index the
 *   404 page as content).
 * @refactor-note (2026-10-27c) The requested path is no longer shown on the public page (it says
 *   nothing to a visitor); the admin error pages keep it.
 * @dependencies
 * - BasePublicComponent: translations (module set from the area before ngOnInit subscribes).
 * - PUBLIC_NOT_FOUND_AREAS: per-area settings.
 * - Meta: robots noindex while the page is shown.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { BasePublicComponent } from '../base-public.component';
import { PUBLIC_NOT_FOUND_AREAS, PUBLIC_NOT_FOUND_AREA_KEY, PublicNotFoundArea, PublicNotFoundAreaConfig } from './public-not-found.config';

/** Robots meta tag selector managed by this page. */
const ROBOTS_SELECTOR = 'name="robots"';

/**
 * @description 404 page of the public areas.
 * @usage Only through `publicNotFoundRoute('<area>')` - never placed in a template.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundComponent extends BasePublicComponent {

  protected readonly translationKey = 'not_found';

  private readonly meta = inject(Meta);

  /** Area of the page (route data; unknown / missing = web). */
  readonly area: PublicNotFoundArea = NotFoundComponent.areaOf(inject(ActivatedRoute).snapshot.data?.[PUBLIC_NOT_FOUND_AREA_KEY]);
  /** Settings of the area. */
  readonly config: PublicNotFoundAreaConfig = PUBLIC_NOT_FOUND_AREAS[this.area];
  protected override readonly translationModule = this.config.translationModule;

  /** Robots tag present before this page (restored when leaving), null = none. */
  private previousRobots: string | null = null;

  /**
   * @description Known area or the web.
   * @param value Route data value.
   */
  private static areaOf(value: unknown): PublicNotFoundArea {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PUBLIC_NOT_FOUND_AREAS, value)
      ? value as PublicNotFoundArea
      : 'web';
  }

  /** @description Marks the page as not indexable. */
  protected override onInit(): void {
    this.previousRobots = this.meta.getTag(ROBOTS_SELECTOR)?.content ?? null;
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }

  /** @description Restores the robots tag of the site. */
  protected override onDestroy(): void {
    if (this.previousRobots === null) {
      this.meta.removeTag(ROBOTS_SELECTOR);
    } else {
      this.meta.updateTag({ name: 'robots', content: this.previousRobots });
    }
  }
}
