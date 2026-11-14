/**
 * @file portal-settings.component.ts
 * @path src/app/apps/project-portal/admin/portal-settings/portal-settings.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Portal settings" (project-portal/settings): the browser tab titles of the
 *   public pages of the portal - the client portal of a project and the order form - in the
 *   shared editor of the core (area `project-portal`, API project-portal/page-titles).
 * @dependencies PageTitlesEditorComponent (core), PageHelpComponent, AdminLocalizationService
 *   (section `project-portal-settings`).
 */

import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';
import { PageTitlesEditorComponent } from '../../../../admin/components/page-titles-editor/page-titles-editor.component';

@Component({
  selector: 'app-portal-settings',
  standalone: true,
  imports: [PageHelpComponent, PageTitlesEditorComponent],
  templateUrl: './portal-settings.component.html',
  styleUrl: './portal-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalSettingsComponent {
  /** i18n section of the page (also the labels of the pages: `pt_page_project-portal_*`). */
  readonly section = 'project-portal-settings';

  /** Unsaved titles in the editor (the browser asks before leaving). */
  titlesDirty = false;

  private readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Text of the page section.
   * @param key Key in `project-portal-settings`.
   */
  t(key: string): string {
    return this.i18n.getValue(`${this.section}.${key}`);
  }

  /**
   * @description Asks the browser to confirm leaving the page with unsaved titles.
   * @param event The beforeunload event.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.titlesDirty) event.preventDefault();
  }
}
