/**
 * @file library-page.component.ts
 * @path src/app/apps/js-creator/admin/library/library-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Library" (js-creator/library) of the OWN workspace - shared by every section:
 *   tabs Images (logos, backgrounds, photos for the fixed elements of templates), Fonts (the
 *   curated set and own fonts) and Icons (the icon set of the application), with the usage bar.
 * @dependencies LibraryImagesComponent, LibraryFontsComponent, LibraryIconsComponent,
 *   QuotaBarComponent, RowButtonBuilderComponent, AdminLocalizationService (section
 *   `js-creator-library`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { PageHeaderComponent } from '../../../../admin/components/page-header/page-header.component';
import { RowButtonBuilderComponent } from '../../../../admin/components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems } from '../../../../admin/components/builders/row-button-builder/row-button';
import { QuotaBarComponent } from '../shared/quota-bar/quota-bar.component';
import { LibraryImagesComponent } from './library-images/library-images.component';
import { LibraryFontsComponent } from './library-fonts/library-fonts.component';
import { LibraryIconsComponent } from './library-icons/library-icons.component';

/** Tab of the page. */
export type LibraryTab = 'images' | 'fonts' | 'icons';

@Component({
  selector: 'app-js-creator-library-page',
  standalone: true,
  imports: [PageHeaderComponent, RowButtonBuilderComponent, QuotaBarComponent, LibraryImagesComponent, LibraryFontsComponent, LibraryIconsComponent],
  templateUrl: './library-page.component.html',
  styleUrls: ['../shared-styles/workspace.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPageComponent {
  private readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Open tab. */
  tab: LibraryTab = 'images';

  private readonly tabButtons = new RowButtonItems();

  /**
   * @description Text of the page section.
   * @param key Key in `js-creator-library`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-library.${key}`);
  }

  /** @description Buttons of the tabs. */
  get tabItems(): RowButton[] {
    return this.tabButtons.update([
      { value: 'images', label: this.t('tab_images') },
      { value: 'fonts', label: this.t('tab_fonts') },
      { value: 'icons', label: this.t('tab_icons') },
    ]);
  }

  /**
   * @description Opens a tab.
   * @param value Tab.
   */
  switchTab(value: string): void {
    this.tab = value === 'fonts' || value === 'icons' ? value : 'images';
    this.cd.markForCheck();
  }
}
