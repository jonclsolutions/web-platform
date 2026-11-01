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
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseTranslationEditorComponent } from '../../../shared/components/base-translation-editor/base-translation-editor.component';

/**
 * @description Translation editor of the `shop` module.
 * @usage Route `/admin/shop/edit-eshop`; template and styles are page-specific.
 */
@Component({
  selector: 'app-edit-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
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
}
