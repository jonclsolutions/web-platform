/**
 * @file edit-eshop.component.ts
 * @path src/app/admin/shop-pages/edit-eshop/edit-eshop.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages internationalization (i18n) settings, translation keys, and language
 * metadata for the shop module.
 *
 * (Earlier refactor-notes for the DataHandler unification and TTL cache are unchanged -
 * see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * stejný vzor jako `EditWebsiteComponent` (viz jeho hlavička pro plné odůvodnění) -
 * `translationSection`/`t()` override + `translations$.subscribe(() => markForCheck())`
 * v konstruktoru (OnPush komponenta, žádný `*.config.ts`, žádné NG0956 riziko). Všechny
 * `alertDialogService.open()` volání s natvrdo psaným anglickým textem nahrazeny `t()` +
 * `.replace('{lang}', ...)`.
 *
 * @refactor-note (2026-09-26) Přidán příznak `isDirty` (neuložené změny) - nastavuje se
 * v `updateValue()`, nuluje po úspěšném uložení, po (re)loadu překladů, po přidání
 * a po smazání aktuálního jazyka. Řídí stav tlačítka "Uložit změny" v šabloně.
 *
 *
 * @refactor-note (2026-10-21) Veškerá logika přesunuta beze změny do
 * `BaseTranslationEditorComponent` (shared/components/base-translation-editor), kterou
 * tato stránka jen konfiguruje: modul `'shop'`, sekce `'edit-eshop'`, cache klíče
 * a oprávnění `'shop-edit-eshop-update'`. Na EditWebsiteComponent nijak nezávisí.
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
