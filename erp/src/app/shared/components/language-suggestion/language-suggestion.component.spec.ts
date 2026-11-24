/**
 * @file language-suggestion.component.spec.ts
 * @path src/app/shared/components/language-suggestion/language-suggestion.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LanguageSuggestionComponent: the offer of the browser language on a
 *   page in another language (texts and `lang` of the offered language), accepting (switch with
 *   the URL, never again), closing (never again), no offer for the same language, after the
 *   visitor's own choice, after an earlier close, without texts in the offered language, and when
 *   the current language changes to the offered one.
 * @dependencies createPublicPageContext (LocalizationService stub cz / en, isChosenByVisitor /
 *   fetchTexts spies); LanguageRoutingService stub; navigator.languages spied.
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { LANGUAGE_SUGGESTION_DISMISSED_KEY, LanguageSuggestionComponent } from './language-suggestion.component';
import { LanguageRoutingService } from '../../services/language-routing.service';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

const CZECH_TEXTS = { language_suggestion: { text: 'Tato stránka je dostupná i v češtině.', action: 'Přepnout do češtiny', dismiss: 'Zavřít' } };

describe('LanguageSuggestionComponent', () => {
  let routing: { switchTo: jasmine.Spy };

  /** Creates the offer on an English page; options: chosen by the visitor, texts of the offer. */
  function create(options: { lang?: string; chosen?: boolean; texts?: any } = {}) {
    const ctx = createPublicPageContext({ lang: options.lang ?? 'en' });
    const localization = ctx.localization;
    localization.isChosenByVisitor.and.returnValue(options.chosen ?? false);
    localization.fetchTexts.and.returnValue(of(options.texts === undefined ? CZECH_TEXTS : options.texts));
    routing = { switchTo: jasmine.createSpy('switchTo') };
    TestBed.configureTestingModule({
      imports: [LanguageSuggestionComponent],
      providers: [...ctx.providers, { provide: LanguageRoutingService, useValue: routing }],
    });
    const fixture = TestBed.createComponent(LanguageSuggestionComponent);
    fixture.detectChanges();
    return { fixture, ctx, localization, root: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    localStorage.removeItem(LANGUAGE_SUGGESTION_DISMISSED_KEY);
    spyOnProperty(navigator, 'languages').and.returnValue(['cs-CZ', 'en']);
  });
  afterEach(() => localStorage.removeItem(LANGUAGE_SUGGESTION_DISMISSED_KEY));

  /**
   * @description English page, Czech browser: the offer in Czech (texts of cz, lang cs).
   * @input current en; browser cs-CZ; cz texts.
   * @output fetchTexts('cz'); bar with the Czech text, button 'Přepnout do češtiny', close
   *   labelled 'Zavřít', lang 'cs'.
   */
  it('offers the browser language in that language', () => {
    const { root, localization } = create();
    expect(localization.fetchTexts).toHaveBeenCalledWith('cz');
    const bar = root.querySelector('.lsb') as HTMLElement;
    expect(bar.lang).toBe('cs');
    expect(bar.querySelector('.lsb-text')!.textContent).toContain('dostupná i v češtině');
    expect(bar.querySelector('.lsb-action')!.textContent!.trim()).toBe('Přepnout do češtiny');
    expect(bar.querySelector('.lsb-close')!.getAttribute('aria-label')).toBe('Zavřít');
  });

  /**
   * @description Accepting switches to the language with its URL and is remembered; closing is
   *   remembered as well - the next page offers nothing.
   * @input click the action; new component; then close on a fresh one.
   * @output switchTo('cz'), bar gone, dismissed key '1'; no bar on the next creation.
   */
  it('switches on accept and never offers again', () => {
    const { fixture, root } = create();
    (root.querySelector('.lsb-action') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(routing.switchTo).toHaveBeenCalledOnceWith('cz');
    expect(root.querySelector('.lsb')).toBeNull();
    expect(localStorage.getItem(LANGUAGE_SUGGESTION_DISMISSED_KEY)).toBe('1');

    TestBed.resetTestingModule();
    const again = create();
    expect(again.root.querySelector('.lsb')).toBeNull();
    expect(again.localization.fetchTexts).not.toHaveBeenCalled();
  });

  /**
   * @description Closing hides the offer for good without switching.
   * @input click the close button.
   * @output no switchTo; bar gone; dismissed key '1'.
   */
  it('closes for good without switching', () => {
    const { fixture, root } = create();
    (root.querySelector('.lsb-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(routing.switchTo).not.toHaveBeenCalled();
    expect(root.querySelector('.lsb')).toBeNull();
    expect(localStorage.getItem(LANGUAGE_SUGGESTION_DISMISSED_KEY)).toBe('1');
  });

  /**
   * @description Nothing to offer: the page is already in the browser language; the visitor chose
   *   a language; the offered language has no offer texts yet.
   * @input current cz; chosen true; texts {} for cz.
   * @output no bar in each case.
   */
  it('offers nothing when there is nothing to offer', () => {
    expect(create({ lang: 'cz' }).root.querySelector('.lsb')).toBeNull();
    TestBed.resetTestingModule();
    expect(create({ chosen: true }).root.querySelector('.lsb')).toBeNull();
    TestBed.resetTestingModule();
    expect(create({ texts: {} }).root.querySelector('.lsb')).toBeNull();
  });

  /**
   * @description The page moves to the offered language (a link, the footer switcher): the offer
   *   disappears.
   * @input current en with the bar; currentLanguage$ → cz.
   * @output bar gone.
   */
  it('disappears when the page switches to the offered language', () => {
    const { fixture, ctx, root } = create();
    expect(root.querySelector('.lsb')).not.toBeNull();
    ctx.localization.currentLanguage$.next('cz');
    fixture.detectChanges();
    expect(root.querySelector('.lsb')).toBeNull();
  });
});
