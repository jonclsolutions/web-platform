/**
 * @file web-text-editor.component.ts
 * @path src/app/apps/web/admin/edit-website/web-text-editor/web-text-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Visual text editor of the website: the texts of the `web` module edited right on
 *   the pages of the website (VisualTextEditorViewComponent). The same translation state, cache
 *   and permission as the list of the texts (EditWebsiteComponent).
 * @dependencies BaseTranslationEditorComponent, VisualTextEditorViewComponent
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BaseTranslationEditorComponent } from '../../../../../admin/components/translation-editor/base-translation-editor.component';
import {
  VisualEditorPage, VisualTextEditorViewComponent,
} from '../../../../../admin/components/translation-editor/visual-text-editor/visual-text-editor-view.component';

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
];

/**
 * @description Visual text editor of the `web` module.
 * @usage Route `/admin/web/edit-website/editor` (button "Otevřít editor" of the texts page).
 */
@Component({
  selector: 'app-web-text-editor',
  standalone: true,
  imports: [VisualTextEditorViewComponent],
  template: `<app-visual-text-editor-view [e]="this" [pages]="pages" backRoute="/admin/web/edit-website" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebTextEditorComponent extends BaseTranslationEditorComponent {
  protected override translationSection: string = 'edit-website';

  protected override readonly MODULE = 'web';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-website:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-website:translations:';
  protected override readonly UPDATE_PERMISSION = 'web-edit-website-update';

  /** Pages offered in the editor. */
  readonly pages = WEB_EDITOR_PAGES;
}
