/**
 * @file web-text-editor.component.ts
 * @path src/app/apps/web/admin/edit-website/web-text-editor/web-text-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Visual text editor of the website: the texts of the `web` module edited right on
 *   the pages of the website (VisualTextEditorViewComponent). The same translation state, cache
 *   and permission as the list of the texts (EditWebsiteComponent).
 * @note Leaving with unsaved edits asks first (unsavedTextsGuard of the route).
 * @dependencies BaseTranslationEditorComponent, VisualTextEditorViewComponent
 */

import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { BaseTranslationEditorComponent } from '../../../../../admin/components/translation-editor/base-translation-editor.component';
import {
  VisualEditorDetailPage, VisualEditorPage, VisualTextEditorViewComponent,
} from '../../../../../admin/components/translation-editor/visual-text-editor/visual-text-editor-view.component';
import { LeaveConfirmable } from '../../../../../admin/components/translation-editor/unsaved-texts.guard';
import { TEXT_EDITOR_BANNERS_PATH } from '../../../../../public/text-editor/text-editor-protocol';


/** Pages of the website in the page list of the editor (names = the page titles editor). */
export const WEB_EDITOR_PAGES: VisualEditorPage[] = [
  { path: '/', labelKey: 'pt_page_web_home' },
  { path: '/services', labelKey: 'pt_page_web_services' },
  { path: '/references', labelKey: 'pt_page_web_references' },
  { path: '/about-us', labelKey: 'pt_page_web_about_us' },
  { path: '/jobs', labelKey: 'pt_page_web_jobs' },
  { path: '/faq', labelKey: 'pt_page_web_faq' },
  { path: '/knowledge-base', labelKey: 'pt_page_web_knowledge_base' },
  { path: '/contact', labelKey: 'pt_page_web_contact' },
  { path: '/privacy-policy', labelKey: 'pt_page_web_privacy_policy' },
  { path: '/tos', labelKey: 'pt_page_web_tos' },
  { path: '/cookies-policy', labelKey: 'pt_page_web_cookies_policy' },
  { path: '/404', labelKey: 'pt_page_web_not_found' },
  { path: '/maintenance', labelKey: 'pt_page_web_web_maintenance' },
  // not a page of its own: the home page with the cookie bar and the language offer shown
  { path: TEXT_EDITOR_BANNERS_PATH, labelKey: 'editor_page_banners' },
];

/** Details of the website reached by a click in the preview (the page list names them). */
export const WEB_EDITOR_DETAIL_PAGES: VisualEditorDetailPage[] = [
  { pattern: /^\/jobs\/[^/]+$/, labelKey: 'pt_page_web_job_detail' },
];

/**
 * @description Visual text editor of the `web` module.
 * @usage Route `/admin/web/edit-website/editor` (button "Otevřít editor" of the texts page).
 */
@Component({
  selector: 'app-web-text-editor',
  standalone: true,
  imports: [VisualTextEditorViewComponent],
  template: `<app-visual-text-editor-view [e]="this" [pages]="pages" [detailPages]="detailPages" backRoute="/admin/web/edit-website" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebTextEditorComponent extends BaseTranslationEditorComponent implements LeaveConfirmable {
  protected override translationSection: string = 'edit-website';

  protected override readonly MODULE = 'web';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-website:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-website:translations:';
  protected override readonly UPDATE_PERMISSION = 'web-edit-website-update';

  /** Pages offered in the editor. */
  readonly pages = WEB_EDITOR_PAGES;
  readonly detailPages = WEB_EDITOR_DETAIL_PAGES;

  @ViewChild(VisualTextEditorViewComponent) private view?: VisualTextEditorViewComponent;

  /**
   * @description Leaving the editor with unsaved edits asks first (unsavedTextsGuard - Back,
   *   close, links to the parts).
   * @returns true = leave, false = stay.
   */
  confirmLeave(): boolean | Promise<boolean> {
    return this.view ? this.view.confirmLeave() : true;
  }
}
