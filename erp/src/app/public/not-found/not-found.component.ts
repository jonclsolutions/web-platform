/**
 * @file not-found.component.ts
 * @path src/app/public/not-found/not-found.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public "page not found" (404), shared by every public application. The public
 *   area of the route (`publicArea` of the layout, public-area.ts) decides the translations
 *   (`not_found` of its module), the target of the button and the look (dark with the
 *   illustration / light). The page is rendered inside the layout of its area (header, footer,
 *   navigation), and only for a URL no route knows - the URL stays as typed.
 * @dependencies
 * - BasePublicComponent: translations of the module of the area.
 * - routePublicArea: home page and look of the area.
 * - Meta: robots noindex while the page is shown.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { BasePublicComponent } from '../base-public.component';
import { PublicArea, publicAreaHome, routePublicArea } from '../public-area';

/** Robots meta tag selector managed by this page. */
const ROBOTS_SELECTOR = 'name="robots"';

/**
 * @description 404 page of the public areas.
 * @usage Only through `publicNotFoundRoute('<area>')` inside the layout of an application -
 *   never placed in a template.
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

  /** Public area of the page (home page, look); outside every area: the root, light. */
  readonly area: PublicArea = routePublicArea() ?? { translationModule: '', path: '', theme: 'light' };
  /** Home page of the area (button). */
  readonly homeLink = publicAreaHome(this.area);

  /** Robots tag present before this page (restored when leaving), null = none. */
  private previousRobots: string | null = null;

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
