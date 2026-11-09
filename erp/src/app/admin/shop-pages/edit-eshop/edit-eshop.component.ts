/**
 * @file edit-eshop.component.ts
 * @path src/app/admin/shop-pages/edit-eshop/edit-eshop.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manages internationalization (i18n) settings, translation keys, and language
 * metadata for the shop module.
 *
 * @dependencies
 * - BaseTranslationEditorComponent: language/translation editor logic.
 * - PageTitlesEditorComponent: browser page titles of the e-shop pages (tab "Page titles",
 *   API shop/page-titles) - managed here, so the module carries its own page titles.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseTranslationEditorComponent } from '../../../shared/components/base-translation-editor/base-translation-editor.component';
import { PageTitlesEditorComponent } from '../../components/page-titles-editor/page-titles-editor.component';

/**
 * @description Translation editor of the `shop` module.
 * @usage Route `/admin/shop/edit-eshop`; template and styles are page-specific.
 */
@Component({
  selector: 'app-edit-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, PageTitlesEditorComponent],
  templateUrl: './edit-eshop.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../shared/styles/base.css', '../../shared-styles/settings-page.css', './edit-eshop.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditEshopComponent extends BaseTranslationEditorComponent {

  protected override translationSection: string = 'edit-eshop';

  protected override readonly MODULE = 'shop';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-eshop:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-eshop:translations:';
  protected override readonly UPDATE_PERMISSION = 'shop-edit-eshop-update';

  /** Active page tab: the translations (default) or the browser page titles. */
  activeTab: 'translations' | 'page_titles' = 'translations';
  /** The page titles tab was opened - its editor stays created (hidden) from then on. */
  titlesOpened = false;
  /** Unsaved page title edits (dot on the tab). */
  titlesDirty = false;

  /**
   * @description Switches the page tab; the page titles editor is created (and loads) on the
   *   first open.
   * @param tab Target tab.
   */
  switchTab(tab: 'translations' | 'page_titles'): void {
    this.activeTab = tab;
    if (tab === 'page_titles') this.titlesOpened = true;
    this.cd.markForCheck();
  }
}
