/**
 * @file edit-website.component.ts
 * @path src/app/apps/web/admin/edit-website/edit-website.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the website: translations of the `web` module, the browser page titles
 *   of the website pages (API web/page-titles) and the content of the website stored in the
 *   database - FAQ, open positions, references and the public knowledge base (extra tabs, API
 *   web/faq, web/jobs, web/references, web/knowledge-base).
 *
 * @dependencies
 * - BaseTranslationEditorComponent: language / translation editor logic and tabs.
 * - TranslationEditorViewComponent: the page; the panels of the extra tabs are its content.
 * - FaqEditorComponent, JobsEditorComponent, ReferencesEditorComponent, KnowledgeBaseEditorComponent:
 *   the extra tabs.
 * @note Unsaved edits of any tab: leaving the page asks first (unsavedTextsGuard).
 * @note `?tab=faq` (…) opens a tab - the visual text editor points to the part of a content.
 */

import { Component, ChangeDetectionStrategy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BaseTranslationEditorComponent, TranslationEditorTab
} from '../../../../admin/components/translation-editor/base-translation-editor.component';
import { TranslationEditorViewComponent } from '../../../../admin/components/translation-editor/translation-editor-view.component';
import { LeaveConfirmable } from '../../../../admin/components/translation-editor/unsaved-texts.guard';
import { FaqEditorComponent } from './content-editors/faq-editor/faq-editor.component';
import { JobsEditorComponent } from './content-editors/jobs-editor/jobs-editor.component';
import { ReferencesEditorComponent } from './content-editors/references-editor/references-editor.component';
import { KnowledgeBaseEditorComponent } from './content-editors/knowledge-base-editor/knowledge-base-editor.component';

/**
 * @description Translation editor of the `web` module with the content tabs of the website.
 * @usage Route `/admin/web/edit-website`.
 */
@Component({
  selector: 'app-edit-website',
  standalone: true,
  imports: [TranslationEditorViewComponent, FaqEditorComponent, JobsEditorComponent, ReferencesEditorComponent, KnowledgeBaseEditorComponent],
  templateUrl: './edit-website.component.html',
  styleUrls: ['../../../../admin/shared-styles/settings-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditWebsiteComponent extends BaseTranslationEditorComponent implements LeaveConfirmable {
  protected override translationSection: string = 'edit-website';

  protected override readonly MODULE = 'web';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-website:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-website:translations:';
  protected override readonly UPDATE_PERMISSION = 'web-edit-website-update';

  /** FAQ, open positions, references and the knowledge base of the website (orange number =
   *  records missing a text in an active language, WebNotificationSource). */
  override readonly extraTabs: TranslationEditorTab[] = [
    { key: 'faq', labelKey: 'tab_faq', icon: 'help-circle', attentionKind: 'web_faq_missing' },
    { key: 'jobs', labelKey: 'tab_jobs', icon: 'briefcase', attentionKind: 'web_jobs_missing' },
    { key: 'references', labelKey: 'tab_references', icon: 'star', attentionKind: 'web_references_missing' },
    { key: 'knowledge_base', labelKey: 'tab_knowledge_base', icon: 'book', attentionKind: 'web_kb_missing' },
  ];

  private readonly route = inject(ActivatedRoute);
  @ViewChild(TranslationEditorViewComponent) private view?: TranslationEditorViewComponent;

  /**
   * @description Leaving the page with unsaved edits of any tab asks first (unsavedTextsGuard -
   *   "Otevřít editor", the menu, Back).
   * @returns true = leave, false = stay.
   */
  confirmLeave(): boolean | Promise<boolean> {
    return this.view ? this.view.confirmLeave() : true;
  }

  /** @description Loads the page and opens the tab named in the address (`?tab=`, `&lang=`). */
  override ngOnInit(): void {
    super.ngOnInit();
    this.openTabOfUrl(this.route.snapshot.queryParamMap);
  }
}
