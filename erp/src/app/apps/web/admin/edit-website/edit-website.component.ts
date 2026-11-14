/**
 * @file edit-website.component.ts
 * @path src/app/apps/web/admin/edit-website/edit-website.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the website: translations of the `web` module, the browser page titles
 *   of the website pages (API web/page-titles) and the content of the website stored in the
 *   database - FAQ, open positions and references (extra tabs, API web/faq, web/jobs,
 *   web/references).
 *
 * @dependencies
 * - BaseTranslationEditorComponent: language / translation editor logic and tabs.
 * - TranslationEditorViewComponent: the page; the panels of the extra tabs are its content.
 * - FaqEditorComponent, JobsEditorComponent, ReferencesEditorComponent: the extra tabs.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  BaseTranslationEditorComponent, TranslationEditorTab
} from '../../../../admin/components/translation-editor/base-translation-editor.component';
import { TranslationEditorViewComponent } from '../../../../admin/components/translation-editor/translation-editor-view.component';
import { FaqEditorComponent } from './content-editors/faq-editor/faq-editor.component';
import { JobsEditorComponent } from './content-editors/jobs-editor/jobs-editor.component';
import { ReferencesEditorComponent } from './content-editors/references-editor/references-editor.component';

/**
 * @description Translation editor of the `web` module with the content tabs of the website.
 * @usage Route `/admin/web/edit-website`.
 */
@Component({
  selector: 'app-edit-website',
  standalone: true,
  imports: [TranslationEditorViewComponent, FaqEditorComponent, JobsEditorComponent, ReferencesEditorComponent],
  templateUrl: './edit-website.component.html',
  styleUrls: ['../../../../admin/shared-styles/settings-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditWebsiteComponent extends BaseTranslationEditorComponent {
  protected override translationSection: string = 'edit-website';

  protected override readonly MODULE = 'web';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-website:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-website:translations:';
  protected override readonly UPDATE_PERMISSION = 'web-edit-website-update';

  /** FAQ, open positions and references of the website. */
  override readonly extraTabs: TranslationEditorTab[] = [
    { key: 'faq', labelKey: 'tab_faq', icon: 'help-circle' },
    { key: 'jobs', labelKey: 'tab_jobs', icon: 'briefcase' },
    { key: 'references', labelKey: 'tab_references', icon: 'star' },
  ];
}
