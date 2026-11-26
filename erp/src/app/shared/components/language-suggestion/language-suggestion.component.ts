/**
 * @file language-suggestion.component.ts
 * @path src/app/shared/components/language-suggestion/language-suggestion.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One-time offer of the visitor's own language on a public page in another language
 *   (typically a shared link `/en/…` opened in a Czech browser): "Tato stránka je dostupná i
 *   v češtině – Přepnout do češtiny ×". Written in the offered language (its texts are loaded
 *   for that language), under the header, never together with the visitor's own choice.
 * @usage `<app-language-suggestion theme="dark" />` in the layout of a public area (web, e-shop).
 * @dependencies LocalizationService (languages, current language, texts of another language),
 *   LanguageRoutingService (switch with the URL), language-preference (browser languages).
 * @note Shown only when: the visitor has not chosen a language in a switcher, has not closed /
 *   used the offer before (localStorage `languageSuggestionDismissed` - a functional
 *   preference, no consent needed), the browser prefers another language the area offers and
 *   that language has the texts `language_suggestion.text` / `.action` / `.dismiss` (a language
 *   whose texts are not translated yet simply offers nothing).
 * @note Not in the visual text editor of the admin (PublicTextEditorService) - except its page
 *   "Lišta cookies a nabídka jazyka" (`textEditor.banners`): the offer of the edited language
 *   with its (marked) texts, as visitors preferring that language see it; its buttons do nothing.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnInit, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { LocalizationService } from '../../services/localization.service';
import { LanguageRoutingService } from '../../services/language-routing.service';
import { browserLanguages, preferredBrowserLanguage } from '../../utils/language-preference';
import { urlCodeOfLanguage } from '../../utils/language-url';
import { PublicTextEditorService } from '../../../public/text-editor/public-text-editor.service';

/** localStorage key: the visitor closed or used the offer - never offer again. */
export const LANGUAGE_SUGGESTION_DISMISSED_KEY = 'languageSuggestionDismissed';

/** Texts of the offer, in the offered language. */
interface SuggestionTexts {
  text: string;
  action: string;
  dismiss: string;
}

/** The offer being shown. */
interface Suggestion {
  /** Translation code of the offered language. */
  code: string;
  texts: SuggestionTexts;
}

@Component({
  selector: 'app-language-suggestion',
  standalone: true,
  templateUrl: './language-suggestion.component.html',
  styleUrl: './language-suggestion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.lsb-host--light]': "theme === 'light'" },
})
export class LanguageSuggestionComponent implements OnInit {
  /** Look of the bar: dark (web) or light (e-shop). */
  @Input() theme: 'dark' | 'light' = 'dark';

  /** The offer shown, null = nothing to offer. */
  suggestion: Suggestion | null = null;

  private readonly localization = inject(LocalizationService);
  private readonly languageRouting = inject(LanguageRoutingService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  /** Visual text editor of the admin - no offer there (the language is chosen by the editor). */
  private readonly textEditor = inject(PublicTextEditorService);

  /**
   * @description Decides whether to offer a language: for every current language, the first
   *   browser language the area offers that differs from it - with its texts.
   */
  ngOnInit(): void {
    if (this.textEditor.active) {
      if (this.textEditor.banners) {
        this.showForEditor();
      }
      return;
    }
    if (this.wasDismissed() || this.localization.isChosenByVisitor()) {
      return;
    }
    combineLatest([this.localization.fetchLanguages(), this.localization.currentLanguage$]).pipe(
      map(([res, current]) => {
        const offered = preferredBrowserLanguage(res.languages.map(l => l.code), browserLanguages());
        return offered && offered !== current ? offered : null;
      }),
      switchMap(code => code
        ? this.localization.fetchTexts(code).pipe(map(texts => this.toSuggestion(code, texts)))
        : of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(suggestion => {
      // Once the visitor chose a language elsewhere (a switcher), the offer is gone for good.
      this.suggestion = this.localization.isChosenByVisitor() ? null : suggestion;
      this.cd.markForCheck();
    });
  }

  /** @description Switches to the offered language (with its URL) and never offers again. */
  accept(): void {
    if (this.textEditor.active) return;
    const code = this.suggestion?.code;
    this.dismiss();
    if (code) {
      this.languageRouting.switchTo(code);
    }
  }

  /** @description Closes the offer for good. */
  dismiss(): void {
    if (this.textEditor.active) return;
    this.suggestion = null;
    try {
      localStorage.setItem(LANGUAGE_SUGGESTION_DISMISSED_KEY, '1');
    } catch {
      // Storage blocked (private mode): the offer is only closed for this page view.
    }
    this.cd.markForCheck();
  }

  /**
   * @description `lang` attribute of the offer (it is written in the offered language).
   * @param code Translation code.
   * @returns BCP 47 tag (`cs`, `en`).
   */
  htmlLang(code: string): string {
    return urlCodeOfLanguage(code);
  }

  /**
   * @description The page "Lišta cookies a nabídka jazyka" of the editor: the offer of the edited
   *   language with its texts as shown on the website (marked, with the drafts) - always shown,
   *   a missing text appears as missing (its Czech reference).
   */
  private showForEditor(): void {
    combineLatest([this.localization.currentLanguage$, this.localization.currentTranslations$]).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(([code, texts]) => {
      const offer = texts?.language_suggestion ?? {};
      this.suggestion = code ? { code, texts: { text: offer.text ?? '', action: offer.action ?? '', dismiss: offer.dismiss ?? '' } } : null;
      this.cd.markForCheck();
    });
  }

  /** @description Whether the visitor closed / used the offer before. */
  private wasDismissed(): boolean {
    try {
      return localStorage.getItem(LANGUAGE_SUGGESTION_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * @description The offer from the texts of the offered language.
   * @param code Offered language.
   * @param texts Its translations (null when not loaded).
   * @returns The offer, null when a text is missing.
   */
  private toSuggestion(code: string, texts: any): Suggestion | null {
    const t = texts?.language_suggestion;
    if (typeof t?.text !== 'string' || typeof t?.action !== 'string' || typeof t?.dismiss !== 'string' || !t.text || !t.action) {
      return null;
    }
    return { code, texts: { text: t.text, action: t.action, dismiss: t.dismiss } };
  }
}
