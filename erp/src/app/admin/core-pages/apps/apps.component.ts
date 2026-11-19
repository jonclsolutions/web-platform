/**
 * @file apps.component.ts
 * @path src/app/admin/core-pages/apps/apps.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Applications" of the core (/admin/core/apps): the installed applications the
 *   user may open, one below the other - name and short description, the state of the public
 *   part (green online / amber problem / red maintenance or unavailable), a light diagnosis (data
 *   response, log entries and errors in 24 h, last activity / error), the maintenance switch (with
 *   its permission) and the button "Manage", which opens the first page of the application the
 *   user may open. The same applications as the switcher in the header.
 * @dependencies AdminModulesService (which applications / landing page), AppStatusService (state
 *   and diagnosis, `core/apps/status`), AppStatusControlComponent (switch), AdminLocalizationService
 *   (section `apps`, `app-status`; names and descriptions in `admin-layout`), AdminIconComponent,
 *   PageHeaderComponent.
 * @note No permission - the page lists only what the user may open (nothing without any application).
 */

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AdminModulesService } from '../../admin-modules.service';
import { AdminIconComponent } from '../../components/admin-icon/admin-icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { AppManifest } from '../../../apps/apps.registry';
import { AppStatus, AppStatusService } from '../../components/app-status/app-status.service';
import { AppStatusControlComponent } from '../../components/app-status/app-status-control.component';

/** One row of the page. */
export interface AppCard {
  app: AppManifest;
  /** Landing page of the application for the user. */
  url: string;
}

@Component({
  selector: 'app-apps',
  standalone: true,
  imports: [RouterModule, DatePipe, AdminIconComponent, PageHeaderComponent, AppStatusControlComponent],
  templateUrl: './apps.component.html',
  styleUrls: ['../../shared-styles/welcome-links.css', './apps.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppsComponent implements OnInit {
  public readonly i18n = inject(AdminLocalizationService);
  private readonly modules = inject(AdminModulesService);
  readonly status = inject(AppStatusService);

  ngOnInit(): void {
    this.status.load(true);
  }

  /** @description Loads the state of the applications again. */
  refresh(): void {
    this.status.load(true);
  }

  /**
   * @description State of an application (undefined while loading).
   * @param id Application id.
   */
  statusOf(id: string): AppStatus | undefined {
    return this.status.statusOf(id);
  }

  /**
   * @description Text of the section `app-status` (labels of the health).
   * @param key Key inside `app-status`.
   */
  statusText(key: string): string {
    return this.i18n.getValue(`app-status.${key}`);
  }

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
