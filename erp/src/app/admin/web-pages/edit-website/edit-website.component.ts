/**
 * @file edit-website.component.ts
 * @path src/app/admin/web-pages/edit-website/edit-website.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages internationalization (i18n) settings, translation keys, and language
 * metadata for the public web module.
 *
 * @dependencies
 * - BaseTranslationEditorComponent: language/translation editor logic.
 * - PageTitlesEditorComponent: browser page titles of the website pages (tab "Page titles",
 *   API web/page-titles) - managed here, so the module carries its own page titles.
 * - FaqEditorComponent, JobsEditorComponent: FAQ and open positions of the website (tabs "FAQ"
 *   and "Jobs", API web/faq, web/jobs) - content of the website stored in the database.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseTranslationEditorComponent } from '../../../shared/components/base-translation-editor/base-translation-editor.component';
import { PageTitlesEditorComponent } from '../../components/page-titles-editor/page-titles-editor.component';
import { FaqEditorComponent } from './content-editors/faq-editor/faq-editor.component';
import { JobsEditorComponent } from './content-editors/jobs-editor/jobs-editor.component';

/** Page tabs of the editor. */
export type EditWebsiteTab = 'translations' | 'page_titles' | 'faq' | 'jobs';

/**
 * @description Translation editor of the `web` module.
 * @usage Route `/admin/web/edit-website`; template and styles are page-specific.
 */
@Component({
  selector: 'app-edit-website',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, PageTitlesEditorComponent, FaqEditorComponent, JobsEditorComponent],
  templateUrl: './edit-website.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../shared/styles/base.css', '../../shared-styles/settings-page.css', './edit-website.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditWebsiteComponent extends BaseTranslationEditorComponent {

  protected override translationSection: string = 'edit-website';

  protected override readonly MODULE = 'web';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-website:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-website:translations:';
  protected override readonly UPDATE_PERMISSION = 'web-edit-website-update';

  /** Active page tab: the translations (default), the browser page titles, the FAQ or the jobs. */
  activeTab: EditWebsiteTab = 'translations';
  /** The page titles tab was opened - its editor stays created (hidden) from then on. */
  titlesOpened = false;
  /** Unsaved page title edits (dot on the tab). */
  titlesDirty = false;
  /** The FAQ / jobs tab was opened - its editor stays created (hidden) from then on. */
  faqOpened = false;
  jobsOpened = false;
  /** Unsaved FAQ / jobs edits (dot on the tab). */
  faqDirty = false;
  jobsDirty = false;

  /**
   * @description Switches the page tab; the editor of a tab is created (and loads) on its first
   *   open and stays created, so unsaved edits survive a tab switch.
   * @param tab Target tab.
   */
  switchTab(tab: EditWebsiteTab): void {
    this.activeTab = tab;
    if (tab === 'page_titles') this.titlesOpened = true;
    if (tab === 'faq') this.faqOpened = true;
    if (tab === 'jobs') this.jobsOpened = true;
    this.cd.markForCheck();
  }
}
