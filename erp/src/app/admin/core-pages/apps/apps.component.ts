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
 *   user may open. The same applications as the switcher in the header. The states and the
 *   diagnosis refresh themselves every 10 s while the tab is visible (AppStatusService.poll).
 * @dependencies AdminModulesService (which applications / landing page), AppStatusService (state
 *   and diagnosis, `core/apps/status`), AppStatusControlComponent (switch), AdminLocalizationService
 *   (section `apps`, `app-status`; names and descriptions in `admin-layout`), AdminIconComponent,
 *   PageHeaderComponent.
 * @note No permission - the page lists only what the user may open (nothing without any application).
 */

import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, timer } from 'rxjs';
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
  /** Interval of the automatic refresh of the states and the diagnosis (ms). */
  static readonly POLL_INTERVAL_MS = 10_000;

  public readonly i18n = inject(AdminLocalizationService);
  private readonly modules = inject(AdminModulesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly status = inject(AppStatusService);

  /**
   * @description Loads the states, then refreshes them quietly every 10 s while the page is open
   *   and the browser tab is visible (a hidden tab sends nothing).
   */
  ngOnInit(): void {
    this.status.load(true);
    timer(AppsComponent.POLL_INTERVAL_MS, AppsComponent.POLL_INTERVAL_MS)
      .pipe(filter(() => !document.hidden), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.status.poll());
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
