/**
 * @file edit-eshop.component.ts
 * @path src/app/apps/shop/admin/edit-eshop/edit-eshop.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the e-shop: translations of the `shop` module and the browser page
 *   titles of the e-shop pages (API shop/page-titles) - the same page as the texts of the website
 *   (calmer actions, readable names of the keys, "Chybí" / "Jako CZ" filters), without the visual
 *   text editor for now.
 * @note Unsaved edits of any tab: leaving the page asks first (unsavedTextsGuard of the route).
 * @note `?tab=page_titles` opens a tab (links of the notifications).
 * @dependencies
 * - BaseTranslationEditorComponent: language / translation editor logic and tabs.
 * - TranslationEditorViewComponent: the page.
 * - unsavedTextsGuard (LeaveConfirmable): the question before leaving with unsaved edits.
 * - FooterCopyrightOptionComponent: the copyright line of the e-shop footer shown / hidden
 *   (shop/settings/footer) above the texts.
 */

import { Component, ChangeDetectionStrategy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BaseTranslationEditorComponent } from '../../../../admin/components/translation-editor/base-translation-editor.component';
import { TranslationEditorViewComponent } from '../../../../admin/components/translation-editor/translation-editor-view.component';
import { FooterCopyrightOptionComponent } from '../../../../admin/components/footer-copyright-option/footer-copyright-option.component';
import { LeaveConfirmable } from '../../../../admin/components/translation-editor/unsaved-texts.guard';

/**
 * @description Translation editor of the `shop` module.
 * @usage Route `/admin/shop/edit-eshop`.
 */
@Component({
  selector: 'app-edit-shop',
  standalone: true,
  imports: [TranslationEditorViewComponent, FooterCopyrightOptionComponent],
  // `compactActions`: the layout of the texts of the website (the "Jazyky" button, the statistics
  // line, the "Chybí" / "Jako CZ" pills, the save bar on a phone); no `editorRoute` - no visual editor yet
  // the copyright switch of the e-shop footer above the texts (text footer.copyright_text)
  template: `<app-translation-editor-view [e]="this" [compactActions]="true">
    <app-footer-copyright-option textsOptions endpoint="shop/settings/footer" [canUpdate]="canUpdate"
                                 (shownChange)="setTextHidden('footer.copyright_text', !$event)" />
  </app-translation-editor-view>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEshopComponent extends BaseTranslationEditorComponent implements LeaveConfirmable {
  protected override translationSection: string = 'edit-eshop';

  protected override readonly MODULE = 'shop';
  protected override readonly LANGUAGES_CACHE_KEY = 'edit-eshop:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'edit-eshop:translations:';
  protected override readonly UPDATE_PERMISSION = 'shop-edit-eshop-update';

  private readonly route = inject(ActivatedRoute);
  @ViewChild(TranslationEditorViewComponent) private view?: TranslationEditorViewComponent;

  /**
   * @description Leaving the page with unsaved edits of any tab asks first (unsavedTextsGuard -
   *   the menu, Back, a link).
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
