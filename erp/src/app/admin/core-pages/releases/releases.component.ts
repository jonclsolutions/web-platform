/**
 * @file releases.component.ts
 * @path src/app/admin/core-pages/releases/releases.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Releases" of the core (/admin/core/releases): the running version and the
 *   releases up to it, newest first, each with its changes (type, area, admin / public part,
 *   text, ticket). Filter by area: all, the core or one of the user's applications (`?area=` -
 *   opened that way from the notice after an update). The newest release is expanded.
 * @dependencies ReleaseNotesService (`core/releases`), AdminModulesService (applications of the
 *   user), AdminLocalizationService (section `releases`, names in `admin-layout`), PageHeaderComponent,
 *   RowButtonBuilderComponent (area filter).
 * @note No permission - every administrator sees the core and the applications he may open.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AdminModulesService } from '../../admin-modules.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { RowButtonBuilderComponent } from '../../components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems } from '../../components/builders/row-button-builder/row-button';
import { AdminIconName } from '../../components/admin-icon/admin-icon.component';
import { appById } from '../../../apps/apps.registry';
import { Release, ReleaseChange, ReleaseNotesService } from '../../components/releases/release-notes.service';
import { AdminDatePipe } from '../../shared-date/admin-date.pipe';

/** One filter button. */
export interface ReleaseArea {
  /** `all`, `core` or an application id. */
  id: string;
  label: string;
  /** Icon of the button (layers = all, layout = the core, the icon of an application). */
  icon: AdminIconName;
}

@Component({
  selector: 'app-releases',
  standalone: true,
  imports: [AdminDatePipe, DatePipe, PageHeaderComponent, RowButtonBuilderComponent],
  templateUrl: './releases.component.html',
  styleUrls: ['./releases.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleasesComponent implements OnInit {
  readonly notes = inject(ReleaseNotesService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly modules = inject(AdminModulesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);

  /** Selected area (`all` = everything). */
  area = 'all';
  /** Versions opened by the user (the newest is open until he closes it). */
  private readonly toggled = new Set<string>();

  ngOnInit(): void {
    this.notes.load();
    this.route.queryParamMap.subscribe(params => {
      const area = params.get('area');
      this.area = area && this.areas.some(a => a.id === area) ? area : 'all';
      this.cd.markForCheck();
    });
  }

  /** Texts of the section `releases`. */
  get strings(): Record<string, string> {
    return this.i18n.getMergedSection('releases');
  }

  /** Filter buttons: all, the core, the user's applications. */
  get areas(): ReleaseArea[] {
    return [
      { id: 'all', label: this.strings['area_all'], icon: 'layers' },
      { id: 'core', label: this.i18n.getValue('admin-layout.module_core'), icon: 'layout' },
      ...this.modules.availableApps().map(app => ({ id: app.id, label: this.i18n.getValue(`admin-layout.${app.nameKey}`), icon: app.icon })),
    ];
  }

  /** Stable buttons of the area filter. */
  private readonly areaButtons = new RowButtonItems();

  /** @description Area filter as row buttons (icon + name). */
  get areaItems(): RowButton[] {
    return this.areaButtons.update(this.areas.map(a => ({ value: a.id, label: a.label, icon: a.icon })));
  }

  /** Releases with the changes of the selected area (releases without one are left out). */
  get releases(): Release[] {
    const all = this.notes.notes()?.releases ?? [];
    if (this.area === 'all') return all;
    return all
      .map(release => ({ ...release, changes: release.changes.filter(change => change.area === this.area) }))
      .filter(release => release.changes.length > 0);
  }

  /**
   * @description Selects an area (kept in the address, so the page can be shared or reloaded).
   * @param id Area id.
   */
  select(id: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { area: id === 'all' ? null : id }, replaceUrl: true });
  }

  /**
   * @description The release is expanded: the newest one unless toggled, the others when toggled.
   * @param release Release.
   * @param index Position in the list.
   */
  isOpen(release: Release, index: number): boolean {
    return (index === 0) !== this.toggled.has(release.version);
  }

  /**
   * @description Expands / collapses a release.
   * @param release Release.
   */
  toggle(release: Release): void {
    if (this.toggled.has(release.version)) this.toggled.delete(release.version);
    else this.toggled.add(release.version);
  }

  /**
   * @description Label of the area of a change (core / application name).
   * @param change Change.
   */
  areaLabel(change: ReleaseChange): string {
    if (change.area === 'core') return this.i18n.getValue('admin-layout.module_core');
    const app = appById(change.area);
    return app ? this.i18n.getValue(`admin-layout.${app.nameKey}`) : change.area;
  }
}
