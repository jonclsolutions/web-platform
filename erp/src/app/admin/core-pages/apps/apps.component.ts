/**
 * @file apps.component.ts
 * @path src/app/admin/core-pages/apps/apps.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Applications" of the core (/admin/core/apps): a card of every installed
 *   application the user may open (name, short description) with the button "Manage", which opens
 *   the first page of the application the user may open. The same applications as the switcher in
 *   the header.
 * @dependencies AdminModulesService (which applications / landing page), AdminLocalizationService
 *   (section `apps`; names and descriptions in `admin-layout`), AdminIconComponent, PageHelpComponent.
 * @note No permission - the page lists only what the user may open (nothing without any application).
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AdminModulesService } from '../../admin-modules.service';
import { AdminIconComponent } from '../../components/admin-icon/admin-icon.component';
import { PageHelpComponent } from '../../components/page-help/page-help.component';
import { AppManifest } from '../../../apps/apps.registry';

/** One card of the page. */
export interface AppCard {
  app: AppManifest;
  /** Landing page of the application for the user. */
  url: string;
}

@Component({
  selector: 'app-apps',
  standalone: true,
  imports: [RouterModule, AdminIconComponent, PageHelpComponent],
  templateUrl: './apps.component.html',
  styleUrls: ['../../shared-styles/welcome-page.css', '../../shared-styles/welcome-links.css', './apps.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppsComponent {
  public readonly i18n = inject(AdminLocalizationService);
  private readonly modules = inject(AdminModulesService);

  /** @description Texts of the page (section `apps`, merged with `shared`). */
  get strings(): any {
    return this.i18n.getMergedSection('apps');
  }

  /** @description Applications the user may open, with their landing page. */
  get cards(): AppCard[] {
    return this.modules.availableApps()
      .map(app => ({ app, url: this.modules.landingUrl(app.id) }))
      .filter((card): card is AppCard => card.url !== null);
  }

  /**
   * @description Text of the admin-layout section (names and descriptions of the applications).
   * @param key Key inside `admin-layout`.
   */
  layoutText(key: string): string {
    return this.i18n.getValue(`admin-layout.${key}`);
  }
}
