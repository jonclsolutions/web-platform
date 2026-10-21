/**
 * @file edit-website.component.ts
 * @path src/app/admin/web-pages/edit-website/edit-website.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages internationalization (i18n) settings, translation keys, and language
 * metadata for the public web module.
 *
 * (Earlier refactor-notes for the DataHandler unification and TTL cache are unchanged -
 * see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `translationSection`/`t()` doplněny stejným vzorem jako `CoreDashboardComponent`/
 * `UserRequestComponent`. Tahle stránka NEMÁ `*.config.ts` (tlačítka/labely jsou přímo
 * v šabloně, ne v deklarativním poli), takže žádné NG0956 riziko a žádná factory funkce
 * není potřeba - stačí `translations$.subscribe(() => markForCheck())` v konstruktoru
 * (OnPush komponenta) a `t()` volání přímo v šabloně. Všechny `alertDialogService.open()`
 * volání s jazykovým kódem interpolovaným do natvrdo psaného textu nahrazeny `t()` +
 * `.replace('{lang}', ...)` stejným vzorem jako `rowSelectAriaLabel()` v `TableBuilderComponent`.
 *
 * @refactor-note (2026-09-26) Přidán příznak `isDirty` (neuložené změny) - nastavuje se
 * v `updateValue()`, nuluje po úspěšném uložení, po (re)loadu překladů, po přidání
 * a po smazání aktuálního jazyka. Řídí stav nově doplněného tlačítka "Uložit změny"
 * v šabloně (dřív v šabloně chybělo a `onSubmit()` se nikdy nevolal - změny se
 * neukládaly).
 *
 *
 * @refactor-note (2026-10-21) Veškerá logika přesunuta beze změny do
 * `BaseTranslationEditorComponent` (shared/components/base-translation-editor), kterou
 * tato stránka jen konfiguruje: modul `'web'`, sekce `'edit-website'`, cache klíče
 * a oprávnění `'web-edit-website-update'`. Na EditEshopComponent nijak nezávisí.
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
 * @description Translation editor of the `web` module.
 * @usage Route `/admin/web/edit-website`; template and styles are page-specific.
 */
@Component({
  selector: 'app-edit-website',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
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
}
