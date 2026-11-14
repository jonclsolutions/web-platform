/**
 * @file edit-eshop.component.ts
 * @path src/app/apps/shop/admin/edit-eshop/edit-eshop.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the e-shop: translations of the `shop` module and the browser page
 *   titles of the e-shop pages (API shop/page-titles).
 * @dependencies
 * - BaseTranslationEditorComponent: language / translation editor logic and tabs.
 * - TranslationEditorViewComponent: the page.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BaseTranslationEditorComponent } from '../../../../admin/components/translation-editor/base-translation-editor.component';
import { TranslationEditorViewComponent } from '../../../../admin/components/translation-editor/translation-editor-view.component';

/**
 * @description Translation editor of the `shop` module.
 * @usage Route `/admin/shop/edit-eshop`.
 */
@Component({
  selector: 'app-edit-shop',
  standalone: true,
  imports: [TranslationEditorViewComponent],
  template: '<app-translation-editor-view [e]="this"></app-translation-editor-view>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEshopComponent extends BaseTranslationEditorComponent {
  protected override translationSection: string = 'edit-eshop';

  protected override readonly MODULE = 'shop';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-eshop:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-eshop:translations:';
  protected override readonly UPDATE_PERMISSION = 'shop-edit-eshop-update';
}
